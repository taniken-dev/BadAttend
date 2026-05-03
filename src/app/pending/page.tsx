import Link from 'next/link'
import { Clock, Feather, LogIn } from 'lucide-react'

export default function PendingPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: 'var(--apple-bg)' }}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--club-blue-light)' }}
        >
          <Feather size={28} style={{ color: 'var(--club-blue)' }} />
        </div>

        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--gray-900)' }}>
            承認待ち
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--gray-500)' }}>
            アカウントの承認を待っています。
            <br />
            主将または幹部にお問い合わせください。
          </p>
        </div>

        <div
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-full"
          style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}
        >
          <Clock size={13} />
          承認後、自動でログインされます
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          style={{
            background: 'var(--gray-100)',
            color: 'var(--gray-600)',
            border: '1px solid var(--gray-200)',
          }}
        >
          <LogIn size={15} />
          ログイン画面へ
        </Link>
      </div>
    </div>
  )
}
