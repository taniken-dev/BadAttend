import { google, type calendar_v3 } from 'googleapis'
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

// Googleカレンダーイベントの説明文から時間・面数・補足時間をパースする
// 対応フォーマット例: 時間：17:00〜22:00 / 面数：4面
// 時間の後ろに（15:00）のような括弧がある場合は「体育館の利用可能時間（自主練習可）」の
// 補足として timeNote に保持する（例: 時間：9:00〜12:00(15:00) → timeNote = "15:00"）
// GCalのリッチテキスト説明文は <b>時間</b>：15:00～20:00<br> のようにHTMLタグを含むため、
// パース前にタグを除去する（自主練カレンダーはプレーンテキストのため元々問題なかった）
function parseDescription(desc: string | null | undefined): {
  startTime: string | null
  endTime: string | null
  courts: number | null
  timeNote: string | null
} {
  if (!desc) return { startTime: null, endTime: null, courts: null, timeNote: null }
  const plainDesc = desc.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')

  // 時間：HH:MM〜HH:MM（全角/半角コロン、各種チルダ対応）+ 任意の（補足）
  const timeMatch = plainDesc.match(/時間[：:]\s*(\d{1,2})[：:](\d{2})\s*[〜～~]\s*(\d{1,2})[：:](\d{2})\s*(?:[（(]([^）)]*)[）)])?/)
  let startTime: string | null = null
  let endTime: string | null   = null
  let timeNote: string | null  = null
  if (timeMatch) {
    startTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`
    endTime   = `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}:00`
    timeNote  = timeMatch[5] ? timeMatch[5].trim() || null : null
  }

  // 面数：N（面は省略可）
  const courtsMatch = plainDesc.match(/面数[：:]\s*(\d+)/)
  const courts = courtsMatch ? parseInt(courtsMatch[1], 10) : null

  return { startTime, endTime, courts, timeNote }
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

  // 承認済みユーザーのみ同期可（同期は service_role で DB 書き込み・
  // Google API 呼び出しを行うため、未承認ユーザーには許可しない）
  const { data: syncProfile } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .single()
  if (!syncProfile?.is_approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const year  = parseInt(searchParams.get('year')  ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10) // 1-indexed
  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 })
  }

  const activityCalendarIds  = parseCalendarIds(process.env.GOOGLE_CALENDAR_ACTIVITY_IDS)
  const campCalendarIds      = parseCalendarIds(process.env.GOOGLE_CALENDAR_CAMP_IDS)
  const bukaiCalendarIds     = parseCalendarIds(process.env.GOOGLE_CALENDAR_BUKAI_IDS)
  const miscCalendarIds      = parseCalendarIds(process.env.GOOGLE_CALENDAR_MISC_IDS)
  const allActivityIds       = [...activityCalendarIds, ...campCalendarIds, ...bukaiCalendarIds]

  if (allActivityIds.length === 0 && miscCalendarIds.length === 0) {
    // 活動日カレンダー未設定の場合はSupabaseのセッションをそのまま返す
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    const { data } = await supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, is_bukai, is_voluntary, courts, time_note, created_at')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
    return NextResponse.json({ sessions: data ?? [] })
  }

  const campCalendarIdSet  = new Set(campCalendarIds)
  const bukaiCalendarIdSet = new Set(bukaiCalendarIds)
  const miscCalendarIdSet  = new Set(miscCalendarIds)

  const timeMin   = new Date(year, month - 1, 1).toISOString()
  const timeMax   = new Date(year, month, 0, 23, 59, 59).toISOString()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  try {
    const auth     = buildOAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    // 活動日・合宿カレンダーのイベントを全取得（カレンダーIDも保持）
    const [gcalResults, miscResults] = await Promise.all([
      Promise.all(
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
      ),
      // MISC（その他）カレンダーから自主練習イベントを取得
      Promise.all(
        miscCalendarIds.map(calendarId =>
          calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 200,
          }).then(res => (res.data.items ?? [])
            .filter(item => (item.summary ?? '').includes('自主練'))
            .map(item => ({ item, calendarId }))
          ).catch(() => [] as { item: calendar_v3.Schema$Event; calendarId: string }[])
        )
      ),
    ])
    const gcalItems      = gcalResults.flat()
    const voluntaryItems = miscResults.flat()

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

    // 既存セッションの日付一覧を事前取得（自主練の除外判定に使用）
    const { data: existingMonthSessions } = await admin
      .from('practice_sessions')
      .select('session_date, is_voluntary')
      .gte('session_date', startDate)
      .lte('session_date', endDate)

    // 通常（非自主練）セッションが存在する日付。1日に部活・部会など複数の
    // 通常セッションが共存できるため、ここでは日付の奪い合いはしない。
    // 自主練だけは「その日に通常セッションが無い場合のみ」作成する。
    const datesWithRegularSession = new Set<string>(
      (existingMonthSessions ?? []).filter(s => !s.is_voluntary).map(s => s.session_date)
    )

    // GCal イベントを google_event_id ごとに1行へ集約してから一括 upsert する。
    const gcalEventIdSet = new Set<string>()
    const rowByEventId = new Map<string, Record<string, unknown>>()

    // 通常イベント・自主練イベント共通の日付展開処理
    // 時間・面数は説明文（または時刻指定イベントの実時刻）に明記されている場合のみ設定し、
    // 書かれていない場合は null のまま保存する（架空のデフォルト時刻を表示しないため）
    const processItem = (
      item: calendar_v3.Schema$Event,
      opts: {
        isCamp: boolean; isBukai: boolean; isVoluntary: boolean
        noteFallback: string | null
      },
    ) => {
      if (!item.id) return
      const startStr = item.start?.date ?? item.start?.dateTime
      if (!startStr) return
      const isAllDay = !!item.start?.date
      const parsed   = parseDescription(item.description)

      if (isAllDay && item.end?.date) {
        // 終日イベント（1日 or 複数日）
        const dates      = expandDates(startStr, item.end.date)
        const isMultiDay = dates.length > 1
        for (const date of dates) {
          if (opts.isVoluntary && datesWithRegularSession.has(date)) continue
          // 複数日の場合は "{eventId}_{date}" で各日をユニークに識別
          const googleEventId = isMultiDay ? `${item.id}_${date}` : item.id
          gcalEventIdSet.add(googleEventId)
          if (!opts.isVoluntary) datesWithRegularSession.add(date)
          rowByEventId.set(googleEventId, {
            session_date:    date,
            start_time:      parsed.startTime,
            end_time:        parsed.endTime,
            location:        item.location ?? '新習志野体育館',
            note:            item.summary ?? opts.noteFallback,
            google_event_id: googleEventId,
            is_camp:         opts.isCamp,
            is_bukai:        opts.isBukai,
            is_voluntary:    opts.isVoluntary,
            courts:          parsed.courts,
            time_note:       parsed.timeNote,
          })
        }
      } else {
        // 時刻指定イベント（単日）：GCal自体に設定された実時刻があればそれを優先
        const date = startStr.slice(0, 10)
        if (opts.isVoluntary && datesWithRegularSession.has(date)) return
        const startTime = parsed.startTime ?? item.start?.dateTime?.slice(11, 19) ?? null
        const endTime   = parsed.endTime   ?? item.end?.dateTime?.slice(11, 19)   ?? null
        gcalEventIdSet.add(item.id)
        if (!opts.isVoluntary) datesWithRegularSession.add(date)
        rowByEventId.set(item.id, {
          session_date:    date,
          start_time:      startTime,
          end_time:        endTime,
          location:        item.location ?? '新習志野体育館',
          // 通常イベントは説明文優先、自主練は summary 優先
          note:            opts.isVoluntary
            ? (item.summary ?? opts.noteFallback)
            : (item.description ?? item.summary ?? opts.noteFallback),
          google_event_id: item.id,
          is_camp:         opts.isCamp,
          is_bukai:        opts.isBukai,
          is_voluntary:    opts.isVoluntary,
          courts:          parsed.courts,
          time_note:       parsed.timeNote,
        })
      }
    }

    // 通常イベントを先に処理して日付を確保（自主練より優先）
    for (const { item, calendarId } of gcalItems) {
      processItem(item, {
        isCamp:       campCalendarIdSet.has(calendarId),
        isBukai:      bukaiCalendarIdSet.has(calendarId),
        isVoluntary:  false,
        noteFallback: null,
      })
    }

    // 自主練習イベントを処理（通常セッションが無い日付のみ確保される）
    for (const { item } of voluntaryItems) {
      processItem(item, {
        isCamp:       false,
        isBukai:      false,
        isVoluntary:  true,
        noteFallback: '自主練習',
      })
    }

    // 集約した行を一括 upsert（1クエリ）
    const rowsToUpsert = [...rowByEventId.values()]
    if (rowsToUpsert.length > 0) {
      await admin.from('practice_sessions').upsert(rowsToUpsert, { onConflict: 'google_event_id' })
    }

    const { data: gcalSessions } = await admin
      .from('practice_sessions')
      .select('id, google_event_id, is_cancelled')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .not('google_event_id', 'is', null)

    // GCal から削除されたセッションを特定
    const orphans = (gcalSessions ?? []).filter(s => !gcalEventIdSet.has(s.google_event_id))
    if (orphans.length > 0) {
      const orphanIds = orphans.map(s => s.id)

      // どの orphan が出欠記録を持つかを1クエリで判定（従来はセッションごとに
      // count クエリを投げる N+1 だった）
      const { data: recs } = await admin
        .from('attendance_records')
        .select('session_id')
        .in('session_id', orphanIds)
      const withRecords = new Set((recs ?? []).map(r => r.session_id))

      // 出欠記録なし → セッション自体を削除（まとめて1クエリ）
      const toDelete = orphans.filter(s => !withRecords.has(s.id)).map(s => s.id)
      if (toDelete.length > 0) {
        await admin.from('practice_sessions').delete().in('id', toDelete)
      }

      // 出欠記録あり かつ 未休止 → 休止扱いにして記録を保護（まとめて1クエリ）
      const toCancel = orphans
        .filter(s => withRecords.has(s.id) && !s.is_cancelled)
        .map(s => s.id)
      if (toCancel.length > 0) {
        await admin.from('practice_sessions')
          .update({
            is_cancelled:        true,
            cancellation_reason: 'Googleカレンダーから削除されました',
          })
          .in('id', toCancel)
      }
    }

    // 月の全セッション（手動作成分も含む）を返す
    const { data: sessions } = await admin
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, is_bukai, is_voluntary, courts, time_note, created_at')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date')

    return NextResponse.json({ sessions: sessions ?? [] })
  } catch (err) {
    console.error('Google Calendar sync error:', err)
    // 同期失敗時はSupabaseのデータをそのまま返してUIを壊さない
    const { data } = await supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, is_bukai, is_voluntary, courts, time_note, created_at')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
    return NextResponse.json({ sessions: data ?? [] })
  }
}
