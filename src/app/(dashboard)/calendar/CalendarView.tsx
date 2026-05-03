'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, MapPin, Clock, Users } from 'lucide-react'
import type { PracticeSession } from '@/lib/types'

type SessionMap = Record<string, PracticeSession>

type AttendanceRow = {
  status: string
  reason: string | null
  user_id: string
}

type MemberProfile = {
  id: string
  full_name: string
  display_name: string | null
  avatar_url: string | null
  grade: number
  role: string
}

type EnrichedAttendance = AttendanceRow & { profile: MemberProfile }

type DayDetail = {
  session: PracticeSession
  attendance: EnrichedAttendance[]
  totalApproved: number
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

const STATUS_GROUPS = [
  { key: 'present',           label: '出席予定',    color: '#16a34a', bg: '#dcfce7' },
  { key: 'tardy',             label: '遅刻予定',    color: '#d97706', bg: '#fef3c7' },
  { key: 'absent',            label: '欠席・その他', color: '#dc2626', bg: '#fee2e2' },
]

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function CalendarView() {
  const supabase = createClient()
  const today    = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [current,      setCurrent]      = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [sessions,     setSessions]     = useState<SessionMap>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detail,       setDetail]       = useState<DayDetail | null>(null)
  const [loading,      setLoading]      = useState(false)

  // ── 月のセッション一覧取得 ─────────────────────────────────
  useEffect(() => {
    const y  = current.getFullYear()
    const m  = current.getMonth()
    const s  = toDateStr(y, m, 1)
    const e  = toDateStr(y, m, new Date(y, m + 1, 0).getDate())

    supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled')
      .gte('session_date', s)
      .lte('session_date', e)
      .then(({ data }) => {
        const map: SessionMap = {}
        ;(data ?? []).forEach(s => { map[s.session_date] = s as PracticeSession })
        setSessions(map)
      })

    setSelectedDate(null)
    setDetail(null)
  }, [current])

  // ── 日付クリック → 詳細取得 ──────────────────────────────
  const handleDayClick = useCallback(async (dateStr: string) => {
    const session = sessions[dateStr]
    if (!session) return
    if (selectedDate === dateStr) { setSelectedDate(null); setDetail(null); return }

    setSelectedDate(dateStr)
    setLoading(true)
    setDetail(null)

    const [{ data: atRows }, { count }] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('status, reason, user_id')
        .eq('session_id', session.id),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', true),
    ])

    const rows = (atRows ?? []) as AttendanceRow[]
    let profiles: MemberProfile[] = []

    if (rows.length > 0) {
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, avatar_url, grade, role')
        .in('id', rows.map(r => r.user_id))
      profiles = (pData ?? []) as MemberProfile[]
    }

    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
    const attendance: EnrichedAttendance[] = rows
      .filter(r => profileMap[r.user_id])
      .map(r => ({ ...r, profile: profileMap[r.user_id] }))

    setDetail({ session, attendance, totalApproved: count ?? 0 })
    setLoading(false)
  }, [sessions, selectedDate])

  // ── カレンダーグリッド ────────────────────────────────────
  const y = current.getFullYear()
  const m = current.getMonth()
  const firstDow    = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-black tracking-tight"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}>
          カレンダー
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          練習日と出欠状況を確認できます
        </p>
      </div>

      {/* カレンダー本体 */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.05s', padding: '16px' }}>
        {/* 月ナビ */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--gray-500)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <ChevronLeft size={18} />
          </button>
          <span className="font-bold text-base" style={{ color: 'var(--gray-900)' }}>
            {y}年 {m + 1}月
          </span>
          <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--gray-500)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d, i) => (
            <div key={d} className="text-center py-1 text-xs font-semibold"
              style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#4338ca' : 'var(--gray-400)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e${idx}`} />
            const dow     = (firstDow + day - 1) % 7
            const dateStr = toDateStr(y, m, day)
            const session  = sessions[dateStr]
            const isToday    = dateStr === todayStr
            const isSelected = dateStr === selectedDate

            return (
              <div key={dateStr}
                onClick={() => handleDayClick(dateStr)}
                className="flex flex-col items-center py-1.5 rounded-xl transition-all duration-150 select-none"
                style={{
                  cursor:     session ? 'pointer' : 'default',
                  background: isSelected
                    ? 'var(--club-blue)'
                    : isToday
                    ? 'var(--club-blue-muted)'
                    : 'transparent',
                }}
                onMouseEnter={e => {
                  if (session && !isSelected)
                    (e.currentTarget as HTMLElement).style.background = 'var(--gray-100)'
                }}
                onMouseLeave={e => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background =
                      isToday ? 'var(--club-blue-muted)' : 'transparent'
                }}
              >
                <span className="text-sm font-medium leading-snug"
                  style={{
                    color: isSelected ? 'white'
                      : dow === 0 ? '#ef4444'
                      : dow === 6 ? '#4338ca'
                      : 'var(--gray-900)',
                    fontWeight: isToday ? 800 : undefined,
                  }}>
                  {day}
                </span>
                {/* 練習ドット */}
                <span className="w-1 h-1 rounded-full"
                  style={{
                    background: session
                      ? isSelected
                        ? 'rgba(255,255,255,0.7)'
                        : session.is_cancelled
                        ? 'var(--gray-300)'
                        : 'var(--club-blue)'
                      : 'transparent',
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-4 mt-3 pt-3"
          style={{ borderTop: '1px solid var(--gray-100)' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--club-blue)' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>練習日</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--gray-300)' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>休止</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'var(--club-blue-muted)', color: 'var(--club-blue)' }}>
              {Object.values(sessions).filter(s => !s.is_cancelled).length}
            </span>
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>今月の練習数</span>
          </div>
        </div>
      </div>

      {/* 詳細パネル */}
      {selectedDate && (
        <div className="card animate-slide-up" style={{ animationDelay: '0.04s' }}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--gray-200)', borderTopColor: 'var(--club-blue)' }} />
            </div>
          ) : detail ? (
            <DetailPanel detail={detail} />
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── 詳細パネル ────────────────────────────────────────────────
function DetailPanel({ detail }: { detail: DayDetail }) {
  const { session, attendance, totalApproved } = detail

  const dateObj   = new Date(session.session_date + 'T00:00:00')
  const dateLabel = dateObj.toLocaleDateString('ja-JP', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  // status グループ化（absent系はまとめる）
  const grouped: Record<string, EnrichedAttendance[]> = {}
  attendance.forEach(a => {
    const key = a.status.startsWith('absent') ? 'absent' : a.status
    ;(grouped[key] ??= []).push(a)
  })

  const notYet = totalApproved - attendance.length

  const roleOrder: Record<string, number> = { admin: 0, captain: 1, member: 2 }
  const sortMembers = (list: EnrichedAttendance[]) =>
    [...list].sort((a, b) => (roleOrder[a.profile.role] ?? 2) - (roleOrder[b.profile.role] ?? 2))

  return (
    <div className="flex flex-col gap-4">
      {/* セッション情報ヘッダー */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>
            {dateLabel}の練習
          </h2>
          {session.is_cancelled && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: '#fee2e2', color: '#b91c1c' }}>休止</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gray-600)' }}>
            <Clock size={14} className="shrink-0" style={{ color: 'var(--gray-400)' }} />
            {session.start_time.slice(0, 5)} 〜 {session.end_time.slice(0, 5)}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gray-600)' }}>
            <MapPin size={14} className="shrink-0" style={{ color: 'var(--gray-400)' }} />
            {session.location}
          </div>
        </div>
      </div>

      {/* 提出サマリーバー */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
        <Users size={14} className="shrink-0" style={{ color: 'var(--gray-400)' }} />
        <span className="text-sm" style={{ color: 'var(--gray-600)' }}>
          <span className="font-bold" style={{ color: 'var(--gray-900)' }}>
            {attendance.length}
          </span>
          /{totalApproved}名 連絡済み
          {notYet > 0 && (
            <span className="ml-2 font-semibold" style={{ color: '#d97706' }}>
              • 未提出 {notYet}名
            </span>
          )}
        </span>
      </div>

      {/* 出欠グループリスト */}
      {attendance.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-1">
          <p className="text-sm" style={{ color: 'var(--gray-400)' }}>まだ連絡がありません</p>
        </div>
      ) : (
        STATUS_GROUPS.map(g => {
          const members = sortMembers(grouped[g.key] ?? [])
          if (members.length === 0) return null
          return (
            <div key={g.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: g.bg, color: g.color }}>
                  {g.label} {members.length}名
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {members.map((a, i) => (
                  <div key={i}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)' }}>
                    {/* アバター */}
                    {a.profile.avatar_url ? (
                      <img src={a.profile.avatar_url} alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                        style={{ background: g.bg, color: g.color }}>
                        {(a.profile.display_name ?? a.profile.full_name).charAt(0)}
                      </div>
                    )}
                    {/* 名前・学年 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                          {a.profile.display_name ?? a.profile.full_name}
                        </span>
                        {a.profile.role !== 'member' && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: 'var(--club-blue-light)',
                              color: 'var(--club-blue)',
                              fontSize: '10px',
                            }}>
                            {a.profile.role === 'captain' ? '主将' : '管理者'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
                        {a.profile.grade}年生
                      </span>
                    </div>
                    {/* 欠席理由 */}
                    {a.reason && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                        {a.reason === 'practice' ? '別練習' :
                         a.reason === 'class'    ? '授業'   :
                         a.reason === 'sick'     ? '体調不良':
                         a.reason === 'personal' ? '私用'   : 'その他'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
