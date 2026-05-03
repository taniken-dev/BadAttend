'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Feather,
  Mail,
  Lock,
  User,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react'

const GRADE_OPTIONS = [
  { value: 1, label: '1年生' },
  { value: 2, label: '2年生' },
  { value: 3, label: '3年生' },
  { value: 4, label: '4年生' },
]

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [grade, setGrade] = useState<number>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください')
      return
    }
    if (!fullName.trim()) {
      setError('氏名を入力してください')
      return
    }

    setLoading(true)

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          grade,
        },
      },
    })

    if (signupError) {
      const msg =
        signupError.message.includes('already registered')
          ? 'このメールアドレスは既に登録されています'
          : signupError.message.includes('invalid')
          ? '無効なメールアドレスです'
          : signupError.message
      setError(msg)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-5"
        style={{ background: 'var(--apple-bg)' }}
      >
        <div className="flex flex-col items-center gap-5 text-center max-w-sm animate-slide-up">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: '#dcfce7' }}
          >
            <CheckCircle2 size={40} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h2
              className="text-xl font-bold"
              style={{ color: 'var(--gray-900)', letterSpacing: '-0.03em' }}
            >
              登録申請を送信しました
            </h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--gray-500)' }}>
              確認メールを送りました。メールのリンクをクリックして
              メール認証を完了してください。
              <br /><br />
              その後、主将・幹部がアカウントを承認するまでお待ちください。
            </p>
          </div>
          <Link href="/login" className="btn-primary" style={{ width: 'auto', paddingLeft: 24, paddingRight: 24 }}>
            ログイン画面へ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ background: 'var(--apple-bg)' }}
    >
      {/* ヘッダー */}
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
            千葉工大バドミントン部 — 入部登録
          </p>
        </div>
      </div>

      {/* カード */}
      <div
        className="w-full max-w-sm card-elevated animate-slide-up"
        style={{ animationDelay: '0.05s' }}
      >
        <h2
          className="text-lg font-bold mb-6"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}
        >
          アカウント登録
        </h2>

        {error && (
          <div className="alert-error mb-5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          {/* 氏名 */}
          <div>
            <label className="label">氏名</label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--gray-400)' }}
              />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '38px' }}
                placeholder="田中 佑哉"
                required
                autoComplete="name"
              />
            </div>
          </div>

          {/* 学年 */}
          <div>
            <label className="label">学年</label>
            <div className="relative">
              <GraduationCap
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--gray-400)' }}
              />
              <select
                value={grade}
                onChange={e => setGrade(Number(e.target.value))}
                className="input-field"
                style={{ paddingLeft: '38px' }}
                required
              >
                {GRADE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* メールアドレス */}
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
                placeholder="s24g0001@s.chibakoudai.jp"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* パスワード */}
          <div>
            <label className="label">パスワード（8文字以上）</label>
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
                autoComplete="new-password"
                minLength={8}
              />
            </div>
          </div>

          {/* パスワード確認 */}
          <div>
            <label className="label">パスワード（確認）</label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--gray-400)' }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: '38px',
                  borderColor:
                    confirmPassword && confirmPassword !== password
                      ? '#dc2626'
                      : undefined,
                }}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs mt-1" style={{ color: '#dc2626' }}>
                パスワードが一致しません
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary mt-2"
            disabled={loading || (!!confirmPassword && confirmPassword !== password)}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                登録中...
              </span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                登録申請する
              </>
            )}
          </button>
        </form>

        {/* 注意書き */}
        <div
          className="mt-5 p-3 rounded-xl text-xs leading-relaxed"
          style={{ background: 'var(--gray-50)', color: 'var(--gray-500)' }}
        >
          登録後、主将・幹部の承認が必要です。承認されるまでアプリは利用できません。
        </div>

        {/* ログインリンク */}
        <p className="text-center text-sm mt-4" style={{ color: 'var(--gray-500)' }}>
          既にアカウントをお持ちの方は{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'var(--club-blue)' }}>
            ログイン
          </Link>
        </p>
      </div>

      {/* 戻るリンク */}
      <Link
        href="/login"
        className="flex items-center gap-1.5 text-sm mt-6"
        style={{ color: 'var(--gray-400)' }}
      >
        <ChevronLeft size={14} />
        ログイン画面に戻る
      </Link>
    </div>
  )
}
