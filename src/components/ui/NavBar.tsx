'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import {
  Feather,
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  BarChart2,
  LogOut,
  Shield,
  Sun,
  Moon,
  MoreHorizontal,
  Users,
  MessageSquarePlus,
  Inbox,
  X,
  Send,
  CheckCircle2,
} from 'lucide-react'

// デスクトップ用ナビ定義
const BASE_NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'ホーム' },
  { href: '/attendance',  icon: CalendarCheck,   label: '出欠連絡' },
  { href: '/calendar',    icon: CalendarDays,    label: 'カレンダー' },
  { href: '/leaderboard', icon: BarChart2,        label: '出席率' },
]
const ADMIN_NAV = { href: '/admin/members', icon: Shield, label: 'メンバー' }

// モバイル ボトムタブ（固定 4 項目）
const MOBILE_BASE = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'ホーム' },
  { href: '/attendance', icon: CalendarCheck,   label: '出欠連絡' },
  { href: '/calendar',   icon: CalendarDays,    label: 'カレンダー' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { isDark, toggle } = useTheme()

  const [role,           setRole]          = useState<string | null>(null)
  const [showMore,       setShowMore]      = useState(false)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [sugTitle,       setSugTitle]      = useState('')
  const [sugBody,        setSugBody]       = useState('')
  const [submitting,     setSubmitting]    = useState(false)
  const [submitted,      setSubmitted]     = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setRole(data?.role ?? null))
    })
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isAdmin = role === 'admin'
  const isCoach = role === 'coach'

  // デスクトップ用ナビ
  const desktopBase  = isCoach ? BASE_NAV.filter(i => i.href !== '/attendance') : BASE_NAV
  const desktopItems = (isAdmin || isCoach) ? [...desktopBase, ADMIN_NAV] : desktopBase

  // モバイル ボトムタブ（coach は出欠連絡を除外）
  const mobileTabItems = isCoach
    ? MOBILE_BASE.filter(i => i.href !== '/attendance')
    : MOBILE_BASE

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function submitSuggestion() {
    if (!sugTitle.trim() || !sugBody.trim()) return
    setSubmitting(true)
    await supabase.from('suggestions').insert({ title: sugTitle.trim(), body: sugBody.trim() })
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setSugTitle('')
      setSugBody('')
      setShowSuggestion(false)
    }, 2000)
  }

  function openSuggestion() {
    setShowMore(false)
    setShowSuggestion(true)
  }

  function desktopLinkStyle(active: boolean) {
    return {
      color:      active ? 'var(--club-blue)' : 'var(--gray-500)',
      background: active ? 'var(--club-blue-muted)' : 'transparent',
    } as React.CSSProperties
  }

  // その他メニューの共通行スタイルヘルパー
  function MenuRow({
    icon,
    label,
    color,
    bg,
    onClick,
    href,
  }: {
    icon: React.ReactNode
    label: string
    color: string
    bg: string
    onClick?: () => void
    href?: string
  }) {
    const inner = (
      <>
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: bg, color }}
        >
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium text-left" style={{ color: 'var(--gray-800)' }}>
          {label}
        </span>
      </>
    )
    const base = "w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
    if (href) {
      return (
        <Link
          href={href}
          onClick={onClick}
          className={base}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          {inner}
        </Link>
      )
    }
    return (
      <button
        onClick={onClick}
        className={base}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        {inner}
      </button>
    )
  }

  return (
    <>
      {/* ══════════════════════════════════════════════
          PC トップナビ（md 以上）
      ══════════════════════════════════════════════ */}
      <header className="glass-white sticky top-0 z-40 hidden md:block">
        <div
          className="flex items-center justify-between h-14 px-5 mx-auto"
          style={{ maxWidth: '52rem' }}
        >
          {/* ロゴ */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 select-none">
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

          {/* ナビリンク */}
          <nav className="flex items-center gap-0.5">
            {desktopItems.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150"
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
                      className="absolute bottom-0.5 left-3.5 right-3.5 h-0.5 rounded-full"
                      style={{ background: 'var(--club-blue)' }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* 右側アクション */}
          <div className="flex items-center gap-1 shrink-0">
            {/* ご意見箱 */}
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

            {/* テーマトグル */}
            <button
              onClick={toggle}
              title={isDark ? 'ライトモードへ' : 'ダークモードへ'}
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
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* ログアウト */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150"
              style={{ color: 'var(--gray-500)' }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = '#fef2f2'
                ;(e.currentTarget as HTMLElement).style.color = '#dc2626'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--gray-500)'
              }}
            >
              <LogOut size={15} />
              <span className="hidden lg:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          スマホ ボトムタブバー（md 未満）
          常に「ホーム・[出欠連絡]・カレンダー・その他」の4タブ
      ══════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bottom-nav"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch w-full">
          {/* ── ホーム / [出欠連絡] / カレンダー ── */}
          {mobileTabItems.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-150 select-none"
                style={{
                  color:     active ? 'var(--club-blue)' : 'var(--gray-400)',
                  minHeight: '56px',
                }}
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

          {/* ── その他 ── */}
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
              <span style={{ fontSize: '10px', fontWeight: showMore ? 700 : 500, lineHeight: 1 }}>
                その他
              </span>
            </button>

            {/* ── ポップアップメニュー ── */}
            {showMore && (
              <div
                className="absolute bottom-full mb-3 right-0 w-60 rounded-2xl overflow-hidden animate-fade-in"
                style={{
                  background: 'var(--card-bg)',
                  boxShadow:  'var(--shadow-lg)',
                  border:     '1px solid var(--gray-200)',
                }}
              >
                {/* 出席率 */}
                <MenuRow
                  href="/leaderboard"
                  onClick={() => setShowMore(false)}
                  icon={<BarChart2 size={17} />}
                  label="出席率ランキング"
                  color="#4338ca"
                  bg="#eef2ff"
                />

                {/* メンバー一覧（admin / coach のみ） */}
                {(isAdmin || isCoach) && (
                  <MenuRow
                    href="/admin/members"
                    onClick={() => setShowMore(false)}
                    icon={<Users size={17} />}
                    label="メンバー一覧"
                    color="#0891b2"
                    bg="#ecfeff"
                  />
                )}

                <div style={{ height: '1px', background: 'var(--gray-200)' }} />

                {/* ご意見箱 */}
                <MenuRow
                  onClick={openSuggestion}
                  icon={<MessageSquarePlus size={17} />}
                  label="ご意見箱（匿名）"
                  color="#16a34a"
                  bg="#dcfce7"
                />

                {/* 届いた意見を確認（admin のみ） */}
                {isAdmin && (
                  <MenuRow
                    href="/admin/suggestions"
                    onClick={() => setShowMore(false)}
                    icon={<Inbox size={17} />}
                    label="【管理者】意見箱の確認"
                    color="#b45309"
                    bg="#fef3c7"
                  />
                )}

                <div style={{ height: '1px', background: 'var(--gray-200)' }} />

                {/* ダークモード */}
                <MenuRow
                  onClick={() => { toggle(); setShowMore(false) }}
                  icon={isDark ? <Sun size={17} /> : <Moon size={17} />}
                  label={isDark ? 'ライトモード' : 'ダークモード'}
                  color="var(--gray-600)"
                  bg="var(--gray-100)"
                />

                <div style={{ height: '1px', background: 'var(--gray-200)' }} />

                {/* ログアウト */}
                <button
                  onClick={() => { handleLogout(); setShowMore(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fef2f2'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#fef2f2', color: '#dc2626' }}
                  >
                    <LogOut size={17} />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-left" style={{ color: '#dc2626' }}>
                    ログアウト
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════
          ご意見箱 モーダル
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
              background:   'var(--card-bg)',
              boxShadow:    'var(--shadow-lg)',
              maxHeight:    '90dvh',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ハンドルバー */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--gray-200)' }} />
            </div>

            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: '#dcfce7', color: '#16a34a' }}
                >
                  <MessageSquarePlus size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>
                    ご意見箱
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    匿名で送信されます
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuggestion(false)}
                disabled={submitting}
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
              /* 送信完了 */
              <div className="flex flex-col items-center gap-3 py-12 px-6">
                <CheckCircle2 size={40} style={{ color: '#16a34a' }} />
                <p className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>
                  送信しました！
                </p>
                <p className="text-sm text-center" style={{ color: 'var(--gray-500)' }}>
                  ご意見ありがとうございます
                </p>
              </div>
            ) : (
              /* フォーム */
              <div className="flex flex-col gap-4 px-5 pt-4 pb-2 overflow-y-auto">
                <div>
                  <label className="label">タイトル</label>
                  <input
                    type="text"
                    value={sugTitle}
                    onChange={e => setSugTitle(e.target.value)}
                    placeholder="例: 練習場所について"
                    className="input-field"
                    style={{ fontSize: '16px' }}
                    maxLength={100}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="label">内容</label>
                  <textarea
                    value={sugBody}
                    onChange={e => setSugBody(e.target.value)}
                    placeholder="ご意見・ご要望・改善提案などを自由にお書きください"
                    className="input-field"
                    style={{ fontSize: '16px', minHeight: '120px', resize: 'vertical' }}
                    maxLength={1000}
                    disabled={submitting}
                  />
                  <p className="text-xs mt-1 text-right" style={{ color: 'var(--gray-400)' }}>
                    {sugBody.length} / 1000
                  </p>
                </div>

                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => setShowSuggestion(false)}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
                    style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={submitSuggestion}
                    disabled={submitting || !sugTitle.trim() || !sugBody.trim()}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    style={{
                      background: (!sugTitle.trim() || !sugBody.trim()) ? 'var(--gray-200)' : '#16a34a',
                      color:      (!sugTitle.trim() || !sugBody.trim()) ? 'var(--gray-400)' : 'white',
                      opacity:    submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
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
