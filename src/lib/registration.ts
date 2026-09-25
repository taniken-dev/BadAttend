// 出欠登録期間の計算（アプリ側）
//
// DB 側の public.registration_window_calc / public.registration_self_check
// （BadAttend-db/migration_registration_policy.sql）と同じ結果を返すこと。
// 両者の一致は scripts/check-registration-window.mjs で確認する。
//
// - 日付・曜日・締切は実行環境のタイムゾーンに依存させず、必ず JST で判定する
// - このファイルは実行時の import を持たない（node で直接読み込んで検証するため）

export type RegistrationPolicy = {
  strict_start_date: string | null  // この日以降の練習は締切を強制・当日登録なし（null なら旧ルール）
  biweekly_start:    string | null  // 2週間サイクルの基準日（月曜）。null なら毎週提出
}

// 設定を取得できなかったとき（SQL 未実行など）は旧ルールで動かす
export const LEGACY_POLICY: RegistrationPolicy = { strict_start_date: null, biweekly_start: null }

export type RegistrationMode = 'legacy' | 'weekly' | 'biweekly'

export type RegistrationWindow = {
  mode:     RegistrationMode
  opensAt:  Date  // 受付開始（この時刻を含む）
  closesAt: Date  // 受付終了（この時刻ちょうど以降は締切後。表示は1分前の「23:59」）
}

export type SelfCheckCode = 'before_open' | 'after_deadline' | 'after_session' | 'status_not_allowed'

const DAY_MS = 24 * 60 * 60 * 1000
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']

// 'YYYY-MM-DD' ⇔ 1970-01-01 からの通算日
function toDayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

// 通算日の JST 0:00
function jstMidnight(dayNumber: number): Date {
  return new Date(dayNumber * DAY_MS - JST_OFFSET_MS)
}

// 0=日 … 6=土（1970-01-01 は木曜）
function dowOf(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7
}

/** 日時の JST での日付（YYYY-MM-DD） */
export function toJstDateStr(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(ymd: string, n: number): string {
  return fromDayNumber(toDayNumber(ymd) + n)
}

/** 'YYYY-MM-DD' → 「9/30（水）」 */
export function formatDateLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}（${DOW_JA[dowOf(toDayNumber(ymd))]}）`
}

/** 日時を JST で「9/29（火）23:59」形式にする */
export function formatJstDateTime(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  const hh = String(jst.getUTCHours()).padStart(2, '0')
  const mm = String(jst.getUTCMinutes()).padStart(2, '0')
  return `${formatDateLabel(jst.toISOString().slice(0, 10))}${hh}:${mm}`
}

/** 締切の表示（closesAt の1分前 = 火曜 23:59） */
export function formatDeadlineLabel(closesAt: Date): string {
  return formatJstDateTime(new Date(closesAt.getTime() - 60 * 1000))
}

/** 練習日の登録期間
 *
 * - biweekly: biweekly_start（月曜）から2週間ごとのサイクル。第1週の水曜〜第3週の火曜の練習を、
 *             サイクル直前の土曜 0:00 〜 第1週の火曜 23:59 に登録する
 * - weekly / legacy: 練習日より前で直近の火曜を締切（23:59）とし、その3日前の土曜 0:00 から受付
 *             （水〜金の練習なら同じ週の土〜火）。legacy はこれに加えて練習当日も登録できる
 */
export function getRegistrationWindow(sessionDate: string, policy: RegistrationPolicy): RegistrationWindow {
  const d = toDayNumber(sessionDate)

  if (policy.biweekly_start) {
    const b = toDayNumber(policy.biweekly_start)
    if (d >= b + 2) {
      const cycleStart = b + 14 * Math.floor((d - (b + 2)) / 14)
      return {
        mode:     'biweekly',
        opensAt:  jstMidnight(cycleStart - 2),
        closesAt: jstMidnight(cycleStart + 2),
      }
    }
  }

  const back = (dowOf(d) - 2 + 7) % 7 || 7
  const tuesday = d - back
  const isStrict = !!policy.strict_start_date && sessionDate >= policy.strict_start_date
  return {
    mode:     isStrict ? 'weekly' : 'legacy',
    opensAt:  jstMidnight(tuesday - 3),
    closesAt: jstMidnight(tuesday + 1),
  }
}

export type SessionRegistrationState = RegistrationWindow & {
  isOpen:          boolean  // 新規登録・自由な変更ができる（期間内 or 旧ルールの当日）
  isSameDay:       boolean  // JST で練習当日
  isBeforeOpen:    boolean
  isAfterDeadline: boolean
  isPastSession:   boolean  // 練習日（JST）を過ぎた
}

/** 現在時刻での、ある練習日の登録状態（合宿・部会などの対象外判定は呼び出し側で行う） */
export function getSessionRegistrationState(
  now: Date,
  sessionDate: string,
  policy: RegistrationPolicy,
): SessionRegistrationState {
  const w = getRegistrationWindow(sessionDate, policy)
  const t = now.getTime()
  const today = toJstDateStr(now)
  const inWindow = t >= w.opensAt.getTime() && t < w.closesAt.getTime()
  const isSameDay = sessionDate === today
  return {
    ...w,
    isOpen:          inWindow || (w.mode === 'legacy' && isSameDay),
    isSameDay,
    isBeforeOpen:    t < w.opensAt.getTime(),
    isAfterDeadline: t >= w.closesAt.getTime(),
    isPastSession:   sessionDate < today,
  }
}

/** 部員本人による登録・変更が許されるか（許されるなら null）
 *
 * DB の public.registration_self_check と同じ判定。
 * oldStatus が null なら新規登録（INSERT）。
 * 締切後に許すのは「出席→遅刻」「出席・遅刻→欠席」と、ステータスを変えない修正だけ（練習当日まで）。
 */
export function checkSelfChange(
  now: Date,
  sessionDate: string,
  policy: RegistrationPolicy,
  oldStatus: string | null,
  newStatus: string,
): SelfCheckCode | null {
  const w = getRegistrationWindow(sessionDate, policy)
  if (w.mode === 'legacy') return null

  const t = now.getTime()
  if (t >= w.opensAt.getTime() && t < w.closesAt.getTime()) return null
  if (t >= jstMidnight(toDayNumber(sessionDate) + 1).getTime()) return 'after_session'
  if (oldStatus === null) return t < w.opensAt.getTime() ? 'before_open' : 'after_deadline'
  if (newStatus === oldStatus) return null
  if ((newStatus === 'absent_normal' || newStatus === 'absent_emergency') &&
      ['present', 'tardy', 'absent_normal', 'absent_emergency'].includes(oldStatus)) return null
  if (newStatus === 'tardy' && oldStatus === 'present') return null
  return 'status_not_allowed'
}

/** 拒否理由の表示文（DB のエラーメッセージと同じ文面） */
export function registrationErrorMessage(code: SelfCheckCode, w: RegistrationWindow): string {
  switch (code) {
    case 'before_open':
      return `受付開始（${formatJstDateTime(w.opensAt)}）前のため、まだ登録できません`
    case 'after_deadline':
      return `締切（${formatDeadlineLabel(w.closesAt)}）を過ぎたため登録できません`
    case 'status_not_allowed':
      return `締切（${formatDeadlineLabel(w.closesAt)}）を過ぎたため、欠席・遅刻への変更のみ可能です`
    case 'after_session':
      return '練習日を過ぎたため変更できません'
  }
}

// ── 締切のお知らせ文（管理者が LINE グループに手で貼る） ─────────

export type NoticeSession = {
  date:        string                         // YYYY-MM-DD
  unsubmitted: { id: string; name: string }[] // 未提出者
}

export function buildDeadlineNotice({ kind, sessions, closesAt, includeNames }: {
  kind:         'before' | 'after'
  sessions:     NoticeSession[]
  closesAt:     Date
  includeNames: boolean
}): string {
  const dates = [...new Set(sessions.map(s => s.date))].sort()
  if (dates.length === 0) return ''
  const range = dates.length === 1
    ? formatDateLabel(dates[0])
    : `${formatDateLabel(dates[0])}〜${formatDateLabel(dates[dates.length - 1])}`

  // 同じ日に複数の練習がある場合は日付ごとにまとめる
  const byDate = new Map<string, Map<string, string>>()
  for (const s of sessions) {
    const m = byDate.get(s.date) ?? new Map<string, string>()
    for (const p of s.unsubmitted) m.set(p.id, p.name)
    byDate.set(s.date, m)
  }
  const everyone = new Map<string, string>()
  for (const m of byDate.values()) for (const [id, name] of m) everyone.set(id, name)

  if (kind === 'before') {
    const lines = [
      '【出欠提出のお願い】',
      `${range}の練習の出欠は、${formatDeadlineLabel(closesAt)} 締切です。`,
    ]
    if (everyone.size === 0) {
      lines.push('全員提出済みです。ありがとうございます！')
    } else {
      lines.push(`未提出：${everyone.size}名`)
      if (includeNames) lines.push(`（${[...everyone.values()].join('、')}）`)
      lines.push('アプリから提出をお願いします。締切後は登録できず、未提出の方は練習に参加できません。')
    }
    return lines.join('\n')
  }

  const lines = [
    '【出欠締切のお知らせ】',
    `${range}の練習の出欠を締め切りました。`,
  ]
  if (everyone.size === 0) {
    lines.push('全員提出済みです。ありがとうございました！')
  } else {
    lines.push('未提出の方は練習に参加できません。', '')
    for (const date of dates) {
      const names = [...(byDate.get(date)?.values() ?? [])]
      lines.push(`・${formatDateLabel(date)}：${names.length > 0 ? names.join('、') : 'なし'}`)
    }
  }
  return lines.join('\n')
}
