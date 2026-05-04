'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Users,
  CheckCircle2, ClipboardCheck, AlertCircle,
} from 'lucide-react'
import type { PracticeSession, AttendanceStatus } from '@/lib/types'

type SessionMap = Record<string, PracticeSession>

type AttendanceRow = {
  id: string
  status: string
  result_status: string | null
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

const RESULT_STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'present',           label: '出席',      color: '#16a34a' },
  { value: 'tardy',             label: '遅刻',      color: '#d97706' },
  { value: 'absent_normal',     label: '欠席',      color: '#dc2626' },
  { value: 'absent_emergency',  label: '緊急欠席',  color: '#9333ea' },
  { value: 'absent_unreported', label: '無連絡欠席', color: '#64748b' },
]

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function CalendarView() {
  const supabase = createClient()
  const today    = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [role,         setRole]        = useState<string | null>(null)
  const [userId,       setUserId]      = useState<string | null>(null)
  const [current,      setCurrent]     = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [sessions,     setSessions]    = useState<SessionMap>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detail,       setDetail]      = useState<DayDetail | null>(null)
  const [loading,      setLoading]     = useState(false)

  const isManagerOrAdmin = role === 'manager' || role === 'admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setRole(data?.role ?? null))
    })
  }, [])

  // ── 月のセッション一覧取得 ─────────────────────────────────
  useEffect(() => {
    const y = current.getFullYear()
    const m = current.getMonth()
    const s = toDateStr(y, m, 1)
    const e = toDateStr(y, m, new Date(y, m + 1, 0).getDate())

    supabase
      .from('practice_sessions')
      .select('id, session_date, start_time, end_time, location, is_cancelled, is_results_confirmed, results_confirmed_at, note, created_at')
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
        .select('id, status, result_status, reason, user_id')
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

  // ── 実績ステータスを1件更新 ─────────────────────────────
  const handleUpdateResultStatus = useCallback(async (
    recordId: string,
    newStatus: AttendanceStatus,
    sessionDate: string,
  ) => {
    if (!userId) return
    const { error } = await supabase
      .from('attendance_records')
      .update({ result_status: newStatus, verified_by: userId })
      .eq('id', recordId)
    if (error) return
    // detail を楽観的に更新
    setDetail(prev => {
      if (!prev) return prev
      return {
        ...prev,
        attendance: prev.attendance.map(a =>
          a.id === recordId ? { ...a, result_status: newStatus } : a
        ),
      }
    })
    // sessions の確定フラグを更新（未確定→確定済みに）
    setSessions(prev => {
      const session = prev[sessionDate]
      if (!session || session.is_results_confirmed) return prev
      return { ...prev, [sessionDate]: { ...session, is_results_confirmed: true } }
    })
  }, [userId])

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
            const isToday    = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const confirmed  = session?.is_results_confirmed

            // ドット色：確定済み=緑、通常練習=青、休止=グレー
            const dotColor = session
              ? isSelected
                ? 'rgba(255,255,255,0.7)'
                : session.is_cancelled
                ? 'var(--gray-300)'
                : confirmed
                ? '#16a34a'
                : 'var(--club-blue)'
              : 'transparent'

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
                {/* 練習ドット（確定済みはチェックアイコン） */}
                {session && !session.is_cancelled && confirmed && !isSelected ? (
                  <CheckCircle2 size={8} style={{ color: '#16a34a', marginTop: 1 }} />
                ) : (
                  <span className="w-1 h-1 rounded-full" style={{ background: dotColor }} />
                )}
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
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>練習日（予定）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={8} style={{ color: '#16a34a' }} />
            <span className="text-xs" style={{ color: 'var(--gray-500)' }}>実績確定済み</span>
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
            <DetailPanel
              detail={detail}
              isManagerOrAdmin={isManagerOrAdmin}
              onUpdateResultStatus={(id, status) =>
                handleUpdateResultStatus(id, status, detail.session.session_date)
              }
              onBulkConfirm={handleBulkConfirm}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── 詳細パネル ────────────────────────────────────────────────
function DetailPanel({
  detail,
  isManagerOrAdmin,
  onUpdateResultStatus,
  onBulkConfirm,
}: {
  detail: DayDetail
  isManagerOrAdmin: boolean
  onUpdateResultStatus: (id: string, status: AttendanceStatus) => Promise<void>
  onBulkConfirm: () => Promise<void>
}) {
  const { session, attendance, totalApproved } = detail
  const [confirming, setConfirming] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const dateObj   = new Date(session.session_date + 'T00:00:00')
  const dateLabel = dateObj.toLocaleDateString('ja-JP', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  const notYet = totalApproved - attendance.length

  const roleOrder: Record<string, number> = { admin: 0, manager: 1, member: 2, coach: 3 }
  const sortMembers = (list: EnrichedAttendance[]) =>
    [...list].sort((a, b) => (roleOrder[a.profile.role] ?? 2) - (roleOrder[b.profile.role] ?? 2))

  const allMembers = sortMembers(attendance)
  const unconfirmedCount = attendance.filter(a => !a.result_status).length

  async function handleUpdate(id: string, status: AttendanceStatus) {
    setUpdatingId(id)
    await onUpdateResultStatus(id, status)
    setUpdatingId(null)
  }

  async function handleBulk() {
    setConfirming(true)
    await onBulkConfirm()
    setConfirming(false)
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
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: '#dcfce7', color: '#15803d' }}>
                <CheckCircle2 size={11} />
                実績確定済み
              </span>
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

      {/* マネージャー/管理者向け：一括確定ボタン */}
      {isManagerOrAdmin && attendance.length > 0 && !session.is_cancelled && (
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
            const effectiveStatus = (a.result_status ?? a.status) as AttendanceStatus
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
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
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

                  {/* 予定 + 実績 セレクト */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 予定（読み取り専用バッジ） */}
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

                    {/* 実績（変更可能） */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--gray-400)' }}>実績:</span>
                      <select
                        value={effectiveStatus}
                        disabled={updatingId === a.id}
                        onChange={e => handleUpdate(a.id, e.target.value as AttendanceStatus)}
                        className="text-xs rounded-lg border px-1.5 py-0.5 cursor-pointer"
                        style={{
                          borderColor: 'var(--gray-200)',
                          background: 'white',
                          color: RESULT_STATUS_OPTIONS.find(o => o.value === effectiveStatus)?.color ?? 'var(--gray-700)',
                          fontSize: '12px',
                        }}
                      >
                        {RESULT_STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
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
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)' }}>
                    {a.profile.avatar_url ? (
                      <img src={a.profile.avatar_url} alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
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
                    </div>
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
