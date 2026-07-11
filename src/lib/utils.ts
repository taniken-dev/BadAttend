import { SkillRank } from './types'

export function getSkillRankLabel(rank: SkillRank): string {
  const labels: Record<SkillRank, string> = {
    1: 'E級', 2: 'D級', 3: 'C級', 4: 'B級', 5: 'A級', 6: 'S級',
  }
  return labels[rank]
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

  // 特例: 2026-05-13〜05-15 の週は 05-15 23:59 まで登録可能
  const SPECIAL_DATES = ['2026-05-13', '2026-05-14', '2026-05-15']
  const specialDeadline = new Date('2026-05-15T23:59:59.999')
  if (now <= specialDeadline) {
    const todayStr = toDateStr(now)
    if (SPECIAL_DATES.includes(todayStr)) {
      return {
        availableDates: SPECIAL_DATES,
        isRegistrationOpen: true,
        deadline: specialDeadline,
        isSameDayOnly: false,
      }
    }
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

export function getAttendanceRateColor(rate: number): string {
  if (rate >= 80) return '#448361'
  if (rate >= 60) return '#5a55a3'
  if (rate >= 40) return '#cb912f'
  return '#d44c47'
}
