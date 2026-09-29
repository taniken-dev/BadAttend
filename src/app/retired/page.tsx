import { UserX } from 'lucide-react'
import SignOutButton from './SignOutButton'

export default function RetiredPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: 'var(--apple-bg)' }}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--gray-100)' }}
        >
          <UserX size={28} style={{ color: 'var(--gray-500)' }} />
        </div>

        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--gray-900)' }}>
            退部済みのアカウントです
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--gray-500)' }}>
            このアカウントでは出欠連絡などを利用できません。
            <br />
            心当たりがない場合は、主将または管理者にお問い合わせください。
          </p>
        </div>

        <SignOutButton />
      </div>
    </div>
  )
}
