// イエロー・レッドカード（アプリ側の表示用）
//
// カードの付与・数え直しは DB のトリガーが行う（BadAttend-db/migration_cards.sql）。
// アプリは cards テーブルを読んで表示するだけ。しきい値（何枚でレッドか）は DB の
// card_policy にだけあり、このファイルやテストには書かない。
//
// - このファイルは実行時の import を持たない（node で直接読み込んで検証するため）

export type CardColor = 'yellow' | 'red'
export type CardSource = 'no_show' | 'unsubmitted' | 'manual' | 'yellow_limit' | 'streak'

export interface Card {
  id:           string
  user_id:      string
  color:        CardColor
  source:       CardSource
  session_id:   string | null
  period_month: string         // 対象月の月初日（YYYY-MM-01）
  seq:          number | null
  reason:       string | null
  range_from:   string | null
  range_to:     string | null
  created_by:   string | null
  created_at:   string
  resolved_at:  string | null
  resolved_by:  string | null
}

export const CARD_SELECT =
  'id, user_id, color, source, session_id, period_month, seq, reason, range_from, range_to, created_by, created_at, resolved_at, resolved_by'

export const CARD_SOURCE_LABELS: Record<CardSource, string> = {
  no_show:      '無断キャンセル',
  unsubmitted:  '未提出のまま欠席',
  manual:       '幹部の判断',
  yellow_limit: 'イエローの累積',
  streak:       '連続欠席',
}

/** 'YYYY-MM-DD' → その月の月初日 'YYYY-MM-01' */
export function monthStartOf(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

/** 'YYYY-MM-01' → 「11月」 */
export function formatMonthLabel(month: string): string {
  return `${Number(month.slice(5, 7))}月`
}

export function isActive(card: Pick<Card, 'resolved_at'>): boolean {
  return card.resolved_at === null
}

export type CardSummary = {
  yellowThisMonth: number  // 今月の（取り消されていない）イエロー
  redActive:       number  // 解除されていないレッド（月をまたいで残る）
}

/** 1人分のカードから、今の枚数を数える（todayJst は JST の今日 YYYY-MM-DD） */
export function summarizeCards(cards: Pick<Card, 'color' | 'period_month' | 'resolved_at'>[], todayJst: string): CardSummary {
  const month = monthStartOf(todayJst)
  let yellowThisMonth = 0
  let redActive = 0
  for (const c of cards) {
    if (!isActive(c)) continue
    if (c.color === 'red') redActive++
    else if (c.period_month === month) yellowThisMonth++
  }
  return { yellowThisMonth, redActive }
}

/** 部員ごとにまとめる */
export function groupCardsByUser<T extends Pick<Card, 'user_id'>>(cards: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const c of cards) {
    const list = map.get(c.user_id)
    if (list) list.push(c)
    else map.set(c.user_id, [c])
  }
  return map
}

/** 解除されていないレッドを持つ人を先頭にする（それ以外の順番は変えない） */
export function sortRedFirst<T extends { id: string }>(list: T[], hasRed: (id: string) => boolean): T[] {
  return [...list.filter(m => hasRed(m.id)), ...list.filter(m => !hasRed(m.id))]
}

/** レッドの内訳に出すイエロー（そのレッドの月のイエロー。取り消したものは除く）。古い順 */
export function yellowsBehindRed<T extends Pick<Card, 'color' | 'period_month' | 'resolved_at' | 'created_at'>>(
  red: Pick<Card, 'source' | 'period_month'>,
  userCards: T[],
  sessionDateOf: (card: T) => string | null,
): T[] {
  if (red.source !== 'yellow_limit') return []
  return userCards
    .filter(c => c.color === 'yellow' && isActive(c) && c.period_month === red.period_month)
    .sort((a, b) => (sessionDateOf(a) ?? a.created_at).localeCompare(sessionDateOf(b) ?? b.created_at))
}
