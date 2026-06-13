import { google } from 'googleapis'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function buildOAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

function parseCalendarIds(env: string | undefined): string[] {
  return (env ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

// Googleカレンダーイベントの説明文から時間と面数をパースする
// 対応フォーマット例: 時間：17:00〜22:00 / 面数：4面
function parseDescription(desc: string | null | undefined): {
  startTime: string | null
  endTime: string | null
  courts: number | null
} {
  if (!desc) return { startTime: null, endTime: null, courts: null }

  // 時間：HH:MM〜HH:MM（全角/半角コロン、各種チルダ対応）
  const timeMatch = desc.match(/時間[：:]\s*(\d{1,2})[：:](\d{2})\s*[〜～~]\s*(\d{1,2})[：:](\d{2})/)
  let startTime: string | null = null
  let endTime: string | null   = null
  if (timeMatch) {
    startTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`
    endTime   = `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}:00`
  }

  // 面数：N（面は省略可）
  const courtsMatch = desc.match(/面数[：:]\s*(\d+)/)
  const courts = courtsMatch ? parseInt(courtsMatch[1], 10) : null

  return { startTime, endTime, courts }
}

export async function GET(request: NextRequest) {
  // 認証チェック（ログイン済みであれば誰でも同期可能）
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year  = parseInt(searchParams.get('year')  ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10) // 1-indexed
  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 })
  }

  const activityCalendarIds = parseCalendarIds(process.env.GOOGLE_CALENDAR_ACTIVITY_IDS)
  const campCalendarIds     = parseCalendarIds(process.env.GOOGLE_CALENDAR_CAMP_IDS)
  const bukaiCalendarIds    = parseCalendarIds(process.env.GOOGLE_CALENDAR_BUKAI_IDS)
  const allActivityIds      = [...activityCalendarIds, ...campCalendarIds, ...bukaiCalendarIds]

  if (allActivityIds.length === 0) {
    // 活動日カレンダー未設定の場合はSupabaseのセッションをそのまま返す
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    const { data } = await supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, is_bukai, courts, created_at')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
    return NextResponse.json({ sessions: data ?? [] })
  }

  const campCalendarIdSet  = new Set(campCalendarIds)
  const bukaiCalendarIdSet = new Set(bukaiCalendarIds)

  const timeMin   = new Date(year, month - 1, 1).toISOString()
  const timeMax   = new Date(year, month, 0, 23, 59, 59).toISOString()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  try {
    const auth     = buildOAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    // 活動日・合宿カレンダーのイベントを全取得（カレンダーIDも保持）
    const gcalResults = await Promise.all(
      allActivityIds.map(calendarId =>
        calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 200,
        }).then(res => (res.data.items ?? []).map(item => ({ item, calendarId })))
      )
    )
    const gcalItems = gcalResults.flat()

    // DB操作は service role で行う
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 終日イベントを日ごとに展開するヘルパー
    function expandDates(startDate: string, endDateExclusive: string): string[] {
      const dates: string[] = []
      const cur = new Date(startDate + 'T12:00:00')
      const end = new Date(endDateExclusive + 'T12:00:00')
      while (cur < end) {
        const y  = cur.getFullYear()
        const mo = String(cur.getMonth() + 1).padStart(2, '0')
        const d  = String(cur.getDate()).padStart(2, '0')
        dates.push(`${y}-${mo}-${d}`)
        cur.setDate(cur.getDate() + 1)
      }
      return dates
    }

    // マルチデイIDからベースイベントIDを取り出す（"eventId_YYYY-MM-DD" → "eventId"）
    function baseEventId(id: string): string {
      const m = id.match(/^(.+)_\d{4}-\d{2}-\d{2}$/)
      return m ? m[1] : id
    }

    // 既存セッションの日付→google_event_id マップを事前取得（上書き衝突防止用）
    const { data: existingMonthSessions } = await admin
      .from('practice_sessions')
      .select('session_date, google_event_id')
      .gte('session_date', startDate)
      .lte('session_date', endDate)

    const claimedDates = new Map<string, string | null>(
      (existingMonthSessions ?? []).map(s => [s.session_date, s.google_event_id as string | null])
    )

    // GCal イベントを practice_sessions に upsert（複数日イベントは日ごとに展開）
    const gcalEventIdSet = new Set<string>()

    for (const { item, calendarId } of gcalItems) {
      if (!item.id) continue
      const startStr = item.start?.date ?? item.start?.dateTime
      if (!startStr) continue
      const isAllDay = !!item.start?.date
      const isCamp   = campCalendarIdSet.has(calendarId)
      const isBukai  = bukaiCalendarIdSet.has(calendarId)

      // 説明文から時間・面数をパース（全イベント種別共通）
      const parsed = parseDescription(item.description)

      if (isAllDay && item.end?.date) {
        // 終日イベント（1日 or 複数日）
        const dates      = expandDates(startStr, item.end.date)
        const isMultiDay = dates.length > 1

        for (const date of dates) {
          // 複数日の場合は "{eventId}_{date}" で各日をユニークに識別
          const googleEventId = isMultiDay ? `${item.id}_${date}` : item.id
          gcalEventIdSet.add(googleEventId)

          // 別のGCalイベントがこの日付を先に確保していればスキップ（上書き防止）
          const existing = claimedDates.get(date)
          if (existing != null && baseEventId(existing) !== item.id) continue

          await admin.from('practice_sessions').upsert({
            session_date:    date,
            // 説明文に時間があれば優先、なければデフォルト
            start_time:      parsed.startTime ?? '17:00:00',
            end_time:        parsed.endTime   ?? '20:00:00',
            location:        item.location ?? '新習志野体育館',
            note:            item.summary ?? null,
            google_event_id: googleEventId,
            is_camp:         isCamp,
            is_bukai:        isBukai,
            courts:          parsed.courts,
          }, { onConflict: 'session_date' })
          claimedDates.set(date, googleEventId)
        }
      } else {
        // 時刻指定イベント（単日）
        const date = startStr.slice(0, 10)
        // 説明文に時間があれば優先、なければイベントの開始/終了時刻
        const startTime = parsed.startTime ?? item.start?.dateTime?.slice(11, 19) ?? '17:00:00'
        const endTime   = parsed.endTime   ?? item.end?.dateTime?.slice(11, 19)   ?? '20:00:00'
        gcalEventIdSet.add(item.id)

        // 別のGCalイベントがこの日付を先に確保していればスキップ（上書き防止）
        const existing = claimedDates.get(date)
        if (existing != null && baseEventId(existing) !== item.id) continue

        await admin.from('practice_sessions').upsert({
          session_date:    date,
          start_time:      startTime,
          end_time:        endTime,
          location:        item.location ?? '新習志野体育館',
          note:            item.description ?? item.summary ?? null,
          google_event_id: item.id,
          is_camp:         isCamp,
          is_bukai:        isBukai,
          courts:          parsed.courts,
        }, { onConflict: 'session_date' })
        claimedDates.set(date, item.id)
      }
    }

    const { data: gcalSessions } = await admin
      .from('practice_sessions')
      .select('id, google_event_id, is_cancelled')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .not('google_event_id', 'is', null)

    for (const session of gcalSessions ?? []) {
      if (gcalEventIdSet.has(session.google_event_id)) continue
      // GCalから削除されたセッション
      const { count } = await admin
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
      if ((count ?? 0) === 0) {
        // 出欠記録なし → セッション自体を削除
        await admin.from('practice_sessions').delete().eq('id', session.id)
      } else if (!session.is_cancelled) {
        // 出欠記録あり → 休止扱いにして記録を保護
        await admin.from('practice_sessions')
          .update({
            is_cancelled:        true,
            cancellation_reason: 'Googleカレンダーから削除されました',
          })
          .eq('id', session.id)
      }
    }

    // 月の全セッション（手動作成分も含む）を返す
    const { data: sessions } = await admin
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, is_bukai, courts, created_at')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date')

    return NextResponse.json({ sessions: sessions ?? [] })
  } catch (err) {
    console.error('Google Calendar sync error:', err)
    // 同期失敗時はSupabaseのデータをそのまま返してUIを壊さない
    const { data } = await supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, is_bukai, courts, created_at')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
    return NextResponse.json({ sessions: data ?? [] })
  }
}
