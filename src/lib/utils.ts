import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { SelectionRank, SkillRank } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRankClass(rank: SelectionRank): string {
  return `rank-${rank.toLowerCase()}`
}

export function getSkillRankLabel(rank: SkillRank): string {
  const labels: Record<SkillRank, string> = {
    1: 'E級', 2: 'D級', 3: 'C級', 4: 'B級', 5: 'A級', 6: 'S級',
  }
  return labels[rank]
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

/** 練習開始1時間以内かどうか判定 */
export function isEmergencyReport(
  sessionDate: string,
  startTime: string,
  reportedAt: Date = new Date()
): boolean {
  const sessionStart = new Date(`${sessionDate}T${startTime}`)
  const diffMs = sessionStart.getTime() - reportedAt.getTime()
  return diffMs >= 0 && diffMs <= 60 * 60 * 1000
}

/** 出欠登録可能セッション情報を返す
 *
 * - 土・日: 来週の水木金を事前登録可能（締め切り：来週火曜23:59）
 * - 月・火(23:59前): 今週の水木金を事前登録可能（締め切り：今週火曜23:59）
 * - 水・木・金 / 火23:59以降: 受付なし（当日登録なし）
 */
export function getWeeklyRegistrationInfo(now: Date = new Date()): {
  availableDates: string[]
  isRegistrationOpen: boolean   // 事前登録ウィンドウ中
  deadline: Date | null         // 対象週の火曜23:59
  isSameDayOnly: boolean        // 常にfalse（当日登録廃止）
} {
  const dow = now.getDay() // 0=日 1=月 2=火 3=水 4=木 5=金 6=土

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const addDays = (base: Date, n: number) => {
    const d = new Date(base)
    d.setDate(base.getDate() + n)
    return d
  }

  // 水〜金・火23:59以降: 受付なし
  if (dow >= 3 && dow <= 5) {
    return { availableDates: [], isRegistrationOpen: false, deadline: null, isSameDayOnly: false }
  }

  // 対象週の月曜を計算
  // 月(1)→0日後, 火(2)→-1日, 土(6)→+2日(来週月), 日(0)→+1日(来週月)
  const daysToTargetMonday = dow === 1 ? 0 : dow === 2 ? -1 : dow === 6 ? 2 : 1
  const targetMonday = addDays(now, daysToTargetMonday)
  targetMonday.setHours(0, 0, 0, 0)

  const wed = addDays(targetMonday, 2)
  const thu = addDays(targetMonday, 3)
  const fri = addDays(targetMonday, 4)

  // 対象週の火曜23:59:59
  const tueDL = addDays(targetMonday, 1)
  tueDL.setHours(23, 59, 59, 999)

  // 火曜23:59以降は受付なし
  if (dow === 2 && now > tueDL) {
    return { availableDates: [], isRegistrationOpen: false, deadline: null, isSameDayOnly: false }
  }

  return {
    availableDates: [toDateStr(wed), toDateStr(thu), toDateStr(fri)],
    isRegistrationOpen: true,
    deadline: tueDL,
    isSameDayOnly: false,
  }
}

/** チーム戦闘力（全部員ポイント合計）に基づくレベル */
export function getTeamLevel(totalPoints: number): string {
  if (totalPoints >= 50000) return 'SS'
  if (totalPoints >= 40000) return 'S'
  if (totalPoints >= 30000) return 'A'
  if (totalPoints >= 20000) return 'B'
  if (totalPoints >= 10000) return 'C'
  return 'D'
}

export function getAttendanceRateColor(rate: number): string {
  if (rate >= 80) return '#16a34a'
  if (rate >= 60) return '#4338ca'
  if (rate >= 40) return '#d97706'
  return '#dc2626'
}

export function getPracticeWeekday(dateStr: string): string {
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return days[new Date(dateStr).getDay()]
}
