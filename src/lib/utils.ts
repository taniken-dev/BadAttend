import { SkillRank } from './types'

export function getSkillRankLabel(rank: SkillRank): string {
  const labels: Record<SkillRank, string> = {
    1: 'E級', 2: 'D級', 3: 'C級', 4: 'B級', 5: 'A級', 6: 'S級',
  }
  return labels[rank]
}

/** 時刻を含む値（timestamptz の ISO 文字列・Date）を JST で表示する
 *
 * Vercel のサーバーは UTC で動くため、timeZone を指定しないと UTC の時刻が表示される。
 * YYYY-MM-DD の日付文字列（session_date など）には使わないこと（UTC 0時として解釈される）。
 */
export function formatJst(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString('ja-JP', { ...options, timeZone: 'Asia/Tokyo' })
}

export function getAttendanceRateColor(rate: number): string {
  if (rate >= 80) return '#448361'
  if (rate >= 60) return '#5a55a3'
  if (rate >= 40) return '#cb912f'
  return '#d44c47'
}
