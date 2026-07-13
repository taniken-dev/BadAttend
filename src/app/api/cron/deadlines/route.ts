import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTaiikukaiDeadlines, getTaiikukaiUrl } from '@/lib/taiikukai'
import type { DocumentDeadline } from '@/lib/types'

// 体育会HPから締切一覧を毎日取得して document_deadlines に同期し、
// 未提出の書類が締切に近づいたら管理者・幹部へLINEリマインドを送る。
// 取得失敗・0件（書式変更の疑い）のときも管理者・幹部へ異常通知する。

const REMIND_DAYS = [7, 3, 1, 0]

type AdminClient = ReturnType<typeof createAdminClient>

// 管理者＋幹部の LINE ユーザーIDを取得
async function getNotifyTargets(admin: AdminClient): Promise<string[]> {
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, role, is_executive')
    .eq('is_approved', true)
    .eq('is_active', true)
    .or('role.eq.admin,is_executive.eq.true')

  const targetIds = new Set((profiles ?? []).map(p => p.id))
  if (targetIds.size === 0) return []

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const lineUserIds: string[] = []
  for (const u of userList?.users ?? []) {
    const lineUserId = u.user_metadata?.line_user_id as string | undefined
    if (lineUserId && targetIds.has(u.id)) lineUserIds.push(lineUserId)
  }
  return lineUserIds
}

async function sendLineMulticast(lineUserIds: string[], text: string): Promise<boolean> {
  if (lineUserIds.length === 0) return false
  const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: lineUserIds, messages: [{ type: 'text', text }] }),
  })
  if (!res.ok) {
    console.error('LINE multicast error:', await res.json().catch(() => null))
    return false
  }
  return true
}

function formatDeadlineLabel(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short',
  })
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false,
  }).format(d))
  return `${date}${hour}時`
}

// JST の暦日ベースで「あと何日」かを数える
function daysUntilJst(iso: string, now: Date): number {
  const toJstDateStr = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d)
  const target = new Date(toJstDateStr(new Date(iso)) + 'T00:00:00Z')
  const today = new Date(toJstDateStr(now) + 'T00:00:00Z')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export async function GET(request: NextRequest) {
  // Vercel Cron の認証チェック（CRON_SECRET 未設定時は全拒否）
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()

  // ① 体育会HPを取得・パース
  let scrape
  try {
    scrape = await fetchTaiikukaiDeadlines(now)
    if (!scrape.sectionFound) {
      throw new Error('「提出期限間近の書類」セクションが見つかりません（HP構成変更の疑い）')
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('deadline scrape error:', message)
    await admin
      .from('deadline_scrape_status')
      .update({ last_error: message, last_error_at: nowIso })
      .eq('id', 1)
    const targets = await getNotifyTargets(admin)
    await sendLineMulticast(
      targets,
      `【体育会 書類締切】\n⚠️ 締切情報の自動取得に失敗しました。\n（${message}）\n体育会HPを直接確認してください。アプリの締切表示は最新でない可能性があります。\n${getTaiikukaiUrl()}`
    )
    return NextResponse.json({ error: 'scrape failed', detail: message }, { status: 500 })
  }

  let deactivated = 0

  if (scrape.deadlines.length > 0) {
    // ② 同期：source_key で upsert（提出チェック submitted_* は上書きしない）
    const { error: upsertError } = await admin
      .from('document_deadlines')
      .upsert(
        scrape.deadlines.map(d => ({
          source_key: d.sourceKey,
          deadline_at: d.deadlineAt,
          document_name: d.documentName,
          is_active: true,
          last_seen_at: nowIso,
        })),
        { onConflict: 'source_key' }
      )
    if (upsertError) {
      console.error('deadline upsert error:', upsertError)
      return NextResponse.json({ error: 'upsert failed', detail: upsertError.message }, { status: 500 })
    }

    // サイトから消えた書類は非表示化（提出履歴ごと保持）
    const currentKeys = new Set(scrape.deadlines.map(d => d.sourceKey))
    const { data: activeRows } = await admin
      .from('document_deadlines')
      .select('id, source_key')
      .eq('is_active', true)
    const staleIds = (activeRows ?? [])
      .filter(r => !currentKeys.has(r.source_key))
      .map(r => r.id)
    if (staleIds.length > 0) {
      await admin.from('document_deadlines').update({ is_active: false }).in('id', staleIds)
      deactivated = staleIds.length
    }
  }

  // ③ 取得成功を記録
  await admin
    .from('deadline_scrape_status')
    .update({ last_success_at: nowIso, last_error: null, last_error_at: null })
    .eq('id', 1)

  const targets = await getNotifyTargets(admin)

  // 0件は正常の可能性もあるが、担当者の書式変更でパースが空振りしている
  // 可能性もあるため、既存データを消さずに警告だけ送る
  if (scrape.deadlines.length === 0) {
    await sendLineMulticast(
      targets,
      `【体育会 書類締切】\n⚠️ 締切情報の取得結果が0件でした。\n実際に締切がないか、HPの書式変更でパースできていない可能性があります。念のためHPを直接確認してください。\n${getTaiikukaiUrl()}`
    )
  }

  // ④ 未提出書類のリマインド（締切の 7・3・1・0 日前）
  const { data: pendingRows } = await admin
    .from('document_deadlines')
    .select('*')
    .eq('is_active', true)
    .is('submitted_at', null)
    .gte('deadline_at', nowIso)
    .order('deadline_at')

  const dueSoon = ((pendingRows ?? []) as DocumentDeadline[])
    .map(d => ({ ...d, daysLeft: daysUntilJst(d.deadline_at, now) }))
    .filter(d => REMIND_DAYS.includes(d.daysLeft))

  let reminded = 0
  if (dueSoon.length > 0) {
    // 締切日時ごとにまとめて1通で送る
    const groups = new Map<string, { daysLeft: number; names: string[] }>()
    for (const d of dueSoon) {
      const g = groups.get(d.deadline_at) ?? { daysLeft: d.daysLeft, names: [] }
      g.names.push(d.document_name)
      groups.set(d.deadline_at, g)
    }
    const sections = Array.from(groups.entries()).map(([iso, g]) => {
      const left = g.daysLeft === 0 ? '本日締切' : `あと${g.daysLeft}日`
      return `▼${formatDeadlineLabel(iso)}締切（${left}）\n${g.names.map(n => `・${n}`).join('\n')}`
    })
    const text = `【体育会 書類締切】\n未提出の書類があります。\n\n${sections.join('\n\n')}\n\n提出済みの場合はアプリでチェックをお願いします。`
    if (await sendLineMulticast(targets, text)) reminded = targets.length
  }

  return NextResponse.json({
    synced: scrape.deadlines.length,
    deactivated,
    dueSoon: dueSoon.length,
    reminded,
  })
}
