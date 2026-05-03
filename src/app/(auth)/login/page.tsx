'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Mail, Lock, AlertCircle, Feather } from 'lucide-react'

// LINE公式SVGロゴ
function LineIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('メールアドレスまたはパスワードが間違っています')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  function handleLineLogin() {
    setLineLoading(true)
    setError(null)
    // Supabase Providerを使わずサーバーサイドで直接LINEと通信する
    window.location.href = '/api/auth/line'
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ background: 'var(--apple-bg)' }}
    >
      {/* ロゴ */}
      <div className="flex flex-col items-center gap-3 mb-8 animate-slide-up">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}
        >
          <Feather size={30} color="white" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: 'var(--gray-900)', letterSpacing: '-0.03em' }}
          >
            BadAttend
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
            千葉工大バドミントン部 出欠管理
          </p>
        </div>
      </div>

      {/* カード */}
      <div
        className="w-full max-w-sm card-elevated animate-slide-up"
        style={{ animationDelay: '0.05s' }}
      >
        {error && (
          <div className="alert-error mb-5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* LINEログインボタン */}
        <button
          type="button"
          onClick={handleLineLogin}
          disabled={lineLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-white text-base transition-opacity"
          style={{
            background: lineLoading ? '#04a348' : '#06C755',
            opacity: lineLoading ? 0.85 : 1,
          }}
        >
          {lineLoading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              LINEへ接続中...
            </span>
          ) : (
            <>
              <LineIcon size={22} />
              LINEでログイン
            </>
          )}
        </button>

        {/* 区切り線 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--gray-200)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--gray-400)' }}>
            またはメールで
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--gray-200)' }} />
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="label">メールアドレス</label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--gray-400)' }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '38px' }}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="label">パスワード</label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--gray-400)' }}
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '38px' }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading || lineLoading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ログイン中...
              </span>
            ) : (
              <>
                <ShieldCheck size={16} />
                ログイン
              </>
            )}
          </button>
        </form>

        {/* サインアップリンク */}
        <div
          className="mt-5 pt-5"
          style={{ borderTop: '1px solid var(--gray-100)' }}
        >
          <p className="text-center text-sm" style={{ color: 'var(--gray-500)' }}>
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="font-semibold" style={{ color: 'var(--club-blue)' }}>
              入部登録
            </Link>
          </p>
        </div>
      </div>

      {/* フッター */}
      <p className="text-xs mt-8" style={{ color: 'var(--gray-400)' }}>
        © 2026 千葉工業大学 バドミントン部
      </p>
    </div>
  )
}
