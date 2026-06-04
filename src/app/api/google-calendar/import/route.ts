import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { googleEventId, date, startTime, endTime, location, note } = body

  if (!googleEventId || !date) {
    return NextResponse.json({ error: 'googleEventId and date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('practice_sessions')
    .insert({
      session_date:    date,
      start_time:      startTime ?? '17:00:00',
      end_time:        endTime   ?? '20:00:00',
      location:        location  ?? '新習志野体育館',
      note:            note      ?? null,
      google_event_id: googleEventId,
    })
    .select('id, session_date, start_time, end_time, location, is_cancelled, cancellation_reason, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'already_imported' }, { status: 409 })
    }
    console.error('import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session: data })
}
