import { redirect } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import DashboardClientShell from './DashboardClientShell'
import { getSessionUser, getMyProfile } from '@/lib/supabase/session'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  const profile = await getMyProfile()

  if (!profile?.is_approved) redirect('/pending')

  return (
    <DashboardClientShell>
      <div className="min-h-screen" style={{ background: 'var(--apple-bg)' }}>
        <NavBar />
        <main
          className="mx-auto px-4 pt-5 pb-28 md:pb-10"
          style={{ maxWidth: '42rem' }}
        >
          {children}
        </main>
      </div>
    </DashboardClientShell>
  )
}
