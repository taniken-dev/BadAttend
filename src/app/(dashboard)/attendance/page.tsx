'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck,
  Clock,
  BookOpen,
  HeartPulse,
  User,
  HelpCircle,
  Dumbbell,
  AlertCircle,
  CheckCircle2,
  Lock,
  Pencil,
  UserCheck,
  UserX,
  ChevronRight,
} from 'lucide-react'
import { isEmergencyReport, getWeeklyRegistrationInfo } from '@/lib/utils'
import {
  ATTENDANCE_STATUS_LABELS,
  REASON_LABELS,
  STATUS_BADGE,
  type PracticeSession,
  type AttendanceRecord,
  type AbsenceReason,
  type AttendanceStatus,
} from '@/lib/types'

const STATUS_OPTIONS: {
  value: AttendanceStatus
  label: string
  description: string
  color: string
  icon: React.ElementType
}[] = [
  { value: 'present',      label: '出席', description: '練習に参加します',         color: '#16a34a', icon: UserCheck },
  { value: 'tardy',        label: '遅刻', description: '遅れて参加します',         color: '#d97706', icon: Clock },
  { value: 'absent_normal',label: '欠席', description: '理由を選択してください',   color: '#dc2626', icon: UserX },
]

const REASON_OPTIONS: {
  value: AbsenceReason
  label: string
  icon: React.ElementType
  description: string
  color: string
}[] = [
  { value: 'practice', label: '別練習・大会', icon: Dumbbell,   description: '他チームとの練習、大会参加など',    color: '#4338ca' },
  { value: 'class',    label: '授業',         icon: BookOpen,   description: '講義、補講、試験など',              color: '#0891b2' },
  { value: 'sick',     label: '体調不良',     icon: HeartPulse, description: '翌日の練習が自動でロックされます',  color: '#dc2626' },
  { value: 'personal', label: '私用',         icon: User,       description: '家族の事情、冠婚葬祭など',          color: '#d97706' },
  { value: 'other',    label: 'その他',       icon: HelpCircle, description: '詳細を自由記述で入力してください', color: '#6b7280' },
]

export default function AttendancePage() {
  const supabase = createClient()
  const router = useRouter()

  // セッション一覧
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord | null>>({})
  const [isLocked, setIsLocked] = useState(false)
  const [regInfo, setRegInfo] = useState<ReturnType<typeof getWeeklyRegistrationInfo> | null>(null)
  const [loading, setLoading] = useState(true)

  // フォーム
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(null)
  const [selectedReason, setSelectedReason] = useState<AbsenceReason | null>(null)
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [flashSessionId, setFlashSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const existingRecord = activeSessionId ? (recordsMap[activeSessionId] ?? null) : null
  const isAbsent = selectedStatus === 'absent_normal' || selectedStatus === 'absent_emergency'
  const isEmergency = activeSession
    ? isEmergencyReport(activeSession.session_date, activeSession.start_time)
    : false

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // coach（顧問）はこのページを使用しない
    const { data: myProfile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (myProfile?.role === 'coach') {
      router.replace('/dashboard')
      return
    }
    // member / manager / admin は出欠連絡可能

    const info = getWeeklyRegistrationInfo()
    setRegInfo(info)

    if (info.availableDates.length > 0) {
      const { data: practiceSessions } = await supabase
        .from('practice_sessions')
        .select('*')
        .in('session_date', info.availableDates)
        .eq('is_cancelled', false)
        .order('session_date')

      if (practiceSessions && practiceSessions.length > 0) {
        setSessions(practiceSessions)

        const ids = practiceSessions.map(s => s.id)
        const { data: records } = await supabase
          .from('attendance_records')
          .select('*')
          .in('session_id', ids)
          .eq('user_id', user.id)

        const map: Record<string, AttendanceRecord | null> = {}
        for (const s of practiceSessions) map[s.id] = null
        for (const r of records ?? []) map[r.session_id] = r as AttendanceRecord
        setRecordsMap(map)
      }
    }

    const { data: p } = await supabase
      .from('profiles')
      .select('lockout_until')
      .eq('id', user.id)
      .single()
    if (p?.lockout_until) setIsLocked(new Date(p.lockout_until) >= new Date())

    setLoading(false)
  }

  function openForm(sessionId: string, edit = false) {
    setActiveSessionId(sessionId)
    setError(null)
    const record = recordsMap[sessionId]
    if (edit && record) {
      const displayStatus: AttendanceStatus =
        record.status === 'absent_emergency' || record.status === 'absent_unreported'
          ? 'absent_normal'
          : record.status
      setSelectedStatus(displayStatus)
      setSelectedReason(record.reason ?? null)
      setDetail(record.reason_detail ?? '')
      setIsEditing(true)
    } else {
      setSelectedStatus(null)
      setSelectedReason(null)
      setDetail('')
      setIsEditing(false)
    }
  }

  function closeForm() {
    setActiveSessionId(null)
    setIsEditing(false)
    setSelectedStatus(null)
    setSelectedReason(null)
    setDetail('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeSession || !selectedStatus) return
    if (isAbsent && !selectedReason) return
    setSubmitting(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const now = new Date()
    const emergency = isAbsent && isEmergencyReport(activeSession.session_date, activeSession.start_time, now)
    const prevReason = existingRecord?.reason

    const finalStatus: AttendanceStatus =
      selectedStatus === 'absent_normal' && emergency ? 'absent_emergency' : selectedStatus

    const payload = {
      session_id:    activeSession.id,
      user_id:       user.id,
      status:        finalStatus,
      reason:        isAbsent ? selectedReason : null,
      reason_detail: isAbsent ? (detail.trim() || null) : null,
      reported_at:   now.toISOString(),
      is_emergency:  emergency,
    }

    let dbError: any = null
    if (existingRecord) {
      const { error } = await supabase.from('attendance_records').update(payload).eq('id', existingRecord.id)
      dbError = error
    } else {
      const { error } = await supabase.from('attendance_records').insert(payload)
      dbError = error
    }

    if (dbError) { setError(dbError.message); setSubmitting(false); return }

    if (isAbsent && selectedReason === 'sick') {
      const next = new Date(activeSession.session_date)
      next.setDate(next.getDate() + 1)
      await supabase.from('profiles').update({ lockout_until: next.toISOString().split('T')[0] }).eq('id', user.id)
    } else if (prevReason === 'sick' && selectedReason !== 'sick') {
      await supabase.from('profiles').update({ lockout_until: null }).eq('id', user.id)
      setIsLocked(false)
    }

    // レコード更新
    const { data: newRec } = await supabase
      .from('attendance_records').select('*')
      .eq('session_id', activeSession.id).eq('user_id', user.id).single()

    const sessionId = activeSession.id
    setRecordsMap(prev => ({ ...prev, [sessionId]: newRec as AttendanceRecord }))
    setFlashSessionId(sessionId)
    setTimeout(() => setFlashSessionId(null), 3000)
    closeForm()
    setSubmitting(false)
  }

  // ---- ローディング ----
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    )
  }

  const deadlineStr = regInfo?.deadline
    ? regInfo.deadline.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    : null

  return (
    <div className="flex flex-col gap-5">

      {/* ヘッダー */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-black tracking-tight"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}>
          出欠連絡
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          事前連絡を徹底してください
        </p>
      </div>

      {/* 事前登録ウィンドウバナー */}
      {regInfo?.isRegistrationOpen && deadlineStr && (
        <div className="animate-slide-up" style={{
          background: 'color-mix(in srgb, var(--club-blue) 10%, white)',
          border: '1.5px solid color-mix(in srgb, var(--club-blue) 30%, white)',
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Clock size={16} style={{ color: 'var(--club-blue)', flexShrink: 0 }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--club-blue)' }}>
              今週分の受付中
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--club-blue)', opacity: 0.8 }}>
              締め切り：{deadlineStr} 23:59 まで
            </p>
          </div>
        </div>
      )}

      {/* 受付なし（土日 or 火曜期限後） */}
      {regInfo && !regInfo.isRegistrationOpen && !regInfo.isSameDayOnly && sessions.length === 0 && (
        <div className="card animate-slide-up">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CalendarCheck size={32} style={{ color: 'var(--gray-300)' }} />
            <p className="font-semibold" style={{ color: 'var(--gray-700)' }}>
              現在受付中の登録はありません
            </p>
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
              月・火曜日に今週の水木金分を登録できます
            </p>
          </div>
        </div>
      )}

      {/* 当日練習なし（水〜金なのにセッションがない） */}
      {regInfo?.isSameDayOnly && sessions.length === 0 && (
        <div className="card animate-slide-up">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CalendarCheck size={32} style={{ color: 'var(--gray-300)' }} />
            <p className="font-semibold" style={{ color: 'var(--gray-700)' }}>本日は練習がありません</p>
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
              練習は水・木・金曜日に開催されます
            </p>
          </div>
        </div>
      )}

      {/* セッションカード一覧 */}
      {sessions.map((s, i) => {
        const record = recordsMap[s.id] ?? null
        const isActive = activeSessionId === s.id
        const isFlash = flashSessionId === s.id
        const locked = isLocked && regInfo?.isSameDayOnly

        return (
          <div key={s.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
            {/* セッションカード */}
            <div className="card" style={{
              border: isActive ? '1.5px solid var(--club-blue)' : '1.5px solid var(--gray-200)',
              background: isActive ? 'color-mix(in srgb, var(--club-blue) 6%, var(--card-bg))' : undefined,
            }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: isFlash ? '#dcfce7' : 'var(--club-blue-light)' }}>
                  {isFlash
                    ? <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                    : <CalendarCheck size={20} style={{ color: 'var(--club-blue)' }} />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold" style={{ color: 'var(--gray-900)' }}>
                    {new Date(s.session_date + 'T00:00:00').toLocaleDateString('ja-JP', {
                      month: 'long', day: 'numeric', weekday: 'short',
                    })}の練習
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
                    17:00〜20:00 / {s.location}
                  </p>
                </div>

                {/* ステータス表示 or ボタン */}
                {locked ? (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: '#fef3c7', color: '#b45309' }}>
                    <Lock size={11} /> 休養
                  </span>
                ) : record ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${STATUS_BADGE[record.status] ?? ''}`}>
                      {ATTENDANCE_STATUS_LABELS[record.status]}
                    </span>
                    {!isActive && (
                      <button
                        onClick={() => openForm(s.id, true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0"
                        style={{
                          background: 'var(--gray-100)',
                          color: 'var(--gray-600)',
                          border: '1px solid var(--gray-200)',
                        }}
                      >
                        <Pencil size={11} />編集
                      </button>
                    )}
                  </div>
                ) : (
                  !isActive && (
                    <button
                      onClick={() => openForm(s.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
                      style={{
                        background: 'var(--club-blue)',
                        color: 'white',
                      }}
                    >
                      連絡する <ChevronRight size={13} />
                    </button>
                  )
                )}
              </div>

              {/* 連絡済み詳細 */}
              {record && !isActive && (record.reason || record.reason_detail) && (
                <div className="mt-2 pl-14">
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {record.reason && REASON_LABELS[record.reason]}
                    {record.reason_detail && `　${record.reason_detail}`}
                  </p>
                </div>
              )}
            </div>

            {/* インラインフォーム（選択中セッション） */}
            {isActive && activeSession && (
              <div className="card mt-2 animate-slide-up"
                style={{ border: '1.5px solid var(--club-blue)', animationDelay: '0s' }}>

                {/* 編集中バッジ */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold"
                    style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
                    {isEditing ? '出欠を変更' : '出欠を連絡'}
                  </h2>
                  {isEditing && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'var(--club-amber-light)', color: 'var(--club-amber)' }}>
                      編集中
                    </span>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {error && (
                    <div className="alert-error">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* ステータス選択 */}
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map(({ value, label, description, color, icon: Icon }) => {
                      const active = selectedStatus === value
                        || (value === 'absent_normal' && (
                          selectedStatus === 'absent_emergency' || selectedStatus === 'absent_unreported'
                        ))
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setSelectedStatus(value)
                            if (value !== 'absent_normal') setSelectedReason(null)
                          }}
                          className="flex flex-col items-center gap-2 py-4 rounded-xl text-center transition-all"
                          style={{
                            border: `1.5px solid ${active ? color : 'var(--gray-200)'}`,
                            background: active
                              ? `color-mix(in srgb, ${color} 15%, var(--gray-100))`
                              : 'var(--gray-100)',
                            cursor: 'pointer',
                          }}
                        >
                          <Icon size={20} style={{ color: active ? color : 'var(--gray-500)' }} />
                          <span className="text-sm font-bold"
                            style={{ color: active ? color : 'var(--gray-700)' }}>
                            {label}
                          </span>
                          <span className="text-xs leading-tight"
                            style={{ color: active ? color : 'var(--gray-500)', opacity: 0.9 }}>
                            {description}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* 欠席理由 */}
                  {isAbsent && (
                    <>
                      {isEmergency && (
                        <div className="alert-warning">
                          <Clock size={15} className="shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">練習開始まで1時間を切っています</p>
                            <p className="text-xs mt-0.5">緊急欠席として記録されます</p>
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--gray-700)' }}>
                          欠席の理由
                        </h3>
                        <div className="flex flex-col gap-2">
                          {REASON_OPTIONS.map(({ value, label, icon: Icon, description, color }) => {
                            const active = selectedReason === value
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setSelectedReason(value)}
                                className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                                style={{
                                  border: `1.5px solid ${active ? color : 'var(--gray-200)'}`,
                                  background: active
                                    ? `color-mix(in srgb, ${color} 15%, var(--gray-100))`
                                    : 'var(--gray-100)',
                                  cursor: 'pointer',
                                }}
                              >
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                  style={{
                                    background: active
                                      ? `color-mix(in srgb, ${color} 20%, var(--gray-200))`
                                      : 'var(--gray-200)',
                                  }}>
                                  <Icon size={18} style={{ color: active ? color : 'var(--gray-600)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold"
                                    style={{ color: active ? color : 'var(--gray-700)' }}>
                                    {label}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600)' }}>
                                    {description}
                                  </p>
                                </div>
                                {value === 'sick' && active && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                                    style={{ background: '#fee2e2', color: '#b91c1c' }}>
                                    翌日ロック
                                  </span>
                                )}
                                {active && <CheckCircle2 size={18} style={{ color, flexShrink: 0 }} />}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="label">詳細（任意）</label>
                        <textarea
                          value={detail}
                          onChange={e => setDetail(e.target.value)}
                          className="input-field resize-none"
                          rows={3}
                          placeholder="補足事項があれば入力してください"
                          maxLength={200}
                        />
                        <p className="text-right text-xs mt-1" style={{ color: 'var(--gray-400)' }}>
                          {detail.length}/200
                        </p>
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      className={isAbsent && isEmergency ? 'btn-danger' : 'btn-primary'}
                      disabled={!selectedStatus || (isAbsent && !selectedReason) || submitting}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {isEditing ? '更新中...' : '送信中...'}
                        </span>
                      ) : (
                        <>
                          {isEditing ? <Pencil size={16} /> : <CalendarCheck size={16} />}
                          {isEditing
                            ? '内容を更新する'
                            : isAbsent && isEmergency
                            ? '緊急欠席として連絡'
                            : '連絡する'}
                        </>
                      )}
                    </button>

                    <button type="button" onClick={closeForm} className="btn-secondary">
                      キャンセル
                    </button>
                  </div>

                  {!selectedStatus && (
                    <p className="text-center text-xs" style={{ color: 'var(--gray-400)' }}>
                      出欠を選択してください
                    </p>
                  )}
                </form>
              </div>
            )}
          </div>
        )
      })}

      {/* ロックアウト（当日のみモード） */}
      {isLocked && regInfo?.isSameDayOnly && sessions.length > 0 && (
        <div className="card animate-slide-up">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: '#fef3c7' }}>
              <Lock size={24} style={{ color: '#b45309' }} />
            </div>
            <p className="font-bold" style={{ color: '#92400e' }}>休養推奨モード</p>
            <p className="text-sm" style={{ color: '#b45309' }}>
              体調不良のため、本日の練習はロックされています。
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
