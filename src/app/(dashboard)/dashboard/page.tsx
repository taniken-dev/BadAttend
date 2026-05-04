import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  CalendarCheck,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import { getAttendanceRateColor } from '@/lib/utils'
import {
  ATTENDANCE_STATUS_LABELS,
  REASON_LABELS,
  STATUS_BADGE,
  type Profile,
  type SelectionScore,
  type PracticeSession,
  type WarningFlag,
} from '@/lib/types'
import LeaderboardSection from './LeaderboardSection'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const isCoach = profile?.role === 'coach'
  const isAdmin = profile?.role === 'admin'

  // 個人スコア（coach は不要）
  const { data: myScore } = isCoach ? { data: null } : await supabase
    .from('v_selection_scores')
    .select('*')
    .eq('id', user.id)
    .single<SelectionScore>()

  // 全部員ランキング
  const { data: allScores } = await supabase
    .from('v_selection_scores')
    .select('*')
    .order('attendance_rate', { ascending: false })

  // 注意勧告（admin のみ）
  const { data: warningData } = isAdmin
    ? await supabase.from('warning_flags').select('*').is('resolved_at', null)
    : { data: [] }
  const warnedUserIds = ((warningData ?? []) as WarningFlag[]).map(w => w.user_id)

  // 今日のセッション
  const today = new Date().toISOString().split('T')[0]
  const { data: todaySession } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('session_date', today)
    .eq('is_cancelled', false)
    .single<PracticeSession>()

  // 今日の全出欠レコード
  type AttendeeRow = { status: string; reason: string | null; reason_detail: string | null; profiles: { full_name: string; grade: number } }
  let attendees: AttendeeRow[] = []
  let absentees: AttendeeRow[] = []

  if (todaySession) {
    const { data: records } = await supabase
      .from('attendance_records')
      .select('status, reason, reason_detail, profiles!inner(full_name, grade)')
      .eq('session_id', todaySession.id)

    const all = (records ?? []) as unknown as AttendeeRow[]
    attendees = all.filter(r => r.status === 'present' || r.status === 'tardy')
    absentees = all.filter(r => r.status !== 'present' && r.status !== 'tardy')
  }

  // 自分の今日の出欠（coach は不要）
  let myTodayRecord: any = null
  if (todaySession && !isCoach) {
    const { data } = await supabase
      .from('attendance_records')
      .select('status, reason')
      .eq('session_id', todaySession.id)
      .eq('user_id', user.id)
      .single()
    myTodayRecord = data
  }

  // 直近10回の自分の出欠履歴（coach は不要）
  const { data: recentRecords } = isCoach ? { data: null } : await supabase
    .from('attendance_records')
    .select('status, reason, practice_sessions(session_date)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const isLocked = profile?.lockout_until
    ? new Date(profile.lockout_until) >= new Date()
    : false

  const attendanceRate = myScore?.attendance_rate ?? 100

  return (
    <div className="flex flex-col gap-5">

      {/* ロックアウトバナー */}
      {isLocked && (
        <div className="alert-warning animate-slide-up">
          <Clock size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">休養推奨モード</p>
            <p className="text-xs mt-0.5">
              体調不良のため、本日の練習はロックされています。
            </p>
          </div>
        </div>
      )}

      {/* 今日の練習セクション */}
      {todaySession ? (
        <>
          {/* 今日のヘッダー */}
          <div className="animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--gray-500)' }}>
                  {new Date(todaySession.session_date).toLocaleDateString('ja-JP', {
                    month: 'long', day: 'numeric', weekday: 'long',
                  })}
                </p>
                <h1
                  className="text-2xl font-black mt-0.5"
                  style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}
                >
                  今日の練習
                </h1>
              </div>
              {/* 自分の状態（coach は非表示） */}
              {!isCoach && (myTodayRecord ? (
                <span className={`badge ${STATUS_BADGE[myTodayRecord.status as keyof typeof STATUS_BADGE] ?? 'badge'}`}>
                  {ATTENDANCE_STATUS_LABELS[myTodayRecord.status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? myTodayRecord.status}
                </span>
              ) : (
                <Link
                  href="/attendance"
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--club-blue)', color: 'white' }}
                >
                  <CalendarCheck size={14} />
                  出欠連絡
                </Link>
              ))}
            </div>
          </div>

          {/* 参加者カード */}
          <div className="card animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                参加予定
              </h2>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#dcfce7', color: '#15803d' }}
              >
                {attendees.length} 名
              </span>
            </div>
            {attendees.length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--gray-400)' }}>
                まだ出欠連絡がありません
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attendees.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      background: a.status === 'tardy' ? '#fef3c7' : '#dcfce7',
                      color: a.status === 'tardy' ? '#b45309' : '#15803d',
                    }}
                  >
                    {a.status === 'tardy' && <Clock size={12} />}
                    {a.profiles.full_name}
                    {a.status === 'tardy' && <span className="text-xs opacity-70">遅刻</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 欠席者カード */}
          {absentees.length > 0 && (
            <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 mb-3">
                <XCircle size={16} style={{ color: '#dc2626' }} />
                <h2 className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                  欠席連絡あり
                </h2>
                <span
                  className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#fee2e2', color: '#b91c1c' }}
                >
                  {absentees.length} 名
                </span>
              </div>
              <div className="flex flex-col">
                {absentees.map((a, i) => (
                  <div key={i} className="list-item">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: '#fee2e2', color: '#b91c1c' }}
                    >
                      {a.profiles.full_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {a.profiles.full_name}
                      </p>
                      {a.reason && (
                        <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                          {REASON_LABELS[a.reason as keyof typeof REASON_LABELS]}
                          {a.reason_detail && `・${a.reason_detail}`}
                        </p>
                      )}
                    </div>
                    <span className={`badge ${STATUS_BADGE[a.status as keyof typeof STATUS_BADGE] ?? ''}`}>
                      {ATTENDANCE_STATUS_LABELS[a.status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* 練習なし */
        <div className="animate-slide-up">
          <h1
            className="text-2xl font-black"
            style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}
          >
            ホーム
          </h1>
          <div className="card mt-4 flex flex-col items-center gap-3 py-8 text-center">
            <TrendingUp size={28} style={{ color: 'var(--gray-300)' }} />
            <p className="font-semibold" style={{ color: 'var(--gray-700)' }}>
              本日は練習がありません
            </p>
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
              練習は水・木・金曜日です
            </p>
          </div>
        </div>
      )}

      {/* 自分の出席状況カード（coach は非表示） */}
      {!isCoach && (
        <div className="card animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h2
            className="text-base font-bold mb-4"
            style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}
          >
            自分の出席状況
          </h2>

          {/* 出席率 */}
          <div className="flex flex-col items-center gap-1 mb-4 py-3 rounded-2xl"
            style={{ background: 'var(--gray-50)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--gray-500)' }}>出席率</span>
            <span
              className="text-5xl font-black"
              style={{ color: getAttendanceRateColor(attendanceRate), letterSpacing: '-0.04em' }}
            >
              {attendanceRate}<span className="text-2xl font-semibold">%</span>
            </span>
            <div className="w-full px-4 mt-2">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${attendanceRate}%`, background: getAttendanceRateColor(attendanceRate) }}
                />
              </div>
            </div>
          </div>

          {/* 出席・遅刻・欠席 内訳 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '出席', value: myScore?.present_count ?? 0, color: '#16a34a', bg: '#dcfce7' },
              { label: '遅刻', value: myScore?.tardy_count ?? 0,   color: '#b45309', bg: '#fef3c7' },
              { label: '欠席', value: myScore?.absent_count ?? 0,  color: '#b91c1c', bg: '#fee2e2' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-xl" style={{ background: bg }}>
                <span className="text-2xl font-black" style={{ color }}>{value}</span>
                <span className="text-xs font-medium" style={{ color }}>{label}</span>
              </div>
            ))}
          </div>

          {/* 直近の出欠ドット */}
          {(recentRecords ?? []).length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--gray-100)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--gray-500)' }}>
                直近 {recentRecords!.length} 回の活動実績
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {recentRecords!.map((r: any, i: number) => {
                  const dotColor =
                    r.status === 'present' ? '#16a34a' :
                    r.status === 'tardy'   ? '#d97706' : '#dc2626'
                  return (
                    <div
                      key={i}
                      title={`${r.practice_sessions?.session_date ?? ''} ${ATTENDANCE_STATUS_LABELS[r.status as keyof typeof ATTENDANCE_STATUS_LABELS]}`}
                      className="w-5 h-5 rounded-full"
                      style={{ background: dotColor, opacity: 1 - i * 0.06 }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 出欠連絡ボタン（今日セッションあり・未連絡・coach以外） */}
      {!isCoach && todaySession && !myTodayRecord && !isLocked && (
        <Link
          href="/attendance"
          className="btn-primary animate-slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          <UserCheck size={18} />
          今日の出欠を連絡する
        </Link>
      )}

      {/* 出席率ランキング */}
      <LeaderboardSection
        scores={(allScores ?? []) as SelectionScore[]}
        currentUserId={user.id}
        isAdmin={isAdmin}
        warnedUserIds={warnedUserIds}
      />
    </div>
  )
}
