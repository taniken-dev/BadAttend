import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MembersManager from './MembersManager'
import type { Profile } from '@/lib/types'

export interface OrphanUser {
  id: string
  email: string
  created_at: string
  full_name: string
}

export default async function AdminMembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!myProfile) {
    redirect('/dashboard')
  }

  const isAdmin = myProfile.role === 'admin'

  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .order('is_approved', { ascending: true })
    .order('grade')
    .order('full_name')

  // 孤立ユーザー検出（admin のみ・get_orphan_users RPC を使用）
  const { data: orphanData } = isAdmin
    ? await supabase.rpc('get_orphan_users')
    : { data: [] }

  return (
    <MembersManager
      members={(members ?? []) as Profile[]}
      currentUserId={user.id}
      readOnly={!isAdmin}
      orphanUsers={(orphanData ?? []) as OrphanUser[]}
    />
  )
}
