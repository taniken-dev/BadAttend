'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Users,
  CheckCircle2, ClipboardCheck, AlertCircle, RotateCcw, Bell,
  Pencil, CalendarCheck, UserCheck, UserX,
  BookOpen, HeartPulse, User, HelpCircle, Dumbbell,
  ExternalLink,
} from 'lucide-react'
import { useViewRole } from '@/contexts/ViewRoleContext'
import { getWeeklyRegistrationInfo } from '@/lib/utils'
import type { PracticeSession, AttendanceStatus, AbsenceReason, GoogleCalendarEvent } from '@/lib/types'

type SessionMap = Record<string, PracticeSession>

type AttendanceRow = {
  id: string
  status: string
  result_status: string | null
  reason: string | null
  reason_detail: string | null
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
  unsubmitted: MemberProfile[]
  totalApproved: number
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

const REASON_LABELS: Record<string, string> = {
  practice: '別練習・大会',
  class: '授業',
  sick: '体調不良',
  personal: '私用',
  other: 'その他',
}


function ReasonBadge({ reason, reasonDetail }: { reason: string | null; reasonDetail: string | null }) {
  if (!reason) return null
  const label = REASON_LABELS[reason] ?? 'その他'
  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
        style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)' }}>
        {label}
      </span>
      {reasonDetail && (
        <span className="text-xs" style={{ color: 'var(--gray-600)' }}>
          {reasonDetail}
        </span>
      )}
    </div>
  )
}

const STATUS_GROUPS = [
  { key: 'present',           label: '出席予定',    color: '#16a34a', bg: '#dcfce7' },
  { key: 'tardy',             label: '遅刻予定',    color: '#d97706', bg: '#fef3c7' },
  { key: 'absent',            label: '欠席・その他', color: '#dc2626', bg: '#fee2e2' },
]

const MEMBER_STATUS_OPTIONS: {
  value: AttendanceStatus; label: string; description: string; color: string; icon: React.ElementType
}[] = [
  { value: 'present',      label: '出席', description: '練習に参加します',         color: '#16a34a', icon: UserCheck },
  { value: 'tardy',        label: '遅刻', description: '遅れて参加します',         color: '#d97706', icon: Clock },
  { value: 'absent_normal',label: '欠席', description: '理由を選択してください',   color: '#dc2626', icon: UserX },
]

const MEMBER_REASON_OPTIONS: {
  value: AbsenceReason; label: string; icon: React.ElementType; description: string; color: string
}[] = [
  { value: 'practice', label: '別練習・大会', icon: Dumbbell,   description: '他チームとの練習、大会参加など',    color: '#4338ca' },
  { value: 'class',    label: '授業',         icon: BookOpen,   description: '講義、補講、試験など',              color: '#0891b2' },
  { value: 'sick',     label: '体調不良',     icon: HeartPulse, description: '翌日の練習が自動でロックされます',  color: '#dc2626' },
  { value: 'personal', label: '私用',         icon: User,       description: '家族の事情、冠婚葬祭など',          color: '#d97706' },
  { value: 'other',    label: 'その他',       icon: HelpCircle, description: '詳細を自由記述で入力してください',  color: '#6b7280' },
]

const SELF_STATUS_LABELS: Partial<Record<AttendanceStatus, string>> = {
  present:           '出席',
  tardy:             '遅刻',
  absent_normal:     '欠席',
  absent_emergency:  '当日欠席',
  absent_unreported: '無断欠席',
}

const RESULT_STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'present',           label: '出席',      color: '#16a34a' },
  { value: 'tardy',             label: '遅刻',      color: '#d97706' },
  { value: 'absent_normal',     label: '欠席',      color: '#dc2626' },
  { value: 'absent_emergency',  label: '当日欠席',  color: '#9333ea' },
  { value: 'absent_unreported', label: '無連絡欠席', color: '#64748b' },
]

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function CalendarView() {
  const supabase = createClient()
  const today    = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const { viewRole, realRole } = useViewRole()
  const [userId,       setUserId]      = useState<string | null>(null)
  const [current,      setCurrent]     = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [sessions,     setSessions]    = useState<SessionMap>({})
  const [gcalEvents,   setGcalEvents]  = useState<Record<string, GoogleCalendarEvent[]>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detail,       setDetail]      = useState<DayDetail | null>(null)
  const [loading,      setLoading]     = useState(false)

  const isManagerOrAdmin = viewRole === 'manager' || viewRole === 'admin'
  const availableDates = useMemo(() => getWeeklyRegistrationInfo().availableDates, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
    })
  }, [])

  // ── 月のセッション一覧取得 + Google カレンダー自動同期 ────────
  useEffect(() => {
    const y = current.getFullYear()
    const m = current.getMonth()
    const s = toDateStr(y, m, 1)
    const e = toDateStr(y, m, new Date(y, m + 1, 0).getDate())

    // 1. Supabase から即座に既存セッションを表示（高速）
    supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, is_results_confirmed, results_confirmed_at, note, google_event_id, is_camp, created_at')
      .gte('session_date', s)
      .lte('session_date', e)
      .then(({ data }) => {
        const map: SessionMap = {}
        ;(data ?? []).forEach(s => { map[s.session_date] = s as PracticeSession })
        setSessions(map)
      })

    // 2. GCal と自動同期（バックグラウンド）→ 終わったらセッションを上書き
    fetch(`/api/google-calendar/sync?year=${y}&month=${m + 1}`)
      .then(r => r.ok ? r.json() : null)
      .then((body: { sessions: PracticeSession[] } | null) => {
        if (!body) return
        const map: SessionMap = {}
        ;(body.sessions ?? []).forEach(s => { map[s.session_date] = s })
        setSessions(map)
      })
      .catch(() => {})

    // 3. 大会・合宿など（表示のみ）のGCalイベントを取得
    fetch(`/api/google-calendar/events?year=${y}&month=${m + 1}`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(({ events }: { events: GoogleCalendarEvent[] }) => {
        const map: Record<string, GoogleCalendarEvent[]> = {}
        // 活動日は同期済みでセッションとして表示されるのでここでは除外
        ;(events ?? []).filter(ev => !ev.isActivityDay).forEach(ev => {
          if (!map[ev.date]) map[ev.date] = []
          map[ev.date].push(ev)
        })
        setGcalEvents(map)
      })
      .catch(() => {})

    setSelectedDate(null)
    setDetail(null)
  }, [current])

  // ── 日付クリック → 詳細取得 ──────────────────────────────
  const handleDayClick = useCallback(async (dateStr: string) => {
    const session   = sessions[dateStr]
    const hasGcal   = (gcalEvents[dateStr]?.length ?? 0) > 0
    if (!session && !hasGcal) return
    if (selectedDate === dateStr) { setSelectedDate(null); setDetail(null); return }

    setSelectedDate(dateStr)
    setDetail(null)
    setLoading(false)
    if (!session) return  // GCalイベントのみの日は詳細取得不要

    setLoading(true)

    const [{ data: atRows }, { data: allProfiles }] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('id, status, result_status, reason, reason_detail, user_id')
        .eq('session_id', session.id),
      supabase
        .from('profiles')
        .select('id, full_name, display_name, avatar_url, grade, role')
        .eq('is_approved', true),
    ])

    const rows     = (atRows ?? []) as AttendanceRow[]
    const everyone = (allProfiles ?? []) as MemberProfile[]

    const submittedIds = new Set(rows.map(r => r.user_id))
    const profileMap   = Object.fromEntries(everyone.map(p => [p.id, p]))

    const attendance: EnrichedAttendance[] = rows
      .filter(r => profileMap[r.user_id])
      .map(r => ({ ...r, profile: profileMap[r.user_id] }))

    const nonCoachMembers = everyone.filter(p => p.role !== 'coach')
    const unsubmitted = nonCoachMembers.filter(p => !submittedIds.has(p.id))

    setDetail({ session, attendance, unsubmitted, totalApproved: nonCoachMembers.length })
    setLoading(false)
  }, [sessions, selectedDate, gcalEvents])

  // ── 未提出者に実績を新規登録（manager/admin専用） ─────────
  const handleRegisterResultForUnsubmitted = useCallback(async (
    memberId: string,
    sessionId: string,
    sessionDate: string,
    newStatus: AttendanceStatus,
    profile: MemberProfile,
  ) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('attendance_records')
      .upsert({
        session_id: sessionId,
        user_id: memberId,
        status: 'absent_unreported',
        result_status: newStatus,
        verified_by: userId,
      }, { onConflict: 'session_id,user_id' })
      .select('id, status, result_status, reason, reason_detail, user_id')
      .single()
    if (error || !data) return
    setDetail(prev => {
      if (!prev) return prev
      return {
        ...prev,
        attendance: [...prev.attendance, { ...(data as AttendanceRow), profile }],
        unsubmitted: prev.unsubmitted.filter(p => p.id !== memberId),
      }
    })
  }, [userId])

  // ── 実績ステータスを1件更新 ─────────────────────────────
  const handleUpdateResultStatus = useCallback(async (
    recordId: string,
    newStatus: AttendanceStatus,
    sessionDate: string,
  ) => {
    if (!userId || !detail) return
    const { error } = await supabase
      .from('attendance_records')
      .update({ result_status: newStatus, verified_by: userId })
      .eq('id', recordId)
    if (error) return

    // セッションが未確定なら is_results_confirmed を DB でも true にする
    if (!detail.session.is_results_confirmed) {
      await supabase
        .from('practice_sessions')
        .update({
          is_results_confirmed: true,
          results_confirmed_at: new Date().toISOString(),
          results_confirmed_by: userId,
        })
        .eq('id', detail.session.id)
    }

    // detail を楽観的に更新
    setDetail(prev => {
      if (!prev) return prev
      return {
        ...prev,
        session: { ...prev.session, is_results_confirmed: true },
        attendance: prev.attendance.map(a =>
          a.id === recordId ? { ...a, result_status: newStatus } : a
        ),
      }
    })
    setSessions(prev => {
      const session = prev[sessionDate]
      if (!session || session.is_results_confirmed) return prev
      return { ...prev, [sessionDate]: { ...session, is_results_confirmed: true } }
    })
  }, [userId, detail])

  // ── セッション全員の実績を一括確定 ──────────────────────
  const handleBulkConfirm = useCallback(async () => {
    if (!detail || !userId) return
    const sessionId = detail.session.id
    const sessionDate = detail.session.session_date

    // result_status が未設定の行を status で埋める
    const updates = detail.attendance
      .filter(a => !a.result_status)
      .map(a =>
        supabase
          .from('attendance_records')
          .update({ result_status: a.status, verified_by: userId })
          .eq('id', a.id)
      )
    await Promise.all(updates)

    // セッションを確定済みに
    await supabase
      .from('practice_sessions')
      .update({
        is_results_confirmed: true,
        results_confirmed_at: new Date().toISOString(),
        results_confirmed_by: userId,
      })
      .eq('id', sessionId)

    // ローカル state 更新
    setDetail(prev => {
      if (!prev) return prev
      return {
        ...prev,
        session: { ...prev.session, is_results_confirmed: true },
        attendance: prev.attendance.map(a =>
          a.result_status ? a : { ...a, result_status: a.status }
        ),
      }
    })
    setSessions(prev => ({
      ...prev,
      [sessionDate]: { ...prev[sessionDate], is_results_confirmed: true },
    }))
  }, [detail, userId])

  // ── 個別実績を未確定に戻す ──────────────────────────────────
  const handleClearResultStatus = useCallback(async (
    recordId: string,
    sessionDate: string,
  ) => {
    if (!detail) return
    const sessionId = detail.session.id
    const { error } = await supabase
      .from('attendance_records')
      .update({ result_status: null, verified_by: null })
      .eq('id', recordId)
    if (error) return

    const updatedAttendance = detail.attendance.map(a =>
      a.id === recordId ? { ...a, result_status: null } : a
    )
    const allCleared = updatedAttendance.every(a => !a.result_status)

    if (allCleared) {
      await supabase
        .from('practice_sessions')
        .update({ is_results_confirmed: false, results_confirmed_at: null })
        .eq('id', sessionId)
    }

    setDetail(prev => {
      if (!prev) return prev
      return {
        ...prev,
        session: allCleared ? { ...prev.session, is_results_confirmed: false } : prev.session,
        attendance: updatedAttendance,
      }
    })
    if (allCleared) {
      setSessions(prev => ({
        ...prev,
        [sessionDate]: { ...prev[sessionDate], is_results_confirmed: false },
      }))
    }
  }, [detail])

  // ── セッション全員の実績を未確定に戻す ──────────────────────
  const handleRevertAll = useCallback(async () => {
    if (!detail) return
    const sessionId = detail.session.id
    const sessionDate = detail.session.session_date

    const clears = detail.attendance
      .filter(a => a.result_status)
      .map(a =>
        supabase
          .from('attendance_records')
          .update({ result_status: null, verified_by: null })
          .eq('id', a.id)
      )
    await Promise.all(clears)

    await supabase
      .from('practice_sessions')
      .update({ is_results_confirmed: false, results_confirmed_at: null })
      .eq('id', sessionId)

    setDetail(prev => {
      if (!prev) return prev
      return {
        ...prev,
        session: { ...prev.session, is_results_confirmed: false },
        attendance: prev.attendance.map(a => ({ ...a, result_status: null })),
      }
    })
    setSessions(prev => ({
      ...prev,
      [sessionDate]: { ...prev[sessionDate], is_results_confirmed: false },
    }))
  }, [detail])

  // ── 自分の出欠を登録（部員向け） ──────────────────────────
  const handleSelfRegister = useCallback(async (
    status: AttendanceStatus,
    reason: AbsenceReason | null,
    reasonDetail: string,
  ): Promise<string | null> => {
    if (!detail || !userId) return 'エラー'
    const session = detail.session
    const isAbsent = status === 'absent_normal'
    const existingRecord = detail.attendance.find(a => a.user_id === userId) ?? null

    const payload = {
      session_id:    session.id,
      user_id:       userId,
      status,
      reason:        isAbsent ? reason : null,
      reason_detail: isAbsent ? (reasonDetail.trim() || null) : null,
      reported_at:   new Date().toISOString(),
    }

    let resultData: AttendanceRow | null = null
    let dbError: unknown = null

    if (existingRecord) {
      const { data, error } = await supabase
        .from('attendance_records')
        .update(payload)
        .eq('id', existingRecord.id)
        .select('id, status, result_status, reason, reason_detail, user_id')
        .single()
      resultData = data as AttendanceRow | null
      dbError = error
    } else {
      const { data, error } = await supabase
        .from('attendance_records')
        .insert(payload)
        .select('id, status, result_status, reason, reason_detail, user_id')
        .single()
      resultData = data as AttendanceRow | null
      dbError = error
    }

    if (dbError || !resultData) return (dbError as { message?: string })?.message ?? 'エラーが発生しました'

    setDetail(prev => {
      if (!prev) return prev
      const profile =
        prev.attendance.find(a => a.user_id === userId)?.profile ??
        (prev.unsubmitted.find(p => p.id === userId) as MemberProfile | undefined)
      if (!profile) return prev
      const newEntry: EnrichedAttendance = { ...resultData!, profile }
      return {
        ...prev,
        attendance: existingRecord
          ? prev.attendance.map(a => a.user_id === userId ? newEntry : a)
          : [...prev.attendance, newEntry],
        unsubmitted: prev.unsubmitted.filter(p => p.id !== userId),
      }
    })

    return null
  }, [detail, userId])

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
            const dow      = (firstDow + day - 1) % 7
            const dateStr  = toDateStr(y, m, day)
            const session  = sessions[dateStr]
            const dayGcal  = gcalEvents[dateStr] ?? []
            const hasGcal  = dayGcal.length > 0
            const isToday    = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const confirmed  = session?.is_results_confirmed
            const isClickable = !!session || hasGcal

            // 練習ドット色（合宿=オレンジ、通常練習=赤、確定済み=緑、休止=グレー）
            const dotColor = session
              ? isSelected
                ? 'rgba(255,255,255,0.7)'
                : session.is_cancelled
                ? 'var(--gray-300)'
                : confirmed
                ? '#16a34a'
                : session.is_camp
                ? '#f97316'
                : '#ef4444'
              : 'transparent'

            // GCalドット色（大会など=青）
            const gcalDotColor = isSelected
              ? 'rgba(255,255,255,0.7)'
              : 'var(--club-blue)'

            return (
              <div key={dateStr}
                onClick={() => handleDayClick(dateStr)}
                className="flex flex-col items-center py-1.5 rounded-xl transition-all duration-150 select-none"
                style={{
                  cursor:     isClickable ? 'pointer' : 'default',
                  background: isSelected
                    ? 'var(--club-blue)'
                    : isToday
                    ? 'var(--club-blue-muted)'
                    : 'transparent',
                }}
                onMouseEnter={e => {
                  if (isClickable && !isSelected)
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
                {/* ドット行 */}
                <div className="flex items-center gap-0.5 mt-0.5" style={{ minHeight: 8 }}>
                  {/* 練習ドット（確定済みはチェックアイコン） */}
                  {session && !session.is_cancelled && confirmed && !isSelected
                    ? <CheckCircle2 size={8} style={{ color: session.is_camp ? '#f97316' : '#16a34a' }} />
                    : session
                    ? <span className="w-1 h-1 rounded-full" style={{ background: dotColor }} />
                    : null}
                  {/* GCalドット */}
                  {hasGcal && (
                    <span className="w-1 h-1 rounded-full" style={{ background: gcalDotColor }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3"
          style={{ borderTop: '1px solid var(--gray-100)' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: '#ef4444' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>練習日</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: '#f97316' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>合宿</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={8} style={{ color: '#16a34a' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>実績確定済み</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--club-blue)' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>大会など</span>
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

      {/* 詳細パネル（練習日） */}
      {selectedDate && (detail || loading) && (
        <div className="card animate-slide-up" style={{ animationDelay: '0.04s' }}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--gray-200)', borderTopColor: 'var(--club-blue)' }} />
            </div>
          ) : detail ? (
            <DetailPanel
              detail={detail}
              isManagerOrAdmin={isManagerOrAdmin}
              canSelfRegister={realRole !== 'coach'}
              userId={userId}
              availableDates={availableDates}
              onSelfRegister={handleSelfRegister}
              onUpdateResultStatus={(id, status) =>
                handleUpdateResultStatus(id, status, detail.session.session_date)
              }
              onBulkConfirm={handleBulkConfirm}
              onClearResultStatus={(id) =>
                handleClearResultStatus(id, detail.session.session_date)
              }
              onRevertAll={handleRevertAll}
              onRegisterForUnsubmitted={(memberId, status, profile) =>
                handleRegisterResultForUnsubmitted(
                  memberId, detail.session.id, detail.session.session_date, status, profile
                )
              }
              onRemind={async (userIds) => {
                await fetch('/api/line/notify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userIds, sessionDate: detail.session.session_date }),
                })
              }}
            />
          ) : null}
        </div>
      )}

      {/* GCalイベントパネル（大会・合宿など表示のみ） */}
      {selectedDate && (gcalEvents[selectedDate]?.length ?? 0) > 0 && (
        <GCalEventsPanel events={gcalEvents[selectedDate]} />
      )}
    </div>
  )
}

// ── Google カレンダーイベントパネル（表示のみ）───────────────────
function GCalEventsPanel({ events }: { events: GoogleCalendarEvent[] }) {
  return (
    <div className="card animate-slide-up" style={{ animationDelay: '0.08s' }}>
      <div className="flex items-center gap-2 mb-3">
        <ExternalLink size={14} style={{ color: 'var(--club-blue)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
          Googleカレンダーの予定
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {events.map(ev => (
          <div key={ev.id}
            className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--club-blue)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                {ev.title}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 pl-4">
              {ev.startTime && ev.endTime && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--gray-500)' }}>
                  <Clock size={11} />
                  {ev.startTime} 〜 {ev.endTime}
                </div>
              )}
              {ev.location && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--gray-500)' }}>
                  <MapPin size={11} />
                  {ev.location}
                </div>
              )}
              {ev.description && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
                  {ev.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 詳細パネル ────────────────────────────────────────────────
function DetailPanel({
  detail,
  isManagerOrAdmin,
  canSelfRegister,
  userId,
  availableDates,
  onSelfRegister,
  onUpdateResultStatus,
  onBulkConfirm,
  onClearResultStatus,
  onRevertAll,
  onRegisterForUnsubmitted,
  onRemind,
}: {
  detail: DayDetail
  isManagerOrAdmin: boolean
  canSelfRegister: boolean
  userId: string | null
  availableDates: string[]
  onSelfRegister: (status: AttendanceStatus, reason: AbsenceReason | null, detail: string) => Promise<string | null>
  onUpdateResultStatus: (id: string, status: AttendanceStatus) => Promise<void>
  onBulkConfirm: () => Promise<void>
  onClearResultStatus: (id: string) => Promise<void>
  onRevertAll: () => Promise<void>
  onRegisterForUnsubmitted: (memberId: string, status: AttendanceStatus, profile: MemberProfile) => Promise<void>
  onRemind: (userIds: string[]) => Promise<void>
}) {
  const { session, attendance, unsubmitted, totalApproved } = detail
  const [confirming,              setConfirming]              = useState(false)
  const [reverting,               setReverting]               = useState(false)
  const [updatingId,              setUpdatingId]              = useState<string | null>(null)
  const [clearingId,              setClearingId]              = useState<string | null>(null)
  const [pendingStatus,           setPendingStatus]           = useState<Record<string, AttendanceStatus>>({})
  const [registeringId,           setRegisteringId]           = useState<string | null>(null)
  const [pendingUnsubmitted,      setPendingUnsubmitted]      = useState<Record<string, AttendanceStatus>>({})
  const [reminding,               setReminding]               = useState(false)
  const [remindResult,            setRemindResult]            = useState<{ sent: number } | 'error' | null>(null)

  // 自己登録フォーム（部員向け）
  const [selfFormOpen,    setSelfFormOpen]    = useState(false)
  const [selfStatus,      setSelfStatus]      = useState<AttendanceStatus | null>(null)
  const [selfReason,      setSelfReason]      = useState<AbsenceReason | null>(null)
  const [selfDetail,      setSelfDetail]      = useState('')
  const [selfSubmitting,  setSelfSubmitting]  = useState(false)
  const [selfError,       setSelfError]       = useState<string | null>(null)
  const [selfIsEditing,   setSelfIsEditing]   = useState(false)

  // セッションが変わったらフォームをリセット
  useEffect(() => {
    setSelfFormOpen(false)
    setSelfStatus(null)
    setSelfReason(null)
    setSelfDetail('')
    setSelfError(null)
    setSelfIsEditing(false)
  }, [session.id])

  const myRecord = attendance.find(a => a.user_id === userId) ?? null
  // 合宿は公開後いつでも出欠登録可能、通常練習は登録可能期間のみ
  const canRegister = !session.is_cancelled &&
    (session.is_camp || availableDates.includes(session.session_date))

  // 実績登録は練習開始時刻以降のみ（合宿は常に可能）
  const sessionStartAt = new Date(`${session.session_date}T${session.start_time}`)
  const canRegisterResult = session.is_camp || new Date() >= sessionStartAt
  const selfIsAbsent = selfStatus === 'absent_normal'

  function openSelfForm(editing = false) {
    setSelfIsEditing(editing)
    setSelfError(null)
    if (editing && myRecord) {
      const displayStatus = (
        myRecord.status === 'absent_emergency' || myRecord.status === 'absent_unreported'
          ? 'absent_normal'
          : myRecord.status
      ) as AttendanceStatus
      setSelfStatus(displayStatus)
      setSelfReason(myRecord.reason as AbsenceReason | null)
      setSelfDetail(myRecord.reason_detail ?? '')
    } else {
      setSelfStatus(null)
      setSelfReason(null)
      setSelfDetail('')
    }
    setSelfFormOpen(true)
  }

  function closeSelfForm() {
    setSelfFormOpen(false)
    setSelfIsEditing(false)
    setSelfStatus(null)
    setSelfReason(null)
    setSelfDetail('')
    setSelfError(null)
  }

  async function handleSelfSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selfStatus) return
    if (selfIsAbsent && !selfReason) return
    if (selfIsAbsent && selfReason === 'other' && !selfDetail.trim()) return
    setSelfSubmitting(true)
    setSelfError(null)
    const err = await onSelfRegister(selfStatus, selfIsAbsent ? selfReason : null, selfDetail)
    setSelfSubmitting(false)
    if (err) { setSelfError(err); return }
    closeSelfForm()
  }

  const dateObj   = new Date(session.session_date + 'T00:00:00')
  const dateLabel = dateObj.toLocaleDateString('ja-JP', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  const notYet = totalApproved - attendance.length

  const roleOrder: Record<string, number> = { admin: 0, manager: 1, member: 2, coach: 3 }
  const sortMembers = (list: EnrichedAttendance[]) =>
    [...list].sort((a, b) => {
      const roleDiff = (roleOrder[a.profile.role] ?? 2) - (roleOrder[b.profile.role] ?? 2)
      if (roleDiff !== 0) return roleDiff
      const gradeDiff = (b.profile.grade ?? 0) - (a.profile.grade ?? 0)
      if (gradeDiff !== 0) return gradeDiff
      const nameA = a.profile.display_name ?? a.profile.full_name
      const nameB = b.profile.display_name ?? b.profile.full_name
      return nameA.localeCompare(nameB, 'ja')
    })

  const allMembers = sortMembers(attendance)
  const unconfirmedCount = attendance.filter(a => !a.result_status).length

  async function handleBulk() {
    setConfirming(true)
    await onBulkConfirm()
    setConfirming(false)
  }

  async function handleConfirmOne(id: string, status: AttendanceStatus) {
    setUpdatingId(id)
    await onUpdateResultStatus(id, status)
    setUpdatingId(null)
  }

  async function handleClear(id: string) {
    setClearingId(id)
    await onClearResultStatus(id)
    setClearingId(null)
  }

  async function handleRevert() {
    setReverting(true)
    await onRevertAll()
    setReverting(false)
  }

  async function handleRemind() {
    const userIds = unsubmitted.map(p => p.id)
    if (userIds.length === 0) return
    setReminding(true)
    setRemindResult(null)
    try {
      await onRemind(userIds)
      setRemindResult({ sent: userIds.length })
    } catch {
      setRemindResult('error')
    } finally {
      setReminding(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* セッション情報ヘッダー */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>
            {dateLabel}の練習
          </h2>
          <div className="flex items-center gap-2">
            {session.is_results_confirmed && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: '#dcfce7', color: '#15803d' }}>
                  <CheckCircle2 size={11} />
                  実績確定済み
                </span>
                {isManagerOrAdmin && (
                  <button
                    onClick={handleRevert}
                    disabled={reverting}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold cursor-pointer transition-opacity hover:opacity-70"
                    style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', border: '1px solid var(--gray-200)' }}
                    title="全員の実績確定を解除"
                  >
                    {reverting
                      ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                      : <RotateCcw size={10} />}
                    全解除
                  </button>
                )}
              </div>
            )}
            {session.is_cancelled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: '#fee2e2', color: '#b91c1c' }}>休止</span>
            )}
          </div>
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

      {/* 自分の出欠連絡（顧問以外・登録可能期間のみ） */}
      {canSelfRegister && userId && canRegister && (
        <div className="rounded-xl px-4 py-3.5 flex flex-col gap-3"
          style={{ background: 'color-mix(in srgb, var(--club-blue) 6%, var(--card-bg))', border: '1.5px solid color-mix(in srgb, var(--club-blue) 25%, white)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
              あなたの出欠連絡
            </h3>
            {myRecord && !selfFormOpen && (
              <button
                onClick={() => openSelfForm(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)' }}
              >
                <Pencil size={11} /> 変更
              </button>
            )}
          </div>

          {!selfFormOpen && myRecord ? (
            // 登録済み表示
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: myRecord.status === 'present' ? '#dcfce7' : myRecord.status === 'tardy' ? '#fef3c7' : '#fee2e2',
                  color: myRecord.status === 'present' ? '#16a34a' : myRecord.status === 'tardy' ? '#d97706' : '#dc2626',
                }}>
                <CheckCircle2 size={13} />
                {SELF_STATUS_LABELS[myRecord.status as AttendanceStatus] ?? myRecord.status}
              </span>
              {myRecord.reason && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)' }}>
                  {REASON_LABELS[myRecord.reason] ?? myRecord.reason}
                  {myRecord.reason_detail ? `：${myRecord.reason_detail}` : ''}
                </span>
              )}
            </div>
          ) : selfFormOpen ? (
            // 登録フォーム
            <form onSubmit={handleSelfSubmit} className="flex flex-col gap-3">
              {selfError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  <AlertCircle size={13} /> {selfError}
                </div>
              )}
              {selfIsEditing && (
                <span className="self-start text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'var(--club-amber-light)', color: 'var(--club-amber)' }}>
                  編集中
                </span>
              )}

              {/* ステータス選択 */}
              <div className="grid grid-cols-3 gap-2">
                {MEMBER_STATUS_OPTIONS.map(({ value, label, description, color, icon: Icon }) => {
                  const active = selfStatus === value
                    || (value === 'absent_normal' && (selfStatus === 'absent_emergency' || selfStatus === 'absent_unreported'))
                  return (
                    <button key={value} type="button"
                      onClick={() => { setSelfStatus(value); if (value !== 'absent_normal') setSelfReason(null) }}
                      className="flex flex-col items-center gap-2 py-3 rounded-xl text-center transition-all"
                      style={{
                        border: `1.5px solid ${active ? color : 'var(--gray-200)'}`,
                        background: active ? `color-mix(in srgb, ${color} 15%, var(--gray-100))` : 'var(--gray-100)',
                      }}
                    >
                      <Icon size={18} style={{ color: active ? color : 'var(--gray-500)' }} />
                      <span className="text-xs font-bold" style={{ color: active ? color : 'var(--gray-700)' }}>{label}</span>
                      <span className="text-xs leading-tight" style={{ color: active ? color : 'var(--gray-500)', opacity: 0.85 }}>
                        {description}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* 欠席理由 */}
              {selfIsAbsent && (
                <>
                  <div className="flex flex-col gap-1.5">
                    {MEMBER_REASON_OPTIONS.map(({ value, label, icon: Icon, description, color }) => {
                      const active = selfReason === value
                      return (
                        <button key={value} type="button"
                          onClick={() => setSelfReason(value)}
                          className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                          style={{
                            border: `1.5px solid ${active ? color : 'var(--gray-200)'}`,
                            background: active ? `color-mix(in srgb, ${color} 15%, var(--gray-100))` : 'var(--gray-100)',
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: active ? `color-mix(in srgb, ${color} 20%, var(--gray-200))` : 'var(--gray-200)' }}>
                            <Icon size={16} style={{ color: active ? color : 'var(--gray-600)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold" style={{ color: active ? color : 'var(--gray-700)' }}>{label}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>{description}</p>
                          </div>
                          {active && <CheckCircle2 size={15} style={{ color, flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={selfDetail}
                    onChange={e => setSelfDetail(e.target.value)}
                    className="input-field resize-none"
                    rows={2}
                    placeholder={selfReason === 'other' ? '欠席理由を入力してください（必須）' : '補足事項があれば入力してください'}
                    maxLength={200}
                  />
                </>
              )}

              <div className="flex gap-2">
                <button type="submit"
                  className="btn-primary flex-1"
                  disabled={
                    !selfStatus
                    || (selfIsAbsent && !selfReason)
                    || (selfIsAbsent && selfReason === 'other' && !selfDetail.trim())
                    || selfSubmitting
                  }
                >
                  {selfSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {selfIsEditing ? '更新中...' : '送信中...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <CalendarCheck size={14} />
                      {selfIsEditing ? '内容を更新する' : '連絡する'}
                    </span>
                  )}
                </button>
                <button type="button" onClick={closeSelfForm} className="btn-secondary"
                  style={{ flex: '0 0 auto', padding: '0 16px', width: 'auto' }}>
                  キャンセル
                </button>
              </div>
            </form>
          ) : (
            // 未登録 + フォーム未開放
            <button
              onClick={() => openSelfForm(false)}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--club-blue)', color: 'white' }}
            >
              <CalendarCheck size={15} /> 出欠を連絡する
            </button>
          )}
        </div>
      )}

      {/* マネージャー/管理者向け：一括確定ボタン（練習開始時刻以降のみ） */}
      {isManagerOrAdmin && attendance.length > 0 && !session.is_cancelled && canRegisterResult && (
        <div className="flex flex-col gap-2 px-3 py-3 rounded-xl"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={15} style={{ color: '#15803d' }} />
            <span className="text-sm font-semibold" style={{ color: '#15803d' }}>
              実績管理
            </span>
            {unconfirmedCount > 0 && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: '#fef3c7', color: '#b45309' }}>
                未確定 {unconfirmedCount}名
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: '#166534' }}>
            各メンバーの実績ステータスを個別に変更するか、「一括確定」で予定をそのまま実績として保存できます。
          </p>
          {unconfirmedCount > 0 && (
            <button
              onClick={handleBulk}
              disabled={confirming}
              className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-95 hover:opacity-80"
              style={{ background: '#16a34a', color: 'white', opacity: confirming ? 0.7 : 1 }}
            >
              {confirming ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              {confirming ? '確定中...' : `予定をそのまま実績として一括確定（${unconfirmedCount}名）`}
            </button>
          )}
        </div>
      )}

      {/* 出欠リスト */}
      {attendance.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-1">
          <p className="text-sm" style={{ color: 'var(--gray-400)' }}>まだ連絡がありません</p>
        </div>
      ) : isManagerOrAdmin ? (
        // マネージャー/管理者：個別実績編集UI
        <div className="flex flex-col gap-2">
          {allMembers.map(a => {
            const statusGroup = STATUS_GROUPS.find(g =>
              g.key === (a.status.startsWith('absent') ? 'absent' : a.status)
            )
            const confirmedOption = RESULT_STATUS_OPTIONS.find(o => o.value === a.result_status)
            const isDiverged = a.result_status && a.result_status !== a.status

            return (
              <div key={a.id}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                style={{
                  background: 'var(--gray-50)',
                  border: `1px solid ${isDiverged ? '#fcd34d' : 'var(--gray-100)'}`,
                  opacity: updatingId === a.id ? 0.6 : 1,
                }}>
                {/* アバター */}
                {a.profile.avatar_url ? (
                  <img src={a.profile.avatar_url} alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5"
                    style={{ background: statusGroup?.bg ?? 'var(--gray-100)', color: statusGroup?.color ?? 'var(--gray-500)' }}>
                    {(a.profile.display_name ?? a.profile.full_name).charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* 名前行 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                      {a.profile.display_name ?? a.profile.full_name}
                    </span>
                    {a.profile.role !== 'member' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--club-blue-light)', color: 'var(--club-blue)', fontSize: '10px' }}>
                        {a.profile.role === 'admin' ? '管理者'
                          : a.profile.role === 'manager' ? 'MGR'
                          : a.profile.role === 'coach' ? '顧問'
                          : a.profile.role}
                      </span>
                    )}
                    {isDiverged && (
                      <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                        style={{ background: '#fef3c7', color: '#b45309', fontSize: '10px' }}>
                        <AlertCircle size={9} />
                        予定と実績が異なります
                      </span>
                    )}
                  </div>

                  {/* 欠席理由 */}
                  {a.reason && <ReasonBadge reason={a.reason} reasonDetail={a.reason_detail} />}

                  {/* 予定 + 実績 */}
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {/* 未確定: 予定バッジ（＋開始時刻以降なら実績プルダウン＋確定ボタン） */}
                    {!a.result_status ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: 'var(--gray-400)' }}>予定:</span>
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: statusGroup?.bg ?? 'var(--gray-100)',
                              color: statusGroup?.color ?? 'var(--gray-500)',
                            }}>
                            {RESULT_STATUS_OPTIONS.find(o => o.value === a.status)?.label ?? a.status}
                          </span>
                        </div>
                        {canRegisterResult && (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-xs" style={{ color: 'var(--gray-400)' }}>実績:</span>
                              <select
                                value={pendingStatus[a.id] ?? a.status}
                                disabled={updatingId === a.id}
                                onChange={e => setPendingStatus(prev => ({ ...prev, [a.id]: e.target.value as AttendanceStatus }))}
                                className="text-xs rounded-lg border px-1.5 py-0.5 cursor-pointer"
                                style={{
                                  borderColor: 'var(--gray-200)',
                                  background: 'var(--card-bg)',
                                  color: RESULT_STATUS_OPTIONS.find(o => o.value === (pendingStatus[a.id] ?? a.status))?.color ?? 'var(--gray-700)',
                                  fontSize: '12px',
                                }}
                              >
                                {RESULT_STATUS_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => handleConfirmOne(a.id, (pendingStatus[a.id] ?? a.status) as AttendanceStatus)}
                              disabled={updatingId === a.id}
                              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-80"
                              style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}
                            >
                              {updatingId === a.id
                                ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                                : <CheckCircle2 size={11} />}
                              確定
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      /* 確定済み: 実績バッジ＋取消ボタン */
                      <>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: (confirmedOption?.color ?? '#888') + '22',
                            color: confirmedOption?.color ?? 'var(--gray-700)',
                          }}>
                          実績: {confirmedOption?.label ?? a.result_status}
                        </span>
                        <button
                          onClick={() => handleClear(a.id)}
                          disabled={clearingId === a.id}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-70"
                          style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', border: '1px solid var(--gray-200)' }}
                        >
                          {clearingId === a.id
                            ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                            : <RotateCcw size={10} />}
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // 一般ユーザー：従来の読み取り専用グループ表示
        STATUS_GROUPS.map(g => {
          const members = sortMembers(
            attendance.filter(a => (a.status.startsWith('absent') ? 'absent' : a.status) === g.key)
          )
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
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)' }}>
                    {a.profile.avatar_url ? (
                      <img src={a.profile.avatar_url} alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5"
                        style={{ background: g.bg, color: g.color }}>
                        {(a.profile.display_name ?? a.profile.full_name).charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                          {a.profile.display_name ?? a.profile.full_name}
                        </span>
                        {a.profile.role !== 'member' && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--club-blue-light)', color: 'var(--club-blue)', fontSize: '10px' }}>
                            {a.profile.role === 'admin' ? '管理者'
                              : a.profile.role === 'manager' ? 'MGR'
                              : a.profile.role === 'coach' ? '顧問'
                              : a.profile.role}
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
                        {a.profile.grade}年生
                      </span>
                      <ReasonBadge reason={a.reason} reasonDetail={a.reason_detail} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* 未提出者リスト（提出者リストの下） */}
      {unsubmitted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fef3c7', color: '#b45309' }}>
              未提出 {unsubmitted.length}名
            </span>
            {isManagerOrAdmin && (
              <button
                onClick={handleRemind}
                disabled={reminding}
                className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
                style={{ background: '#06c755', color: 'white', opacity: reminding ? 0.7 : 1 }}
              >
                {reminding
                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Bell size={12} />}
                {reminding ? '送信中...' : 'LINEでリマインド'}
              </button>
            )}
          </div>
          {remindResult !== null && (
            <div className="mb-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={
                remindResult === 'error'
                  ? { background: '#fee2e2', color: '#b91c1c' }
                  : { background: '#dcfce7', color: '#15803d' }
              }>
              {remindResult === 'error'
                ? 'LINE送信に失敗しました'
                : `${(remindResult as { sent: number }).sent}名にLINEを送信しました`}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {[...unsubmitted]
              .sort((a, b) => {
                const roleDiff = (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2)
                if (roleDiff !== 0) return roleDiff
                const gradeDiff = (b.grade ?? 0) - (a.grade ?? 0)
                if (gradeDiff !== 0) return gradeDiff
                const nameA = a.display_name ?? a.full_name
                const nameB = b.display_name ?? b.full_name
                return nameA.localeCompare(nameB, 'ja')
              })
              .map(p => {
                const pendingVal = pendingUnsubmitted[p.id] ?? 'absent_unreported' as AttendanceStatus
                return (
                  <div key={p.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl flex-wrap"
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      opacity: registeringId === p.id ? 0.6 : 1,
                    }}>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                        style={{ background: '#fef3c7', color: '#b45309' }}>
                        {(p.display_name ?? p.full_name).charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-medium" style={{ color: 'var(--gray-700)' }}>
                      {p.display_name ?? p.full_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
                      {p.grade}年生
                    </span>

                    {isManagerOrAdmin && canRegisterResult && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <select
                          value={pendingVal}
                          disabled={registeringId === p.id}
                          onChange={e => setPendingUnsubmitted(prev => ({
                            ...prev, [p.id]: e.target.value as AttendanceStatus,
                          }))}
                          className="text-xs rounded-lg border px-1.5 py-0.5 cursor-pointer"
                          style={{
                            borderColor: 'var(--gray-200)',
                            background: 'var(--card-bg)',
                            color: RESULT_STATUS_OPTIONS.find(o => o.value === pendingVal)?.color ?? 'var(--gray-700)',
                            fontSize: '12px',
                          }}
                        >
                          {RESULT_STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          disabled={registeringId === p.id}
                          onClick={async () => {
                            setRegisteringId(p.id)
                            await onRegisterForUnsubmitted(p.id, pendingVal, p)
                            setPendingUnsubmitted(prev => { const n = { ...prev }; delete n[p.id]; return n })
                            setRegisteringId(null)
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-80"
                          style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}
                        >
                          {registeringId === p.id
                            ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                            : <CheckCircle2 size={11} />}
                          実績登録
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
