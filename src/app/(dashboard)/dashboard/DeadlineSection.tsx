'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useViewRole } from '@/contexts/ViewRoleContext'
import { FileText, Check, ExternalLink, AlertTriangle } from 'lucide-react'
import type { DocumentDeadline } from '@/lib/types'

export type DeadlineWithSubmitter = DocumentDeadline & {
  submitter: { full_name: string; display_name: string | null } | null
}

function formatDeadlineLabel(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short',
  })
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false,
  }).format(d))
  return `${date} ${hour}時`
}

// JST の暦日ベースで残り日数を数える
function daysUntilJst(iso: string): number {
  const toJstDateStr = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d)
  const target = new Date(toJstDateStr(new Date(iso)) + 'T00:00:00Z')
  const today = new Date(toJstDateStr(new Date()) + 'T00:00:00Z')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function daysLeftBadge(iso: string): { label: string; bg: string; color: string } {
  const days = daysUntilJst(iso)
  if (days < 0)  return { label: '期限超過', bg: '#ffe2dd', color: '#a8423d' }
  if (days === 0) return { label: '本日締切', bg: '#ffe2dd', color: '#a8423d' }
  if (days <= 3) return { label: `あと${days}日`, bg: '#fdecc8', color: '#8a5d22' }
  return { label: `あと${days}日`, bg: 'var(--gray-100)', color: 'var(--gray-500)' }
}

export default function DeadlineSection({
  deadlines,
  lastFetchedAt,
  currentUserId,
  siteUrl,
}: {
  deadlines: DeadlineWithSubmitter[]
  lastFetchedAt: string | null
  currentUserId: string
  siteUrl: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const { realRole, viewRole } = useViewRole()
  const [updating, setUpdating] = useState<string | null>(null)

  // Devロール切替でのプレビュー中は「幹部フラグなしのそのロール」として扱い、
  // 管理者ビュー以外では隠す（実際のロールで見ている場合はサーバー判定に従う）
  const previewing = realRole !== null && viewRole !== null && viewRole !== realRole
  if (previewing && viewRole !== 'admin') return null

  async function toggleSubmitted(d: DeadlineWithSubmitter) {
    setUpdating(d.id)
    const { error } = await supabase
      .from('document_deadlines')
      .update(
        d.submitted_at
          ? { submitted_at: null, submitted_by: null }
          : { submitted_at: new Date().toISOString(), submitted_by: currentUserId }
      )
      .eq('id', d.id)
    setUpdating(null)
    if (!error) router.refresh()
  }

  const hasOverdue = deadlines.some(d => !d.submitted_at && daysUntilJst(d.deadline_at) < 0)

  return (
    <div className="card animate-slide-up" style={{ animationDelay: '0.05s' }}>
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} style={{ color: 'var(--club-blue)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
          提出書類の締切（体育会）
        </h2>
        <span
          className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--club-blue-muted)', color: 'var(--club-blue)' }}
        >
          幹部向け
        </span>
      </div>

      {hasOverdue && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: '#fdebec', color: '#a8423d', border: '1px solid #f2c7c2' }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>締切を過ぎた未提出の書類があります。至急確認してください。</span>
        </div>
      )}

      {deadlines.length === 0 ? (
        <p className="text-sm py-2" style={{ color: 'var(--gray-400)' }}>
          提出期限が近い書類はありません
        </p>
      ) : (
        <div className="flex flex-col">
          {deadlines.map(d => {
            const submitted = !!d.submitted_at
            const badge = daysLeftBadge(d.deadline_at)
            const submitterName = d.submitter
              ? (d.submitter.display_name ?? d.submitter.full_name)
              : null
            return (
              <div key={d.id} className="flex items-center gap-3 py-2.5"
                style={{ opacity: updating === d.id ? 0.5 : 1 }}>
                {/* 提出しましたチェック */}
                <button
                  onClick={() => toggleSubmitted(d)}
                  disabled={updating === d.id}
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-95"
                  style={submitted
                    ? { background: '#448361', color: 'white' }
                    : { background: 'var(--gray-50)', border: '1.5px solid var(--gray-300)' }}
                  title={submitted ? '提出済みを取り消す' : '提出しました'}
                >
                  {submitted && <Check size={14} />}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: submitted ? 'var(--gray-400)' : 'var(--gray-900)',
                      textDecoration: submitted ? 'line-through' : 'none',
                    }}
                  >
                    {d.document_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
                    {formatDeadlineLabel(d.deadline_at)}締切
                    {submitted && submitterName && ` · ${submitterName}が提出済み`}
                  </p>
                </div>

                {submitted ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: '#dbeddb', color: '#2f5f44' }}>
                    提出済み
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--gray-100)' }}>
        <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
          {lastFetchedAt
            ? `最終取得: ${new Date(lastFetchedAt).toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}`
            : '未取得（体育会HPと同期されていません）'}
        </span>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--club-blue)' }}
        >
          体育会HP
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}
