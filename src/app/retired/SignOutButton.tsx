'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// 退部済みアカウントはログイン中だと /login がダッシュボードへ戻されるため、
// 別アカウントで入り直せるようにここでセッションを破棄する
export default function SignOutButton() {
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
      style={{
        background: 'var(--gray-100)',
        color: 'var(--gray-600)',
        border: '1px solid var(--gray-200)',
      }}
    >
      <LogOut size={15} />
      ログアウト
    </button>
  )
}
