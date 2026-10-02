import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MembersManager from './MembersManager'
import type { Profile } from '@/lib/types'
import { getSessionUser, getMyProfile } from '@/lib/supabase/session'
import { CARD_SELECT, type Card } from '@/lib/cards'
import { toJstDateStr } from '@/lib/registration'

export interface OrphanUser {
  id: string
  email: string
  created_at: string
  full_name: string
}

// カードの設定（admin だけが読める。しきい値はコードに書かず、DB の値をそのまま表示する）
export interface CardPolicy {
  start_date:     string | null
  yellow_per_red: number | null
  streak_per_red: number | null
}

export default async function AdminMembersPage() {
  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const myProfile = await getMyProfile()

  if (!myProfile) {
    redirect('/dashboard')
  }

  const isAdmin = myProfile.role === 'admin'
  const isManagerOrAdmin = isAdmin || myProfile.role === 'manager'

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

  // イエロー・レッドカード（RLS で、部員は自分の分だけ・manager/admin/coach は全員分が返る）
  const [{ data: cardData }, { data: policyData }, { data: streakData }] = await Promise.all([
    supabase.from('cards').select(CARD_SELECT),
    isAdmin
      ? supabase.from('card_policy').select('start_date, yellow_per_red, streak_per_red').maybeSingle<CardPolicy>()
      : Promise.resolve({ data: null }),
    // 今いくつ続けて通常練習を休んでいるか（manager/admin だけ。部員・顧問には出さない）
    isManagerOrAdmin
      ? supabase.rpc('get_absence_streaks')
      : Promise.resolve({ data: null }),
  ])
  const absenceStreaks = Object.fromEntries(
    ((streakData ?? []) as { user_id: string; streak: number }[]).map(s => [s.user_id, s.streak])
  )
  const cards = (cardData ?? []) as Card[]

  // 内訳に出す練習日
  const sessionIds = [...new Set(cards.map(c => c.session_id).filter((id): id is string => !!id))]
  const { data: sessionData } = sessionIds.length > 0
    ? await supabase.from('practice_sessions').select('id, session_date').in('id', sessionIds)
    : { data: [] }
  const sessionDates = Object.fromEntries(
    ((sessionData ?? []) as { id: string; session_date: string }[]).map(s => [s.id, s.session_date])
  )

  return (
    <MembersManager
      members={(members ?? []) as Profile[]}
      currentUserId={user.id}
      orphanUsers={(orphanData ?? []) as OrphanUser[]}
      cards={cards}
      sessionDates={sessionDates}
      today={toJstDateStr(new Date())}
      cardPolicy={policyData}
      absenceStreaks={absenceStreaks}
    />
  )
}
