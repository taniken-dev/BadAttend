import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { userIds, sessionDate } = await request.json()
  if (!Array.isArray(userIds) || userIds.length === 0 || !sessionDate) {
    return NextResponse.json({ error: 'userIds and sessionDate required' }, { status: 400 })
  }

  // 認証チェック（admin または manager のみ）
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 各ユーザーの line_user_id を user_metadata から取得
  // （全ユーザーを1回だけ取得してマップ化。従来は対象者ごとに
  //   getUserById を直列実行していた）
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const lineIdByUser = new Map<string, string>()
  for (const u of userList?.users ?? []) {
    const lineUserId = u.user_metadata?.line_user_id as string | undefined
    if (lineUserId) lineIdByUser.set(u.id, lineUserId)
  }

  const lineUserIds: string[] = []
  for (const uid of userIds as string[]) {
    const lineUserId = lineIdByUser.get(uid)
    if (lineUserId) lineUserIds.push(lineUserId)
  }

  if (lineUserIds.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const date = new Date(sessionDate + 'T00:00:00')
  const dateLabel = date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
  const text = `【バドミントン部】\n${dateLabel}の練習の出欠連絡がまだです。\nアプリから連絡をお願いします。`

  const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserIds,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error('LINE multicast error:', err)
    return NextResponse.json({ error: 'LINE API error', detail: err }, { status: 500 })
  }

  return NextResponse.json({ sent: lineUserIds.length })
}
