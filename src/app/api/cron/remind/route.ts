import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Vercel Cron の認証チェック
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 今週の水・木・金を計算
  const now = new Date()
  const dow = now.getDay() // 0=日 ... 2=火
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const addDays = (base: Date, n: number) => {
    const d = new Date(base); d.setDate(base.getDate() + n); return d
  }

  // 火曜(2)から来週の水木金、月(1)以前から今週の水木金
  const daysToMonday = dow === 1 ? 0 : dow === 2 ? -1 : dow === 6 ? 2 : 1
  const monday = addDays(now, daysToMonday)
  monday.setHours(0, 0, 0, 0)
  const targetDates = [
    toDateStr(addDays(monday, 2)),
    toDateStr(addDays(monday, 3)),
    toDateStr(addDays(monday, 4)),
  ]

  // 対象セッションを取得
  const { data: sessions } = await admin
    .from('practice_sessions')
    .select('id, session_date')
    .in('session_date', targetDates)
    .eq('is_cancelled', false)

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ message: 'no sessions', dates: targetDates })
  }

  // 承認済み部員一覧（coachを除く）
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .eq('is_approved', true)
    .eq('is_active', true)
    .neq('role', 'coach')

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: 'no members' })
  }

  const memberIds = profiles.map(p => p.id)

  // 既に連絡済みのレコードを取得
  const sessionIds = sessions.map(s => s.id)
  const { data: records } = await admin
    .from('attendance_records')
    .select('session_id, user_id')
    .in('session_id', sessionIds)

  const submitted = new Set(
    (records ?? []).map(r => `${r.session_id}:${r.user_id}`)
  )

  // 未提出ユーザーを特定（全セッションで未提出の人）
  const unsubmittedIds = new Set<string>()
  for (const session of sessions) {
    for (const memberId of memberIds) {
      if (!submitted.has(`${session.id}:${memberId}`)) {
        unsubmittedIds.add(memberId)
      }
    }
  }

  if (unsubmittedIds.size === 0) {
    return NextResponse.json({ message: 'all submitted', sent: 0 })
  }

  // line_user_id を取得
  const lineUserIds: string[] = []
  for (const uid of unsubmittedIds) {
    const { data: { user } } = await admin.auth.admin.getUserById(uid)
    const lineUserId = user?.user_metadata?.line_user_id as string | undefined
    if (lineUserId) lineUserIds.push(lineUserId)
  }

  if (lineUserIds.length === 0) {
    return NextResponse.json({ message: 'no line users', sent: 0 })
  }

  const datesLabel = targetDates
    .map(d => {
      const date = new Date(d + 'T00:00:00')
      return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    })
    .join('・')

  const text = `【バドミントン部】\n${datesLabel}の出欠連絡がまだです。\nアプリから連絡をお願いします。`

  const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: lineUserIds, messages: [{ type: 'text', text }] }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error('LINE multicast error:', err)
    return NextResponse.json({ error: 'LINE API error', detail: err }, { status: 500 })
  }

  return NextResponse.json({ sent: lineUserIds.length, dates: targetDates })
}
