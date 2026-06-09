import { google, type calendar_v3 } from 'googleapis'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GoogleCalendarEvent } from '@/lib/types'

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

export async function GET(request: NextRequest) {
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

  // 活動日カレンダー（出欠登録対象）、大会などカレンダー、その他カレンダー（表示のみ）を分けて管理
  const activityCalendarIds = parseCalendarIds(process.env.GOOGLE_CALENDAR_ACTIVITY_IDS)
  const campCalendarIds     = parseCalendarIds(process.env.GOOGLE_CALENDAR_CAMP_IDS)
  const bukaiCalendarIds    = parseCalendarIds(process.env.GOOGLE_CALENDAR_BUKAI_IDS)
  const otherCalendarIds    = parseCalendarIds(process.env.GOOGLE_CALENDAR_OTHER_IDS)
  const miscCalendarIds     = parseCalendarIds(process.env.GOOGLE_CALENDAR_MISC_IDS)
  const allCalendarIds      = [...activityCalendarIds, ...campCalendarIds, ...bukaiCalendarIds, ...otherCalendarIds, ...miscCalendarIds]

  if (allCalendarIds.length === 0) {
    return NextResponse.json({ events: [] })
  }

  const timeMin = new Date(year, month - 1, 1).toISOString()
  const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString()

  try {
    const auth     = buildOAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    const [calendarResults, importedRes] = await Promise.all([
      Promise.all(
        allCalendarIds.map(calendarId =>
          calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100,
          })
            .then(res => ({ calendarId, items: res.data.items ?? [] }))
            .catch((err: unknown) => {
              console.error(`Google Calendar fetch failed for ${calendarId}:`, err)
              return { calendarId, items: [] as calendar_v3.Schema$Event[] }
            })
        )
      ),
      supabase
        .from('practice_sessions')
        .select('google_event_id')
        .gte('session_date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('session_date', `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`)
        .not('google_event_id', 'is', null),
    ])

    const importedIds = new Set(
      (importedRes.data ?? []).map(r => r.google_event_id as string)
    )
    // 部会・合宿も sync で practice_sessions に取り込まれるため isActivityDay 扱い
    const activityIdSet = new Set([...activityCalendarIds, ...campCalendarIds, ...bukaiCalendarIds])
    const miscIdSet     = new Set(miscCalendarIds)

    const events: GoogleCalendarEvent[] = calendarResults.flatMap(({ calendarId, items }) =>
      items.flatMap(item => {
        if (!item.id) return []
        const isAllDay  = !!item.start?.date
        const startStr  = item.start?.date ?? item.start?.dateTime
        if (!startStr) return []

        let startTime: string | undefined
        let endTime: string | undefined
        if (!isAllDay && item.start?.dateTime && item.end?.dateTime) {
          startTime = item.start.dateTime.slice(11, 16)
          endTime   = item.end.dateTime.slice(11, 16)
        }

        const base = {
          title:           item.summary ?? '(無題)',
          startTime,
          endTime,
          location:        item.location ?? undefined,
          description:     item.description ?? undefined,
          isActivityDay:   activityIdSet.has(calendarId),
          alreadyImported: importedIds.has(item.id),
          isOther:         miscIdSet.has(calendarId),
        }

        // 複数日にまたがる終日イベントを日ごとに展開
        if (isAllDay && item.end?.date) {
          const dates: string[] = []
          // T12:00:00 で生成することでタイムゾーン変換による日付ずれを防ぐ
          const cur = new Date(startStr + 'T12:00:00')
          const end = new Date(item.end.date + 'T12:00:00') // exclusive
          while (cur < end) {
            const y = cur.getFullYear()
            const mo = String(cur.getMonth() + 1).padStart(2, '0')
            const d  = String(cur.getDate()).padStart(2, '0')
            dates.push(`${y}-${mo}-${d}`)
            cur.setDate(cur.getDate() + 1)
          }
          return dates.map(date => ({
            ...base,
            id:   item.id! + '_' + date, // 日ごとにユニークなID
            date,
          }))
        }

        return [{ ...base, id: item.id, date: startStr.slice(0, 10) }]
      })
    )

    // 同じ日の中で日付順に並べる
    events.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ events })
  } catch (err) {
    console.error('Google Calendar API error:', err)
    return NextResponse.json({ error: 'Google Calendar API error' }, { status: 500 })
  }
}
