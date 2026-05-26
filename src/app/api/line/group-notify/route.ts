import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { sessionDate } = await request.json()
  if (!sessionDate) {
    return NextResponse.json({ error: 'sessionDate required' }, { status: 400 })
  }

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
    .select('full_name, display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name ?? profile?.full_name ?? 'メンバー'

  const date = new Date(sessionDate + 'T00:00:00')
  const dateLabel = date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
  const text = `【出欠通知】\n${name}が${dateLabel}の練習を当日欠席に変更しました。`

  const groupId = process.env.LINE_GROUP_ID
  if (!groupId) {
    console.error('LINE_GROUP_ID is not set')
    return NextResponse.json({ error: 'group not configured' }, { status: 500 })
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error('LINE group push error:', err)
    return NextResponse.json({ error: 'LINE API error', detail: err }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
