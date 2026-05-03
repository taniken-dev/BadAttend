'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Feather,
  LayoutDashboard,
  CalendarCheck,
  Trophy,
  LogOut,
  Shield,
} from 'lucide-react'

const BASE_NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'ホーム' },
  { href: '/attendance',  icon: CalendarCheck,   label: '出欠連絡' },
  { href: '/leaderboard', icon: Trophy,           label: '選考' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setIsAdmin(data?.role === 'admin' || data?.role === 'captain')
        })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = isAdmin
    ? [...BASE_NAV, { href: '/admin/members', icon: Shield, label: 'メンバー' }]
    : BASE_NAV

  return (
    <>
      {/* デスクトップ上部ナビ */}
      <header className="glass-white sticky top-0 z-40 hidden md:block">
        <div
          className="flex items-center justify-between h-14 px-6 mx-auto"
          style={{ maxWidth: '42rem' }}
        >
          {/* ロゴ */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}
            >
              <Feather size={14} color="white" strokeWidth={2.5} />
            </div>
            <span
              className="font-black text-sm"
              style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}
            >
              BadAttend
            </span>
          </Link>

          {/* ナビリンク */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--club-blue)' : 'var(--gray-500)',
                    background: active ? 'var(--club-blue-light)' : 'transparent',
                  }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* ログアウト */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--gray-400)' }}
          >
            <LogOut size={15} />
            <span className="hidden lg:inline">ログアウト</span>
          </button>
        </div>
      </header>

      {/* モバイル ボトムナビ */}
      <nav className="bottom-nav md:hidden">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`bottom-nav-item ${active ? 'bottom-nav-item--active' : ''}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
