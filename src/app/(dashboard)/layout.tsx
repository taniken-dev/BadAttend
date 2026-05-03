import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavBar from '@/components/ui/NavBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.log('[layout] user:', user?.id, user?.email)

  if (!user) redirect('/login')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .single()

  console.log('[layout] profile:', profile, 'error:', profileErr)

  if (!profile?.is_approved) redirect('/pending')

  return (
    <div className="min-h-screen" style={{ background: 'var(--apple-bg)' }}>
      <NavBar />
      <main
        className="mx-auto px-4 pt-5 pb-28 md:pb-10"
        style={{ maxWidth: '42rem' }}
      >
        {children}
      </main>
    </div>
  )
}
