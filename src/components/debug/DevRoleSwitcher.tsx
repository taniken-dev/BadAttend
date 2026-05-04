'use client'

import { useState } from 'react'
import { Wrench, X } from 'lucide-react'
import { useViewRole } from '@/contexts/ViewRoleContext'
import type { Role } from '@/lib/types'

// このコンポーネントは process.env.NODE_ENV === 'development' の場合のみレンダリング
// 本番ビルドではバンドルから除外される

const ROLES: { value: Role; label: string; color: string; bg: string }[] = [
  { value: 'admin',   label: '管理者',       color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'manager', label: 'マネージャー', color: '#0284c7', bg: '#e0f2fe' },
  { value: 'member',  label: '部員',         color: '#16a34a', bg: '#f0fdf4' },
  { value: 'coach',   label: '顧問',         color: '#b45309', bg: '#fef3c7' },
]

export default function DevRoleSwitcher() {
  if (process.env.NODE_ENV !== 'development') return null

  return <DevRoleSwitcherInner />
}

function DevRoleSwitcherInner() {
  const { realRole, viewRole, setViewRole } = useViewRole()
  const [open, setOpen] = useState(false)

  const currentRole = ROLES.find(r => r.value === viewRole)
  const isOverriding = viewRole !== realRole

  return (
    <div
      className="fixed z-[200]"
      style={{ bottom: '5rem', right: '1rem' }}
    >
      {/* ポップアップメニュー */}
      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 rounded-2xl overflow-hidden animate-fade-in"
          style={{
            width: '13rem',
            background: 'var(--card-bg)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--gray-200)',
          }}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-3 py-2.5"
            style={{ borderBottom: '1px solid var(--gray-100)' }}>
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--gray-900)' }}>
                🔧 Dev: ロール切替
              </p>
              <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
                UIのみ。DBアクセス権は変わりません
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ color: 'var(--gray-400)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <X size={13} />
            </button>
          </div>

          {/* ロール選択肢 */}
          {ROLES.map(r => {
            const isActive = viewRole === r.value
            const isReal   = realRole === r.value
            return (
              <button
                key={r.value}
                onClick={() => { setViewRole(r.value); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                style={{
                  background: isActive ? r.bg : 'transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: isActive ? r.color : 'var(--gray-300)' }}
                />
                <span
                  className="flex-1 text-sm font-medium"
                  style={{ color: isActive ? r.color : 'var(--gray-700)' }}
                >
                  {r.label}
                </span>
                <span className="flex items-center gap-1">
                  {isReal && (
                    <span className="text-xs px-1 py-0.5 rounded"
                      style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', fontSize: '10px' }}>
                      本来
                    </span>
                  )}
                  {isActive && !isReal && (
                    <span className="text-xs px-1 py-0.5 rounded"
                      style={{ background: r.bg, color: r.color, fontSize: '10px' }}>
                      表示中
                    </span>
                  )}
                </span>
              </button>
            )
          })}

          {/* リセット */}
          {isOverriding && realRole && (
            <div style={{ borderTop: '1px solid var(--gray-100)' }}>
              <button
                onClick={() => { setViewRole(realRole); setOpen(false) }}
                className="w-full px-3 py-2.5 text-xs font-medium text-left transition-colors"
                style={{ color: '#dc2626' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fef2f2'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                ↩ 本来のロールに戻す
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB ボタン */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-95"
        title={`Dev: ${currentRole?.label ?? '?'} として表示中`}
        style={{
          background: currentRole?.color ?? '#64748b',
          boxShadow: isOverriding
            ? `0 0 0 3px ${currentRole?.bg ?? '#f1f5f9'}, 0 4px 12px rgba(0,0,0,0.2)`
            : '0 4px 12px rgba(0,0,0,0.2)',
          color: 'white',
        }}
      >
        <Wrench size={17} strokeWidth={2} />
      </button>

      {/* オーバーライド中のラベル */}
      {isOverriding && (
        <div
          className="absolute bottom-full mb-1 right-0 text-xs font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap"
          style={{
            background: currentRole?.color ?? '#64748b',
            color: 'white',
            marginBottom: '52px',
            fontSize: '10px',
          }}
        >
          {currentRole?.label}
        </div>
      )}
    </div>
  )
}
