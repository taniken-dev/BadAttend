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
  Users,
  LogOut,
  Shield,
  Sun,
  Moon,
  MoreHorizontal,
} from 'lucide-react'

const BASE_NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'ホーム' },
  { href: '/attendance',  icon: CalendarCheck,   label: '出欠連絡' },
  { href: '/calendar',    icon: CalendarDays,    label: 'カレンダー' },
  { href: '/leaderboard', icon: BarChart2,        label: '出席率' },
]
const ADMIN_NAV = { href: '/admin/members', icon: Shield, label: 'メンバー' }

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { isDark, toggle } = useTheme()

  const [isAdmin,   setIsAdmin]   = useState(false)
  const [showMore,  setShowMore]  = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setIsAdmin(data?.role === 'admin')
        })
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = isAdmin ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV

  // ── デスクトップ用リンクスタイル ──────────────────────────
  function desktopLinkStyle(active: boolean) {
    return {
      color:      active ? 'var(--club-blue)' : 'var(--gray-500)',
      background: active ? 'var(--club-blue-muted)' : 'transparent',
    } as React.CSSProperties
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
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 hover:opacity-90"
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
      ══════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bottom-nav"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch w-full">
          {/* ── メインタブ ── */}
          {navItems.map(({ href, icon: Icon, label }) => {
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
                {/* アクティブ時の小ドット */}
                <span
                  className="w-1 h-1 rounded-full transition-all duration-200"
                  style={{
                    background: active ? 'var(--club-blue)' : 'transparent',
                    marginBottom: '-2px',
                  }}
                />
                <Icon
                  size={active ? 23 : 22}
                  strokeWidth={active ? 2.5 : 1.8}
                  style={{ transition: 'all 0.15s' }}
                />
                <span
                  style={{
                    fontSize:   '10px',
                    fontWeight: active ? 700 : 500,
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              </Link>
            )
          })}

          {/* ── その他（テーマ＋ログアウト）── */}
          <div ref={moreRef} className="flex-1 relative flex flex-col items-center">
            <button
              onClick={() => setShowMore(v => !v)}
              className="w-full flex flex-col items-center justify-center gap-1 py-2 cursor-pointer transition-all duration-150 select-none"
              style={{
                color:     showMore ? 'var(--club-blue)' : 'var(--gray-400)',
                minHeight: '56px',
              }}
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

            {/* ポップアップメニュー */}
            {showMore && (
              <div
                className="absolute bottom-full mb-3 right-0 w-52 rounded-2xl overflow-hidden animate-fade-in"
                style={{
                  background:  'var(--card-bg)',
                  boxShadow:   'var(--shadow-lg)',
                  border:      '1px solid var(--gray-200)',
                }}
              >
                {/* テーマ切り替え */}
                <button
                  onClick={() => { toggle(); setShowMore(false) }}
                  className="w-full flex items-center gap-3 px-4 py-4 text-sm font-medium cursor-pointer transition-colors"
                  style={{ color: 'var(--gray-700)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--gray-100)' }}
                  >
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  </span>
                  {isDark ? 'ライトモード' : 'ダークモード'}
                </button>

                <div style={{ height: '1px', background: 'var(--gray-200)' }} />

                {/* ログアウト */}
                <button
                  onClick={() => { handleLogout(); setShowMore(false) }}
                  className="w-full flex items-center gap-3 px-4 py-4 text-sm font-semibold cursor-pointer transition-colors"
                  style={{ color: '#dc2626' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fef2f2'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#fef2f2' }}
                  >
                    <LogOut size={16} />
                  </span>
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
