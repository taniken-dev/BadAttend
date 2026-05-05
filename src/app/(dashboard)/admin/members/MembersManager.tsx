'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  CheckCircle2,
  Trash2,
  ChevronDown,
  AlertTriangle,
  Shield,
  GraduationCap,
  Pencil,
  X,
  Check,
  UserPlus,
} from 'lucide-react'
import type { Profile, SkillRank } from '@/lib/types'
import { getSkillRankLabel } from '@/lib/utils'
import { useViewRole } from '@/contexts/ViewRoleContext'
import type { OrphanUser } from './page'

const SKILL_RANK_OPTIONS: { value: SkillRank; label: string }[] = [
  { value: 1, label: '1 — E級' },
  { value: 2, label: '2 — D級' },
  { value: 3, label: '3 — C級（標準）' },
  { value: 4, label: '4 — B級' },
  { value: 5, label: '5 — A級' },
  { value: 6, label: '6 — S級' },
]

const GRADE_OPTIONS = [1, 2, 3, 4]

const ROLE_OPTIONS = [
  { value: 'member',  label: '部員',         icon: Users },
  { value: 'manager', label: 'マネージャー', icon: Shield },
  { value: 'admin',   label: '管理者',       icon: Shield },
  { value: 'coach',   label: '顧問',         icon: GraduationCap },
]

function displayName(m: Pick<Profile, 'full_name' | 'display_name'>) {
  return m.display_name ?? m.full_name
}

export default function MembersManager({
  members,
  currentUserId,
  readOnly = false,
  orphanUsers = [],
}: {
  members: Profile[]
  currentUserId: string
  readOnly?: boolean
  orphanUsers?: OrphanUser[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const { viewRole } = useViewRole()
  // デバッグスイッチャーでロールを変更した場合もreadOnlyを反映
  const effectiveReadOnly  = readOnly || viewRole !== 'admin'
  const canSeeSkillRank   = viewRole === 'admin' || viewRole === 'coach'
  const [updating, setUpdating]     = useState<string | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [editName, setEditName]     = useState('')
  const [saving, setSaving]         = useState(false)

  const pending  = useMemo(() => members.filter(m => !m.is_approved), [members])
  const approved = useMemo(() => members.filter(m => m.is_approved),  [members])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function openEdit(m: Profile) {
    setEditTarget(m.id)
    setEditName(m.display_name ?? '')
  }

  async function saveDisplayName() {
    if (!editTarget) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: editName.trim() || null })
      .eq('id', editTarget)
    setSaving(false)
    if (error) { showToast('更新失敗', false); return }
    showToast('表示名を更新しました', true)
    setEditTarget(null)
    router.refresh()
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

  async function approveOrphan(orphan: OrphanUser) {
    setUpdating(orphan.id)
    const { error } = await supabase.from('profiles').insert({
      id:         orphan.id,
      full_name:  orphan.full_name,
      grade:      1,
      role:       'member',
      skill_rank: 3,
      is_approved: true,
    })
    setUpdating(null)
    if (error) { showToast('プロフィール作成失敗: ' + error.message, false); return }
    showToast(`${orphan.full_name} を承認しました`, true)
    router.refresh()
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(`「${name}」を退部処理しますか？\nアカウントと全データが削除されます。この操作は取り消せません。`)) return
    setUpdating(id)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    setUpdating(null)
    if (!res.ok) { showToast('削除に失敗しました', false); return }
    showToast(`${name} を退部処理しました`, true)
    router.refresh()
  }

  async function updateSkillRank(id: string, rank: number) {
    setUpdating(id)
    const { error } = await supabase.from('profiles').update({ skill_rank: rank }).eq('id', id)
    setUpdating(null)
    if (error) { showToast('更新失敗', false); return }
    showToast('技術ランクを更新しました', true)
    router.refresh()
  }

  async function updateGrade(id: string, grade: number) {
    setUpdating(id)
    const { error } = await supabase.from('profiles').update({ grade }).eq('id', id)
    setUpdating(null)
    if (error) { showToast('更新失敗', false); return }
    showToast('学年を更新しました', true)
    router.refresh()
  }

  async function updateRole(id: string, role: string) {
    setUpdating(id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
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
          {effectiveReadOnly ? 'メンバー一覧' : 'メンバー管理'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          {effectiveReadOnly ? '部員・技術ランク・出席状況の閲覧（読み取り専用）' : '承認・表示名・学年・技術ランク・権限・退部管理'}
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

      {/* 孤立ユーザー警告（プロフィール未作成） */}
      {orphanUsers.length > 0 && (
        <div className="card animate-slide-up" style={{ border: '1.5px solid #fca5a5', animationDelay: '0.03s' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#dc2626' }}>
              {orphanUsers.length}
            </div>
            <h2 className="text-base font-bold" style={{ color: '#b91c1c', letterSpacing: '-0.02em' }}>
              プロフィール未作成のユーザー
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--gray-500)' }}>
            LINEでログインしたがプロフィールが自動作成されなかったユーザーです。承認すると部員一覧に即時追加されます。
          </p>
          <div className="flex flex-col gap-3">
            {orphanUsers.map(o => (
              <div key={o.id} className="flex items-center gap-3 p-3.5 rounded-xl"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', opacity: updating === o.id ? 0.6 : 1 }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                  style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {o.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>{o.full_name}</p>
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {new Date(o.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => approveOrphan(o)}
                  disabled={updating === o.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity cursor-pointer active:scale-95 hover:opacity-80"
                  style={{ background: 'var(--club-blue)', color: 'white' }}
                >
                  <UserPlus size={13} />
                  承認する
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 承認待ち（effectiveReadOnly では非表示） */}
      {!effectiveReadOnly && pending.length > 0 && (
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
                  willChange: 'transform',
                  contain: 'layout style',
                }}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: '#fef3c7', color: '#b45309' }}
                  >
                    {displayName(m).charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                    {displayName(m)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    LINEネーム: {m.full_name} · {m.grade}年生
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => deleteMember(m.id, displayName(m))}
                    disabled={updating === m.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity cursor-pointer active:scale-95 hover:opacity-80"
                    style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                  >
                    <Trash2 size={13} />
                    拒否
                  </button>
                  <button
                    onClick={() => approve(m.id)}
                    disabled={updating === m.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity cursor-pointer active:scale-95 hover:opacity-80"
                    style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
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
              const hasDisplayName = !!m.display_name

              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl"
                  style={{
                    border: `1.5px solid ${isMe ? 'var(--club-blue-light)' : 'var(--gray-200)'}`,
                    background: isMe ? 'var(--club-blue-muted)' : 'var(--gray-50)',
                    opacity: updating === m.id ? 0.6 : 1,
                    willChange: 'transform',
                    contain: 'layout style',
                  }}
                >
                  {/* 上段：名前・バッジ */}
                  <div className="flex items-center gap-3 mb-3">
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url} alt=""
                        width={40} height={40}
                        className="w-10 h-10 rounded-xl object-cover shrink-0"
                        style={{ outline: isMe ? '2px solid var(--club-blue)' : 'none', outlineOffset: '1px' }}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                        style={{
                          background: isMe ? 'var(--club-blue-light)' : 'var(--gray-200)',
                          color: isMe ? 'var(--club-blue)' : 'var(--gray-600)',
                        }}
                      >
                        {displayName(m).charAt(0)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 表示名インライン編集 */}
                        {!effectiveReadOnly && editTarget === m.id ? (
                          <>
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveDisplayName()
                                if (e.key === 'Escape') setEditTarget(null)
                              }}
                              autoFocus
                              className="text-sm font-bold bg-transparent outline-none border-b"
                              style={{ color: 'var(--gray-900)', borderColor: 'var(--club-blue)', minWidth: '80px', maxWidth: '160px' }}
                            />
                            <button
                              onClick={saveDisplayName}
                              disabled={saving}
                              className="w-5 h-5 rounded flex items-center justify-center cursor-pointer transition-opacity"
                              style={{ color: 'var(--club-blue)' }}
                            >
                              {saving
                                ? <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                : <Check size={13} />}
                            </button>
                            <button
                              onClick={() => setEditTarget(null)}
                              className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
                              style={{ color: 'var(--gray-400)' }}
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            {hasDisplayName ? (
                              <span className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                                {m.display_name}
                              </span>
                            ) : (
                              <span
                                className="text-sm font-bold px-1.5 py-0.5 rounded"
                                style={{ background: '#fef3c7', color: '#b45309', fontSize: '12px' }}
                              >
                                未設定
                              </span>
                            )}
                            {!effectiveReadOnly && (
                              <button
                                onClick={() => openEdit(m)}
                                disabled={updating === m.id}
                                className="w-4 h-4 flex items-center justify-center cursor-pointer transition-opacity opacity-40 hover:opacity-100"
                                style={{ color: 'var(--gray-600)' }}
                                title="表示名を編集"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                          </>
                        )}
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
                      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
                        <span>LINE: {m.full_name}</span>
                        <span className="mx-0.5">·</span>
                        <GraduationCap size={11} />
                        <span>{m.grade}年生</span>
                        {!effectiveReadOnly && (
                          <>
                            <span className="mx-0.5">·</span>
                            <span>{getSkillRankLabel(m.skill_rank)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 退部ボタン（effectiveReadOnly では非表示） */}
                    {!effectiveReadOnly && !isMe && (
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => deleteMember(m.id, displayName(m))}
                          disabled={updating === m.id}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-opacity cursor-pointer active:scale-95 hover:opacity-80"
                          style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                          title="退部処理"
                        >
                          <Trash2 size={12} />
                          <span className="hidden sm:inline">退部</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 下段：学年・（技術ランクはadminのみ）・ロール */}
                  {effectiveReadOnly ? (
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--gray-500)' }}>
                      <span>{m.grade}年生</span>
                      <span>·</span>
                      <span>{ROLE_OPTIONS.find(r => r.value === m.role)?.label ?? m.role}</span>
                      {canSeeSkillRank && (
                        <>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: 'var(--gray-700)' }}>
                            {getSkillRankLabel(m.skill_rank)}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {/* 学年 */}
                    <div>
                      <label className="label" style={{ fontSize: '11px' }}>学年</label>
                      <div className="relative">
                        <select
                          value={m.grade}
                          onChange={e => updateGrade(m.id, Number(e.target.value))}
                          disabled={updating === m.id}
                          className="input-field pr-8"
                          style={{ padding: '7px 32px 7px 10px', fontSize: '13px' }}
                        >
                          {GRADE_OPTIONS.map(g => (
                            <option key={g} value={g}>{g}年生</option>
                          ))}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: 'var(--gray-400)' }}
                        />
                      </div>
                    </div>

                    {/* 技術ランク */}
                    <div>
                      <label className="label" style={{ fontSize: '11px' }}>技術ランク</label>
                      <div className="relative">
                        <select
                          value={m.skill_rank}
                          onChange={e => updateSkillRank(m.id, Number(e.target.value))}
                          disabled={updating === m.id}
                          className="input-field pr-8"
                          style={{ padding: '7px 32px 7px 10px', fontSize: '13px' }}
                        >
                          {SKILL_RANK_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
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
                      <label className="label" style={{ fontSize: '11px' }}>権限</label>
                      <div className="relative">
                        <select
                          value={m.role}
                          onChange={e => updateRole(m.id, e.target.value)}
                          disabled={updating === m.id || isMe}
                          className="input-field pr-8"
                          style={{ padding: '7px 32px 7px 10px', fontSize: '13px' }}
                        >
                          {ROLE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
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
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 注意書き（effectiveReadOnly では非表示） */}
      {!effectiveReadOnly && (
        <div
          className="text-xs leading-relaxed px-4 py-3 rounded-xl animate-slide-up"
          style={{
            animationDelay: '0.15s',
            background: 'color-mix(in srgb, #f59e0b 8%, var(--card-bg))',
            color: 'var(--gray-600)',
            border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
            borderLeft: '3px solid #f59e0b',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          退部処理を行うとアカウントと全データが完全に削除されます。この操作は取り消せません。
        </div>
      )}
    </div>
  )
}
