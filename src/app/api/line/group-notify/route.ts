import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const REASON_LABELS: Record<string, string> = {
  practice: '別練習・大会',
  class: '授業',
  sick: '体調不良',
  personal: '私用',
  other: 'その他',
}

const ALLOWED_STATUS = new Set(['tardy', 'absent_normal', 'absent_emergency'])
const ALLOWED_REASON = new Set(Object.keys(REASON_LABELS))
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

export async function POST(request: NextRequest) {
  const { sessionId, status, reason, reasonDetail, arrivalTime, isAdvance } = await request.json()

  // 入力バリデーション（グループ全体に配信されるため厳格にチェック）
  if (typeof sessionId !== 'string' || !sessionId) {
    return NextResponse.json({ error: 'valid sessionId required' }, { status: 400 })
  }
  if (typeof status !== 'string' || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  if (reason != null && (typeof reason !== 'string' || !ALLOWED_REASON.has(reason))) {
    return NextResponse.json({ error: 'invalid reason' }, { status: 400 })
  }
  // 自由記述は 100 文字までに制限（スパム・悪用防止）
  const safeReasonDetail =
    typeof reasonDetail === 'string' ? reasonDetail.trim().slice(0, 100) : ''
  // 参加予定時刻は HH:MM 形式のみ許可（不正値は無視）
  const safeArrivalTime =
    typeof arrivalTime === 'string' && TIME_RE.test(arrivalTime.trim()) ? arrivalTime.trim() : null

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
    .select('full_name, display_name, is_approved')
    .eq('id', user.id)
    .single()

  // 承認済み部員のみ通知可（未承認ユーザーによるグループスパムを防止）
  if (!profile?.is_approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 対象セッションが実在し、かつ本人がそのセッションの出欠を登録済みで
  // あることを確認（任意セッションへの無差別スパムを防止）
  const { data: session } = await supabase
    .from('practice_sessions')
    .select('id, session_date, is_bukai')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 })
  }

  const { data: myRecord } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .single()

  if (!myRecord) {
    return NextResponse.json({ error: 'no attendance record' }, { status: 403 })
  }

  const name = profile.display_name ?? profile.full_name ?? 'メンバー'

  const date = new Date(session.session_date + 'T00:00:00')
  const dateLabel = date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  const reasonLabel = reason ? REASON_LABELS[reason] ?? reason : null
  const reasonStr = reasonLabel
    ? safeReasonDetail ? `${reasonLabel}（${safeReasonDetail}）` : reasonLabel
    : null

  // 部会かどうかは DB のセッション情報から判定（クライアント入力を信用しない）
  const sessionLabel = session.is_bukai ? '部会' : '練習'

  let text: string
  if (status === 'tardy') {
    text = `【出欠通知】\n${name}が${dateLabel}の${sessionLabel}に当日遅刻します。`
    if (safeArrivalTime) text += `\n参加予定時刻：${safeArrivalTime}`
  } else if (isAdvance) {
    text = `【出欠通知】\n${name}が${dateLabel}の${sessionLabel}を欠席します（事前連絡）。`
    if (reasonStr) text += `\n理由：${reasonStr}`
  } else {
    text = `【出欠通知】\n${name}が${dateLabel}の${sessionLabel}を当日欠席します。`
    if (reasonStr) text += `\n理由：${reasonStr}`
  }

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
