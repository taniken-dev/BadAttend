import { SkillRank } from './types'

export function getSkillRankLabel(rank: SkillRank): string {
  const labels: Record<SkillRank, string> = {
    1: 'E級', 2: 'D級', 3: 'C級', 4: 'B級', 5: 'A級', 6: 'S級',
  }
  return labels[rank]
}

export function getAttendanceRateColor(rate: number): string {
  if (rate >= 80) return '#448361'
  if (rate >= 60) return '#5a55a3'
  if (rate >= 40) return '#cb912f'
  return '#d44c47'
}
