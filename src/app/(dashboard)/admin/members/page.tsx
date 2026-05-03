import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MembersManager from './MembersManager'
import type { Profile } from '@/lib/types'

export default async function AdminMembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!myProfile || myProfile.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .order('is_approved', { ascending: true })  // 未承認を先頭に
    .order('grade')
    .order('full_name')

  return <MembersManager members={(members ?? []) as Profile[]} currentUserId={user.id} />
}
