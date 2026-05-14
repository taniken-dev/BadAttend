'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import { useViewRole } from '@/contexts/ViewRoleContext'
import {
  Feather,
  LayoutDashboard,
  CalendarDays,
  Users,
  LogOut,
  Sun,
  Moon,
  MoreHorizontal,
  MessageSquarePlus,
  Inbox,
  X,
  Send,
  CheckCircle2,
  Settings,
} from 'lucide-react'

// モバイル ボトムタブ定義
const MOBILE_TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'ホーム' },
  { href: '/calendar',  icon: CalendarDays,    label: 'カレンダー' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { isDark, toggle } = useTheme()

  const [showGear,       setShowGear]      = useState(false)
  const [showMore,       setShowMore]      = useState(false)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [sugTitle,       setSugTitle]      = useState('')
  const [sugBody,        setSugBody]       = useState('')
  const [submitting,     setSubmitting]    = useState(false)
  const [submitted,      setSubmitted]     = useState(false)
  const [submitError,    setSubmitError]   = useState(false)

  const gearRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  const { viewRole } = useViewRole()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setShowGear(false)
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const role    = viewRole
  const isAdmin = role === 'admin'
  const isCoach = role === 'coach'

  // ── PC 左ナビ（ホーム・カレンダー・メンバー一覧/管理） ──
  const desktopLeftItems = [
    { href: '/dashboard',  icon: LayoutDashboard, label: 'ホーム' },
    { href: '/calendar',   icon: CalendarDays,    label: 'カレンダー' },
    {
      href: '/admin/members',
      icon: Users,
      label: isAdmin ? 'メンバー管理' : 'メンバー一覧',
    },
  ]

  // ── モバイルタブ ──
  const mobileTabItems = MOBILE_TABS

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function submitSuggestion() {
    if (!sugTitle.trim() || !sugBody.trim()) return
    setSubmitting(true)
    setSubmitError(false)
    const { error } = await supabase.from('suggestions').insert({ title: sugTitle.trim(), body: sugBody.trim() })
    setSubmitting(false)
    if (error) {
      setSubmitError(true)
      return
    }
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false); setSugTitle(''); setSugBody(''); setShowSuggestion(false)
    }, 2000)
  }

  function openSuggestion() {
    setShowGear(false); setShowMore(false); setShowSuggestion(true)
  }

  function desktopLinkStyle(active: boolean): React.CSSProperties {
    return {
      color:      active ? 'var(--club-blue)' : 'var(--gray-500)',
      background: active ? 'var(--club-blue-muted)' : 'transparent',
    }
  }

  // ── メニュー行コンポーネント ──────────────────────────────────
  function MenuItem({
    icon, label, color, bg, onClick, href, danger,
  }: {
    icon: React.ReactNode; label: string; color: string; bg: string
    onClick?: () => void; href?: string; danger?: boolean
  }) {
    const labelColor = danger ? color : 'var(--gray-800)'
    const hoverBg    = danger ? '#fef2f2' : 'var(--gray-50)'
    const cls = "w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors text-left"
    const inner = (
      <>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color }}>
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium" style={{ color: labelColor }}>{label}</span>
      </>
    )
    if (href) return (
      <Link href={href} onClick={onClick} className={cls}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = hoverBg}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >{inner}</Link>
    )
    return (
      <button onClick={onClick} className={cls}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = hoverBg}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >{inner}</button>
    )
  }

  const Divider = () => <div style={{ height: '1px', background: 'var(--gray-200)' }} />

  // ── PC ギアメニュー（重複なし・設定系のみ） ─────────────────
  // admin: メンバー管理は左ナビにあるので省略。意見確認+設定
  // coach: メンバー一覧（左ナビにないため）+設定
  // member: 設定のみ
  function GearMenuContent() {
    return (
      <>
        {/* 届いた意見を確認（admin のみ） */}
        {isAdmin && (
          <>
            <MenuItem
              href="/admin/suggestions" onClick={() => setShowGear(false)}
              icon={<Inbox size={17} />} label="【管理者】届いた意見を確認"
              color="#b45309" bg="#fef3c7"
            />
            <Divider />
          </>
        )}

        {/* ダークモード */}
        <MenuItem
          onClick={() => { toggle(); setShowGear(false) }}
          icon={isDark ? <Sun size={17} /> : <Moon size={17} />}
          label={isDark ? 'ライトモード' : 'ダークモード'}
          color="var(--gray-600)" bg="var(--gray-100)"
        />

        <Divider />

        {/* ログアウト */}
        <MenuItem
          onClick={() => { handleLogout(); setShowGear(false) }}
          icon={<LogOut size={17} />} label="ログアウト"
          color="#dc2626" bg="#fef2f2" danger
        />
      </>
    )
  }

  // ── モバイル その他メニュー（PC にない項目も含む） ──────────
  function MobileMenuContent() {
    return (
      <>
        {/* メンバー一覧（モバイルのみ：PCは左ナビに表示済み） */}
        <MenuItem
          href="/admin/members" onClick={() => setShowMore(false)}
          icon={<Users size={17} />}
          label={isAdmin ? 'メンバー管理' : 'メンバー一覧'}
          color="#0891b2" bg="#ecfeff"
        />

        {/* 届いた意見を確認（admin のみ） */}
        {isAdmin && (
          <MenuItem
            href="/admin/suggestions" onClick={() => setShowMore(false)}
            icon={<Inbox size={17} />} label="【管理者】届いた意見を確認"
            color="#b45309" bg="#fef3c7"
          />
        )}

        <Divider />

        {/* ご意見箱 */}
        <MenuItem
          onClick={() => openSuggestion()}
          icon={<MessageSquarePlus size={17} />} label="ご意見箱（匿名）"
          color="#16a34a" bg="#dcfce7"
        />

        <Divider />

        {/* ダークモード */}
        <MenuItem
          onClick={() => { toggle(); setShowMore(false) }}
          icon={isDark ? <Sun size={17} /> : <Moon size={17} />}
          label={isDark ? 'ライトモード' : 'ダークモード'}
          color="var(--gray-600)" bg="var(--gray-100)"
        />

        <Divider />

        {/* ログアウト */}
        <MenuItem
          onClick={() => { handleLogout(); setShowMore(false) }}
          icon={<LogOut size={17} />} label="ログアウト"
          color="#dc2626" bg="#fef2f2" danger
        />
      </>
    )
  }

  return (
    <>
      {/* ══════════════════════════════════════════════
          PC トップナビ（md 以上）
          左: ロゴ + メインナビ
          右: ご意見箱アイコン + ギアドロップダウン
      ══════════════════════════════════════════════ */}
      <header className="glass-white sticky top-0 z-40 hidden md:block">
        <div className="flex items-center h-14 px-5 mx-auto gap-3" style={{ maxWidth: '52rem' }}>

          {/* ロゴ */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 select-none mr-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}
            >
              <Feather size={14} color="white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-sm tracking-tight" style={{ color: 'var(--gray-900)' }}>
              BadAttend
            </span>
          </Link>

          {/* 左ナビリンク */}
          <nav className="flex items-center gap-0.5 flex-1 min-w-0">
            {desktopLeftItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href} href={href}
                  className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap"
                  style={desktopLinkStyle(active)}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--club-blue-muted)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--club-blue)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--gray-500)'
                    }
                  }}
                >
                  <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full"
                      style={{ background: 'var(--club-blue)' }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* 右アクション */}
          <div className="flex items-center gap-1 shrink-0">
            {/* ご意見箱アイコン */}
            <button
              onClick={openSuggestion}
              title="ご意見箱"
              className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-all duration-150"
              style={{ color: 'var(--gray-400)' }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--gray-700)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--gray-400)'
              }}
            >
              <MessageSquarePlus size={16} />
            </button>

            {/* ギアドロップダウン */}
            <div ref={gearRef} className="relative">
              <button
                onClick={() => setShowGear(v => !v)}
                title="設定・メニュー"
                className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-all duration-150"
                style={{
                  color:      showGear ? 'var(--club-blue)' : 'var(--gray-400)',
                  background: showGear ? 'var(--club-blue-muted)' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (!showGear) {
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--gray-700)'
                  }
                }}
                onMouseLeave={e => {
                  if (!showGear) {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--gray-400)'
                  }
                }}
              >
                <Settings size={16} strokeWidth={showGear ? 2.5 : 2} />
              </button>

              {showGear && (
                <div
                  className="absolute top-full mt-2 right-0 rounded-2xl overflow-hidden animate-fade-in"
                  style={{
                    width:      '17rem',
                    background: 'var(--card-bg)',
                    boxShadow:  'var(--shadow-lg)',
                    border:     '1px solid var(--gray-200)',
                  }}
                >
                  <GearMenuContent />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          スマホ ボトムタブバー（md 未満）
      ══════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bottom-nav"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch w-full">
          {mobileTabItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href} href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-150 select-none"
                style={{ color: active ? 'var(--club-blue)' : 'var(--gray-400)', minHeight: '56px' }}
              >
                <span
                  className="w-1 h-1 rounded-full transition-all duration-200"
                  style={{ background: active ? 'var(--club-blue)' : 'transparent', marginBottom: '-2px' }}
                />
                <Icon size={active ? 23 : 22} strokeWidth={active ? 2.5 : 1.8} style={{ transition: 'all 0.15s' }} />
                <span style={{ fontSize: '10px', fontWeight: active ? 700 : 500, lineHeight: 1 }}>
                  {label}
                </span>
              </Link>
            )
          })}

          {/* その他ボタン */}
          <div ref={moreRef} className="flex-1 relative flex flex-col items-center">
            <button
              onClick={() => setShowMore(v => !v)}
              className="w-full flex flex-col items-center justify-center gap-1 py-2 cursor-pointer transition-all duration-150 select-none"
              style={{ color: showMore ? 'var(--club-blue)' : 'var(--gray-400)', minHeight: '56px' }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: showMore ? 'var(--club-blue)' : 'transparent', marginBottom: '-2px' }}
              />
              <MoreHorizontal size={showMore ? 23 : 22} strokeWidth={showMore ? 2.5 : 1.8} />
              <span style={{ fontSize: '10px', fontWeight: showMore ? 700 : 500, lineHeight: 1 }}>その他</span>
            </button>

            {showMore && (
              <div
                className="absolute bottom-full mb-3 right-0 rounded-2xl overflow-hidden animate-fade-in"
                style={{
                  width:      '17rem',
                  background: 'var(--card-bg)',
                  boxShadow:  'var(--shadow-lg)',
                  border:     '1px solid var(--gray-200)',
                }}
              >
                <MobileMenuContent />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════
          ご意見箱 モーダル（PC・スマホ共通）
      ══════════════════════════════════════════════ */}
      {showSuggestion && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
          onClick={() => !submitting && setShowSuggestion(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col"
            style={{
              background:    'var(--card-bg)',
              boxShadow:     'var(--shadow-lg)',
              maxHeight:     '90dvh',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--gray-200)' }} />
            </div>

            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <MessageSquarePlus size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>ご意見箱</h3>
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>匿名で送信されます</p>
                </div>
              </div>
              <button
                onClick={() => setShowSuggestion(false)} disabled={submitting}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--gray-400)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ height: '1px', background: 'var(--gray-100)' }} />

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-12 px-6">
                <CheckCircle2 size={40} style={{ color: '#16a34a' }} />
                <p className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>送信しました！</p>
                <p className="text-sm text-center" style={{ color: 'var(--gray-500)' }}>ご意見ありがとうございます</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 px-5 pt-4 pb-2 overflow-y-auto">
                <div>
                  <label className="label">タイトル</label>
                  <input
                    type="text" value={sugTitle} onChange={e => setSugTitle(e.target.value)}
                    placeholder="例: 練習場所について" className="input-field"
                    style={{ fontSize: '16px' }} maxLength={100} disabled={submitting}
                  />
                </div>
                <div>
                  <label className="label">内容</label>
                  <textarea
                    value={sugBody} onChange={e => setSugBody(e.target.value)}
                    placeholder="ご意見・ご要望・改善提案などを自由にお書きください"
                    className="input-field" style={{ fontSize: '16px', minHeight: '120px', resize: 'vertical' }}
                    maxLength={1000} disabled={submitting}
                  />
                  <p className="text-xs mt-1 text-right" style={{ color: 'var(--gray-400)' }}>
                    {sugBody.length} / 1000
                  </p>
                </div>
                {submitError && (
                  <div className="px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: '#fee2e2', color: '#b91c1c' }}>
                    送信に失敗しました。時間をおいて再度お試しください。
                  </div>
                )}
                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => setShowSuggestion(false)} disabled={submitting}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                    style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={submitSuggestion}
                    disabled={submitting || !sugTitle.trim() || !sugBody.trim()}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                    style={{
                      background: (!sugTitle.trim() || !sugBody.trim()) ? 'var(--gray-200)' : '#16a34a',
                      color:      (!sugTitle.trim() || !sugBody.trim()) ? 'var(--gray-400)' : 'white',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting
                      ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send size={15} />
                    }
                    {submitting ? '送信中...' : '送信する'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
