export type Role = 'member' | 'manager' | 'admin' | 'coach'
export type SkillRank = 1 | 2 | 3 | 4 | 5 | 6
export type SelectionRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'E'

export type AttendanceStatus =
  | 'present'
  | 'tardy'
  | 'absent_normal'
  | 'absent_emergency'
  | 'absent_unreported'

export type AbsenceReason =
  | 'practice'
  | 'class'
  | 'sick'
  | 'personal'
  | 'other'

export interface Profile {
  id: string
  full_name: string
  display_name: string | null
  student_id: string | null
  grade: number
  gender: string | null
  role: Role
  skill_rank: SkillRank
  lockout_until: string | null
  avatar_url: string | null
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface PracticeSession {
  id: string
  session_date: string
  start_time: string
  end_time: string
  location: string
  is_cancelled: boolean
  is_results_confirmed: boolean
  results_confirmed_at: string | null
  note: string | null
  created_at: string
}

export interface AttendanceRecord {
  id: string
  session_id: string
  user_id: string
  status: AttendanceStatus
  result_status: AttendanceStatus | null
  verified_by: string | null
  reason: AbsenceReason | null
  reason_detail: string | null
  reported_at: string | null
  is_emergency: boolean
  created_at: string
}

export interface WarningFlag {
  id: string
  user_id: string
  flag_type: 'dues_overdue' | 'absent_no_report' | 'conduct'
  started_at: string
  resolved_at: string | null
  severity: 'warning' | 'final_warning' | 'expelled'
  note: string | null
  created_at: string
}

export interface SelectionScore {
  id: string
  full_name: string
  display_name: string | null
  grade: number
  gender: string | null
  skill_rank: SkillRank
  total_sessions: number
  present_count: number
  tardy_count: number
  absent_count: number
  emergency_count: number
  attendance_rate: number
  selection_score: number
  selection_rank: SelectionRank
}

export const SKILL_RANK_LABELS: Record<SkillRank, string> = {
  1: 'E級',
  2: 'D級',
  3: 'C級',
  4: 'B級',
  5: 'A級',
  6: 'S級',
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: '出席',
  tardy: '遅刻',
  absent_normal: '欠席',
  absent_emergency: '緊急欠席',
  absent_unreported: '無連絡欠席',
}

export const REASON_LABELS: Record<AbsenceReason, string> = {
  practice: '別練習・大会',
  class: '授業',
  sick: '体調不良',
  personal: '私用',
  other: 'その他',
}

export const STATUS_BADGE: Record<AttendanceStatus, string> = {
  present:            'badge-present',
  tardy:              'badge-tardy',
  absent_normal:      'badge-absent',
  absent_emergency:   'badge-emergency',
  absent_unreported:  'badge-absent',
}
