'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  CheckCircle2,
  XCircle,
  ChevronDown,
  AlertTriangle,
  Shield,
  Crown,
  GraduationCap,
} from 'lucide-react'
import type { Profile, SkillRank } from '@/lib/types'
import { getSkillRankLabel } from '@/lib/utils'

const SKILL_RANK_OPTIONS: { value: SkillRank; label: string }[] = [
  { value: 1, label: '1 — E級' },
  { value: 2, label: '2 — D級' },
  { value: 3, label: '3 — C級（標準）' },
  { value: 4, label: '4 — B級' },
  { value: 5, label: '5 — A級' },
  { value: 6, label: '6 — S級' },
]

const ROLE_OPTIONS = [
  { value: 'member',  label: '部員',   icon: Users },
  { value: 'captain', label: '主将',   icon: Crown },
  { value: 'admin',   label: '管理者', icon: Shield },
]

export default function MembersManager({
  members,
  currentUserId,
}: {
  members: Profile[]
  currentUserId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const pending  = members.filter(m => !m.is_approved)
  const approved = members.filter(m => m.is_approved)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function approve(id: string) {
    setUpdating(id)
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: true })
      .eq('id', id)
    setUpdating(null)
    if (error) { showToast('エラーが発生しました', false); return }
    showToast('承認しました', true)
    router.refresh()
  }

  async function reject(id: string) {
    if (!confirm('このユーザーを削除しますか？この操作は取り消せません。')) return
    setUpdating(id)
    // auth.users の削除は service_role が必要なため、ここでは is_approved を false のまま
    // 代替: プロフィールに rejected フラグを立てる（今回は approved=false のまま放置）
    showToast('拒否しました（プロフィールは残ります）', false)
    setUpdating(null)
  }

  async function updateSkillRank(id: string, rank: number) {
    setUpdating(id)
    const { error } = await supabase
      .from('profiles')
      .update({ skill_rank: rank })
      .eq('id', id)
    setUpdating(null)
    if (error) { showToast('更新失敗', false); return }
    showToast('技術ランクを更新しました', true)
    router.refresh()
  }

  async function updateRole(id: string, role: string) {
    setUpdating(id)
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
    setUpdating(null)
    if (error) { showToast('更新失敗', false); return }
    showToast('権限を更新しました', true)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up">
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}
        >
          メンバー管理
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          承認・技術ランク設定・権限管理
        </p>
      </div>

      {/* トースト */}
      {toast && (
        <div
          className={toast.ok ? 'alert-success' : 'alert-error'}
          style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 100, minWidth: 240, maxWidth: 340 }}
        >
          {toast.ok
            ? <CheckCircle2 size={15} className="shrink-0" />
            : <AlertTriangle size={15} className="shrink-0" />
          }
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 承認待ち */}
      {pending.length > 0 && (
        <div className="card animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: '#dc2626' }}
            >
              {pending.length}
            </div>
            <h2
              className="text-base font-bold"
              style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}
            >
              承認待ち
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {pending.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-3.5 rounded-xl"
                style={{
                  background: 'var(--gray-50)',
                  border: '1.5px solid var(--gray-200)',
                  opacity: updating === m.id ? 0.6 : 1,
                }}
              >
                {/* アバター */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                  style={{ background: '#fef3c7', color: '#b45309' }}
                >
                  {m.full_name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                    {m.full_name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {m.grade}年生
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => reject(m.id)}
                    disabled={updating === m.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      background: '#fef2f2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <XCircle size={13} />
                    拒否
                  </button>
                  <button
                    onClick={() => approve(m.id)}
                    disabled={updating === m.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      background: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    {updating === m.id ? (
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    承認
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 承認済み部員 */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-bold"
            style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}
          >
            部員一覧
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}
          >
            {approved.length} 名
          </span>
        </div>

        {approved.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Users size={28} style={{ color: 'var(--gray-300)' }} />
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
              承認済みの部員がいません
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {approved.map(m => {
              const RoleIcon = ROLE_OPTIONS.find(r => r.value === m.role)?.icon ?? Users
              const isMe = m.id === currentUserId

              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl"
                  style={{
                    border: `1.5px solid ${isMe ? 'var(--club-blue-light)' : 'var(--gray-200)'}`,
                    background: isMe ? 'var(--club-blue-muted)' : 'var(--gray-50)',
                    opacity: updating === m.id ? 0.6 : 1,
                  }}
                >
                  {/* 上段：名前・学年・自分バッジ */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                      style={{
                        background: isMe ? 'var(--club-blue-light)' : 'var(--gray-200)',
                        color: isMe ? 'var(--club-blue)' : 'var(--gray-600)',
                      }}
                    >
                      {m.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                          {m.full_name}
                        </span>
                        {isMe && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'var(--club-blue)', color: 'white' }}
                          >
                            自分
                          </span>
                        )}
                        <RoleIcon size={13} style={{ color: 'var(--gray-400)' }} />
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--gray-500)' }}>
                        <GraduationCap size={11} />
                        {m.grade}年生
                        <span className="ml-1">·</span>
                        <span>{getSkillRankLabel(m.skill_rank)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 下段：技術ランク・ロール選択 */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* 技術ランク */}
                    <div>
                      <label className="label" style={{ fontSize: '11px' }}>
                        技術ランク
                      </label>
                      <div className="relative">
                        <select
                          value={m.skill_rank}
                          onChange={e => updateSkillRank(m.id, Number(e.target.value))}
                          disabled={updating === m.id}
                          className="input-field pr-8 text-sm"
                          style={{ padding: '7px 32px 7px 10px', fontSize: '13px' }}
                        >
                          {SKILL_RANK_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: 'var(--gray-400)' }}
                        />
                      </div>
                    </div>

                    {/* 権限 */}
                    <div>
                      <label className="label" style={{ fontSize: '11px' }}>
                        権限
                      </label>
                      <div className="relative">
                        <select
                          value={m.role}
                          onChange={e => updateRole(m.id, e.target.value)}
                          disabled={updating === m.id || isMe}
                          className="input-field pr-8 text-sm"
                          style={{ padding: '7px 32px 7px 10px', fontSize: '13px' }}
                        >
                          {ROLE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: 'var(--gray-400)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 注意書き */}
      <div
        className="text-xs leading-relaxed px-4 py-3 rounded-xl animate-slide-up"
        style={{
          animationDelay: '0.15s',
          background: 'var(--gray-100)',
          color: 'var(--gray-500)',
          borderLeft: '3px solid var(--gray-300)',
        }}
      >
        技術ランクの変更は選考スコアに即時反映されます。
        権限変更は自分自身には適用できません。
      </div>
    </div>
  )
}
