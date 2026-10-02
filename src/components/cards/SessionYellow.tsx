'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CARD_SOURCE_LABELS, isActive, type Card } from '@/lib/cards'
import { YELLOW_STYLE } from './MemberCards'

/** 実績確定画面の1人分：この練習で付いたイエローの表示と、手動イエロー（理由つき）の付与・取り消し */
export default function SessionYellow({
  userId,
  sessionId,
  cards,
  onChanged,
}: {
  userId:    string
  sessionId: string
  cards:     Card[]  // この部員の、この練習のカード
  onChanged: () => void
}) {
  const supabase = createClient()
  const [formOpen, setFormOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = cards.filter(c => c.color === 'yellow' && isActive(c))

  async function add() {
    if (!reason.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('add_manual_yellow', {
      p_user: userId, p_reason: reason.trim(), p_session: sessionId,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setReason('')
    setFormOpen(false)
    onChanged()
  }

  async function cancel(card: Card) {
    if (!confirm('このイエローを取り消します。よろしいですか？（履歴は残ります）')) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('resolve_card', { p_card: card.id })
    setBusy(false)
    if (error) { setError(error.message); return }
    onChanged()
  }

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {active.map(c => (
          <span key={c.id} className="flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded" style={YELLOW_STYLE}>
            イエロー：{CARD_SOURCE_LABELS[c.source]}{c.reason ? `（${c.reason}）` : ''}
            {c.source === 'manual' && (
              <button type="button" onClick={() => cancel(c)} disabled={busy}
                className="underline cursor-pointer ml-0.5" style={{ fontSize: '10px' }}>
                取り消す
              </button>
            )}
          </span>
        ))}
        {!formOpen && (
          <button type="button" onClick={() => setFormOpen(true)}
            className="text-xs px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', border: '1px solid var(--gray-200)' }}>
            ＋イエロー
          </button>
        )}
      </div>
      {formOpen && (
        <div className="flex items-center gap-1.5">
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="理由（必須）例：部会を欠席" maxLength={200} autoFocus
            className="input-field flex-1" style={{ padding: '4px 8px', fontSize: '12px' }} />
          <button type="button" onClick={add} disabled={busy || !reason.trim()}
            className="text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50" style={YELLOW_STYLE}>
            {busy ? '処理中...' : '付ける'}
          </button>
          <button type="button" onClick={() => { setFormOpen(false); setReason(''); setError(null) }}
            className="text-xs px-2 py-1 rounded-lg cursor-pointer"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
            やめる
          </button>
        </div>
      )}
      {error && <p className="text-xs" style={{ color: '#a8423d' }}>{error}</p>}
    </div>
  )
}
