import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

// 1リクエスト内で getUser() / profiles 取得を1回に集約する（React cache でメモ化）。
// layout と各 page が同じ user/profile を取得しても、Auth 往復・DB 往復は
// それぞれ1回で済む。返る値は同一なので動作は変わらない。

export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()
  return data ?? null
})
