'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, X, Plus } from 'lucide-react'
import {
  CARD_SOURCE_LABELS,
  formatMonthLabel,
  isActive,
  summarizeCards,
  yellowsBehindRed,
  type Card,
} from '@/lib/cards'
import { formatJst } from '@/lib/utils'
import { formatDateLabel } from '@/lib/registration'

export const YELLOW_STYLE = { background: '#fdecc8', color: '#8a5d22', border: '1px solid #e3c47f' }
export const RED_STYLE    = { background: '#ffe2dd', color: '#a8423d', border: '1px solid #e5a49e' }

/** メンバー管理画面の、1人分のカード表示（枚数のバッジ・内訳のポップアップ・手動イエロー） */
export default function MemberCards({
  userId,
  name,
  cards,
  sessionDates,
  today,
  canAddYellow,
  canResolveRed,
  absenceStreak = 0,
}: {
  userId:        string
  name:          string
  cards:         Card[]                  // この部員のカード（解除・取り消し済みも含む）
  sessionDates:  Record<string, string>  // session_id → 練習日
  today:         string                  // JST の今日（YYYY-MM-DD）
  canAddYellow:  boolean                 // manager / admin
  canResolveRed: boolean                 // admin
  absenceStreak?: number                 // 今いくつ続けて通常練習を休んでいるか（manager/admin にだけ渡す）
}) {
  const [open, setOpen] = useState(false)
  const { yellowThisMonth, redActive } = summarizeCards(cards, today)

  if (yellowThisMonth === 0 && redActive === 0 && !canAddYellow && cards.length === 0 && absenceStreak === 0) return null

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {redActive > 0 && (
          <button type="button" onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80"
            style={RED_STYLE}>
            <AlertTriangle size={11} />
            レッドカード {redActive}枚
          </button>
        )}
        {yellowThisMonth > 0 && (
          <button type="button" onClick={() => setOpen(true)}
            className="text-xs font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80"
            style={YELLOW_STYLE}>
            イエロー {yellowThisMonth}枚（今月）
          </button>
        )}
        {absenceStreak > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)' }}
            title="今いくつ続けて通常練習を休んでいるか（部員には見えません）">
            連続欠席 {absenceStreak}回
          </span>
        )}
        {(canAddYellow || (cards.length > 0 && redActive === 0 && yellowThisMonth === 0)) && (
          <button type="button" onClick={() => setOpen(true)}
            className="text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', border: '1px solid var(--gray-200)' }}>
            カード
          </button>
        )}
      </div>
      {/* 一覧の各行は contain を指定しているので、ポップアップは body 直下に出す */}
      {open && createPortal(
        <CardDetailModal
          userId={userId}
          name={name}
          cards={cards}
          sessionDates={sessionDates}
          today={today}
          canAddYellow={canAddYellow}
          canResolveRed={canResolveRed}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  )
}

function cardDateLabel(c: Card, sessionDates: Record<string, string>): string {
  const d = c.session_id ? sessionDates[c.session_id] : null
  return d ? `${formatDateLabel(d)}の練習` : formatJst(c.created_at, { month: 'numeric', day: 'numeric' }) + 'に付与'
}

function CardDetailModal({
  userId, name, cards, sessionDates, today, canAddYellow, canResolveRed, onClose,
}: {
  userId: string; name: string; cards: Card[]; sessionDates: Record<string, string>; today: string
  canAddYellow: boolean; canResolveRed: boolean; onClose: () => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const month = `${today.slice(0, 7)}-01`
  const reds = cards
    .filter(c => c.color === 'red')
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.created_at.localeCompare(a.created_at))
  const yellowsThisMonth = cards
    .filter(c => c.color === 'yellow' && c.period_month === month)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const dateOf = (c: Card) => (c.session_id ? sessionDates[c.session_id] ?? null : null)

  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key)
    setError(null)
    const { error } = await fn()
    setBusy(null)
    if (error) { setError(error.message); return false }
    router.refresh()
    return true
  }

  async function resolve(card: Card) {
    const what = card.color === 'red' ? 'このレッドを消します' : 'このイエローを取り消します'
    if (!confirm(`${what}。よろしいですか？（履歴は残ります）`)) return
    await run(card.id, () => supabase.rpc('resolve_card', { p_card: card.id }))
  }

  async function addYellow() {
    if (!reason.trim()) return
    const ok = await run('add', () => supabase.rpc('add_manual_yellow', { p_user: userId, p_reason: reason.trim() }))
    if (ok) setReason('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-4"
        style={{ borderRadius: '16px 16px 0 0' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>{name} のカード</h2>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ color: 'var(--gray-500)' }} aria-label="閉じる">
            <X size={16} />
          </button>
        </div>

        {error && <p className="alert-error text-xs">{error}</p>}

        {/* レッド */}
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold" style={{ color: '#a8423d' }}>レッドカード</h3>
          {reds.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--gray-400)' }}>ありません</p>
          ) : reds.map(r => {
            const behind = yellowsBehindRed(r, cards, dateOf)
            return (
              <div key={r.id} className="rounded-xl p-3 flex flex-col gap-1.5"
                style={isActive(r) ? RED_STYLE : { background: 'var(--gray-50)', color: 'var(--gray-500)', border: '1px solid var(--gray-200)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold flex-1">
                    {r.source === 'yellow_limit'
                      ? `${formatMonthLabel(r.period_month)}のイエローの累積`
                      : r.source === 'streak' && r.range_from && r.range_to
                      ? `連続欠席（${formatDateLabel(r.range_from)}〜${formatDateLabel(r.range_to)}）`
                      : CARD_SOURCE_LABELS[r.source]}
                  </span>
                  {isActive(r) ? (
                    canResolveRed && (
                      <button type="button" onClick={() => resolve(r)} disabled={busy === r.id}
                        className="text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer hover:opacity-80"
                        style={{ background: 'white', color: '#a8423d', border: '1px solid #e5a49e' }}>
                        {busy === r.id ? '処理中...' : '消す'}
                      </button>
                    )
                  ) : (
                    <span className="text-xs">解除済み（{formatJst(r.resolved_at!, { month: 'numeric', day: 'numeric' })}）</span>
                  )}
                </div>
                <p className="text-xs">{formatJst(r.created_at, { month: 'numeric', day: 'numeric' })}に記録</p>
                {behind.length > 0 && (
                  <ul className="text-xs flex flex-col gap-0.5 mt-1">
                    {behind.map(y => (
                      <li key={y.id}>・{cardDateLabel(y, sessionDates)}：{CARD_SOURCE_LABELS[y.source]}{y.reason ? `（${y.reason}）` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </section>

        {/* 今月のイエロー */}
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold" style={{ color: '#8a5d22' }}>今月のイエロー</h3>
          {yellowsThisMonth.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--gray-400)' }}>ありません</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {yellowsThisMonth.map(y => (
                <li key={y.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={isActive(y) ? YELLOW_STYLE : { background: 'var(--gray-50)', color: 'var(--gray-400)', border: '1px solid var(--gray-200)' }}>
                  <span className="flex-1">
                    {cardDateLabel(y, sessionDates)}：{CARD_SOURCE_LABELS[y.source]}{y.reason ? `（${y.reason}）` : ''}
                    {!isActive(y) && '・取り消し済み'}
                  </span>
                  {canAddYellow && y.source === 'manual' && isActive(y) && (
                    <button type="button" onClick={() => resolve(y)} disabled={busy === y.id}
                      className="font-semibold px-2 py-0.5 rounded cursor-pointer hover:opacity-80"
                      style={{ background: 'white', color: '#8a5d22', border: '1px solid #e3c47f' }}>
                      {busy === y.id ? '処理中...' : '取り消す'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 手動イエロー（練習に結びつかない理由。練習ごとの分は実績確定画面から） */}
        {canAddYellow && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-bold" style={{ color: 'var(--gray-700)' }}>イエローを付ける</h3>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              className="input-field resize-none" rows={2} maxLength={200}
              placeholder="理由（必須）。練習ごとの欠席は、カレンダーの実績確定画面から付けてください" />
            <button type="button" onClick={addYellow} disabled={!reason.trim() || busy === 'add'}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
              style={YELLOW_STYLE}>
              <Plus size={14} />
              {busy === 'add' ? '処理中...' : 'イエローを付ける'}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
