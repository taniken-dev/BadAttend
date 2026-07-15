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
  type SelectionScore,
  type PracticeSession,
  type WarningFlag,
} from '@/lib/types'
import LeaderboardSection from './LeaderboardSection'
import DeadlineSection, { type DeadlineWithSubmitter } from './DeadlineSection'
import { HideFor } from '@/components/ui/RoleGate'
import { getSessionUser, getMyProfile } from '@/lib/supabase/session'
import { getTaiikukaiUrl } from '@/lib/taiikukai'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const profile = await getMyProfile()

  const isCoach = profile?.role === 'coach'
  const isAdmin = profile?.role === 'admin'
  // 体育会 提出書類締切は管理者・幹部のみ閲覧可
  const canSeeDeadlines = isAdmin || !!profile?.is_executive

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
  // 締切カードの表示下限（2週間前より古い締切は出さない）
  const deadlineFloor = new Date(new Date(today + 'T00:00:00+09:00').getTime() - 14 * 86400000).toISOString()

  // 互いに依存しない初期クエリをまとめて並列実行（従来は直列 await だった）
  const [
    { data: allScores },
    { data: warningData },
    { data: todaySession },
    { data: recentRecords },
    { data: deadlineData },
    { data: scrapeStatus },
  ] = await Promise.all([
    // 全部員ランキング
    supabase.from('v_selection_scores').select('*').order('attendance_rate', { ascending: false }),
    // 注意勧告（admin のみ）
    isAdmin
      ? supabase.from('warning_flags').select('*').is('resolved_at', null)
      : Promise.resolve({ data: [] }),
    // 今日のセッション（同日に複数ある場合は開始時刻が最も早いものを代表として表示）
    supabase.from('practice_sessions').select('*').eq('session_date', today).eq('is_cancelled', false)
      .order('start_time', { ascending: true, nullsFirst: false }).limit(1).maybeSingle<PracticeSession>(),
    // 直近10回の自分の出欠実績（result_status 確定済みのみ・coach は不要）
    isCoach
      ? Promise.resolve({ data: null })
      : supabase
          .from('attendance_records')
          .select('result_status, practice_sessions!inner(session_date)')
          .eq('user_id', user.id)
          .not('result_status', 'is', null)
          .lte('practice_sessions.session_date', today)
          .order('created_at', { ascending: false })
          .limit(10),
    // 体育会 提出書類締切（管理者・幹部のみ。直近2週間より前のものは表示しない）
    canSeeDeadlines
      ? supabase
          .from('document_deadlines')
          .select('*, submitter:profiles!document_deadlines_submitted_by_fkey(full_name, display_name)')
          .eq('is_active', true)
          .gte('deadline_at', deadlineFloor)
          .order('deadline_at')
      : Promise.resolve({ data: null }),
    canSeeDeadlines
      ? supabase.from('deadline_scrape_status').select('last_success_at').eq('id', 1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const warnedUserIds = ((warningData ?? []) as WarningFlag[]).map(w => w.user_id)

  // 個人スコアはランキングと同じビューの同一行なので、別クエリを投げずに抽出する
  const myScore = isCoach
    ? null
    : ((allScores ?? []) as SelectionScore[]).find(s => s.id === user.id) ?? null

  // 今日の全出欠レコード
  type RawRecord = { user_id: string; status: string; reason: string | null; reason_detail: string | null; arrival_time: string | null }
  type AttendeeRow = { status: string; reason: string | null; reason_detail: string | null; arrival_time: string | null; profiles: { full_name: string; display_name: string | null; grade: number } }
  let attendees: AttendeeRow[] = []
  let absentees: AttendeeRow[] = []
  let presentAttendees: AttendeeRow[] = []
  let tardyGroups: [string, AttendeeRow[]][] = []
  let noTimeTardy: AttendeeRow[] = []

  if (todaySession) {
    // profiles!inner の RLS 問題を避けるため別クエリで取得してコード結合
    const [{ data: records }, { data: profileList }] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('user_id, status, reason, reason_detail, arrival_time')
        .eq('session_id', todaySession.id),
      supabase
        .from('profiles')
        .select('id, full_name, display_name, grade')
        .eq('is_approved', true)
        .eq('is_active', true),
    ])

    const profileMap = Object.fromEntries(
      ((profileList ?? []) as { id: string; full_name: string; display_name: string | null; grade: number }[])
        .map(p => [p.id, p])
    )

    const sortByGradeName = (a: AttendeeRow, b: AttendeeRow) => {
      const gradeDiff = (b.profiles.grade ?? 0) - (a.profiles.grade ?? 0)
      if (gradeDiff !== 0) return gradeDiff
      const nameA = a.profiles.display_name ?? a.profiles.full_name
      const nameB = b.profiles.display_name ?? b.profiles.full_name
      return nameA.localeCompare(nameB, 'ja')
    }

    const all: AttendeeRow[] = ((records ?? []) as RawRecord[])
      .filter(r => profileMap[r.user_id])
      .map(r => ({ ...r, profiles: profileMap[r.user_id] }))

    attendees = all.filter(r => r.status === 'present' || r.status === 'tardy').sort(sortByGradeName)
    absentees = all.filter(r => r.status !== 'present' && r.status !== 'tardy').sort(sortByGradeName)

    // 参加予定を時間帯グループに分類
    presentAttendees = attendees.filter(r => r.status === 'present')
    const tardyWithTime = attendees
      .filter(r => r.status === 'tardy' && r.arrival_time)
      .sort((a, b) => {
        const t = (a.arrival_time ?? '').localeCompare(b.arrival_time ?? '')
        return t !== 0 ? t : sortByGradeName(a, b)
      })
    noTimeTardy = attendees.filter(r => r.status === 'tardy' && !r.arrival_time).sort(sortByGradeName)

    const tardyTimeMap = new Map<string, AttendeeRow[]>()
    for (const a of tardyWithTime) {
      const key = a.arrival_time!.substring(0, 5)
      if (!tardyTimeMap.has(key)) tardyTimeMap.set(key, [])
      tardyTimeMap.get(key)!.push(a)
    }
    tardyGroups = Array.from(tardyTimeMap.entries()).sort(([a], [b]) => a.localeCompare(b))
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

  const isLocked = profile?.lockout_until
    ? new Date(profile.lockout_until) >= new Date()
    : false

  const attendanceRate = myScore?.attendance_rate ?? 100

  return (
    <div className="flex flex-col gap-5">

      {/* ロックアウトバナー（顧問には非表示） */}
      <HideFor roles={['coach']}>
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
      </HideFor>

      {/* 体育会 提出書類締切（管理者・幹部のみ） */}
      {canSeeDeadlines && (
        <DeadlineSection
          deadlines={(deadlineData ?? []) as unknown as DeadlineWithSubmitter[]}
          lastFetchedAt={(scrapeStatus as { last_success_at: string | null } | null)?.last_success_at ?? null}
          currentUserId={user.id}
          siteUrl={getTaiikukaiUrl()}
          isAdmin={isAdmin}
        />
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
                  className="text-2xl font-bold mt-0.5"
                  style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}
                >
                  今日の練習
                </h1>
              </div>
              {/* 自分の状態（coach は非表示） */}
              <HideFor roles={['coach']}>
                {myTodayRecord ? (
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
                )}
              </HideFor>
            </div>
          </div>

          {/* 参加者カード */}
          <div className="card animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} style={{ color: '#448361' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                参加予定
              </h2>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#dbeddb', color: '#2f5f44' }}
              >
                {attendees.length} 名
              </span>
            </div>
            {attendees.length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--gray-400)' }}>
                まだ出欠連絡がありません
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* 開始から参加 */}
                {presentAttendees.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--gray-500)' }}>
                      開始から参加
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presentAttendees.map((a, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-full text-sm font-semibold"
                          style={{ background: '#dbeddb', color: '#2f5f44' }}
                        >
                          {a.profiles.display_name ?? a.profiles.full_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 時刻指定の遅刻グループ */}
                {tardyGroups.map(([time, members]) => (
                  <div key={time}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock size={11} style={{ color: '#8a5d22' }} />
                      <p className="text-xs font-semibold" style={{ color: '#8a5d22' }}>
                        {time} から参加
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {members.map((a, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-full text-sm font-semibold"
                          style={{ background: '#fdecc8', color: '#8a5d22' }}
                        >
                          {a.profiles.display_name ?? a.profiles.full_name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* 時刻未定の遅刻 */}
                {noTimeTardy.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock size={11} style={{ color: '#8a5d22' }} />
                      <p className="text-xs font-semibold" style={{ color: '#8a5d22' }}>
                        遅刻・時刻未定
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {noTimeTardy.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                          style={{ background: '#fdecc8', color: '#8a5d22' }}
                        >
                          {a.profiles.display_name ?? a.profiles.full_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 欠席者カード */}
          {absentees.length > 0 && (
            <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 mb-3">
                <XCircle size={16} style={{ color: '#d44c47' }} />
                <h2 className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                  欠席連絡あり
                </h2>
                <span
                  className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#ffe2dd', color: '#a8423d' }}
                >
                  {absentees.length} 名
                </span>
              </div>
              <div className="flex flex-col">
                {absentees.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: '#ffe2dd', color: '#a8423d' }}
                    >
                      {(a.profiles.display_name ?? a.profiles.full_name).charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {a.profiles.display_name ?? a.profiles.full_name}
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
            className="text-2xl font-bold"
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
      <HideFor roles={['coach']}>
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
              className="text-5xl font-bold"
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
            <div className="flex flex-col items-center gap-1 py-3 rounded-xl" style={{ background: '#dbeddb' }}>
              <span className="text-2xl font-bold" style={{ color: '#448361' }}>{myScore?.present_count ?? 0}</span>
              <span className="text-xs font-medium" style={{ color: '#448361' }}>出席</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-3 rounded-xl" style={{ background: '#fdecc8' }}>
              <span className="text-2xl font-bold" style={{ color: '#8a5d22' }}>{myScore?.tardy_count ?? 0}</span>
              <span className="text-xs font-medium" style={{ color: '#8a5d22' }}>遅刻</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-3 rounded-xl" style={{ background: '#ffe2dd' }}>
              <span className="text-2xl font-bold" style={{ color: '#a8423d' }}>{myScore?.absent_count ?? 0}</span>
              <span className="text-xs font-medium" style={{ color: '#a8423d' }}>欠席</span>
              {(myScore?.unreported_count ?? 0) > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#e5a49e', color: '#6d302c' }}>
                  無断 {myScore!.unreported_count}回
                </span>
              )}
            </div>
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
                    r.result_status === 'present' ? '#448361' :
                    r.result_status === 'tardy'   ? '#cb912f' : '#d44c47'
                  return (
                    <div
                      key={i}
                      title={`${r.practice_sessions?.session_date ?? ''} ${ATTENDANCE_STATUS_LABELS[r.result_status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? ''}`}
                      className="w-5 h-5 rounded-full"
                      style={{ background: dotColor, opacity: 1 - i * 0.06 }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </HideFor>

      {/* 出欠連絡ボタン（今日セッションあり・未連絡・coach以外） */}
      <HideFor roles={['coach']}>
        {todaySession && !myTodayRecord && !isLocked && (
          <Link
            href="/attendance"
            className="btn-primary animate-slide-up"
            style={{ animationDelay: '0.2s' }}
          >
            <UserCheck size={18} />
            今日の出欠を連絡する
          </Link>
        )}
      </HideFor>

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
