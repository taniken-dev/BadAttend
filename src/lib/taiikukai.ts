// 体育会本部HP（Googleサイト）から「提出期限間近の書類」を取得・パースする。
// Googleサイトはサーバーサイドレンダリングのため fetch した HTML に本文が含まれるが、
// テキストが細かい <span> に分断されているので、タグを全除去したプレーンテキストを
// 行単位でパースする（サイト側のマークアップ変更に強い方式）。

const DEFAULT_URL = 'https://sites.google.com/view/chibatechtaiikuhp/home'
const SECTION_HEADING = '提出期限間近の書類'

export interface ParsedDeadline {
  /** 締切日時＋書類名の自然キー。再取得時の upsert に使う */
  sourceKey: string
  /** ISO 8601（JST オフセット付き） */
  deadlineAt: string
  documentName: string
}

export interface ScrapeResult {
  /** 見出し「提出期限間近の書類」が見つかったか（false は構成変更の疑い） */
  sectionFound: boolean
  deadlines: ParsedDeadline[]
}

export function getTaiikukaiUrl(): string {
  return process.env.TAIIKUKAI_URL || DEFAULT_URL
}

/** 全角数字・記号を半角へ正規化（担当者の手入力ゆれ対策） */
function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/〆切/g, '締切')
}

/** HTML をプレーンテキスト行の配列にする */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/(h[1-6]|div|p|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
  return text.split('\n').map(s => normalize(s.trim())).filter(Boolean)
}

// 例: 「7月16日(木)18時締切」「8月6日(木)17時30分締切」（曜日・分は省略可）
const HEADER_RE = /^(\d{1,2})月(\d{1,2})日(?:\([月火水木金土日]\))?(\d{1,2})時(?:(\d{1,2})分)?締切$/
// 例: 「・8月分【施設使用願】最終提出締切」
const BULLET_RE = /^[・･•]\s*(.+)$/

/**
 * サイト上の日付には年がないため推定する。
 * 基本は現在年。結果が 90 日以上過去なら翌年（年末に翌年1月の締切が載るケース）、
 * 9 ヶ月以上未来なら前年（年始に前年12月の残存記載があるケース）とみなす。
 */
export function inferDeadlineIso(
  month: number, day: number, hour: number, minute: number, now: Date = new Date()
): string {
  const toIso = (year: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` +
    `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`

  const nowYearJst = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(now)
  )
  const DAY_MS = 24 * 60 * 60 * 1000
  const candidate = new Date(toIso(nowYearJst))
  if (candidate.getTime() < now.getTime() - 90 * DAY_MS) return toIso(nowYearJst + 1)
  if (candidate.getTime() > now.getTime() + 270 * DAY_MS) return toIso(nowYearJst - 1)
  return toIso(nowYearJst)
}

/** プレーンテキスト行から締切一覧を抽出する */
export function parseDeadlines(lines: string[], now: Date = new Date()): ScrapeResult {
  const start = lines.findIndex(l => l.includes(SECTION_HEADING))
  if (start === -1) return { sectionFound: false, deadlines: [] }

  const deadlines: ParsedDeadline[] = []
  let currentIso: string | null = null

  for (let i = start + 1; i < lines.length; i++) {
    // htmlToLines 済みでも、行配列を直接渡された場合に備えて再正規化（冪等）
    const line = normalize(lines[i])
    const header = line.match(HEADER_RE)
    if (header) {
      currentIso = inferDeadlineIso(
        Number(header[1]), Number(header[2]), Number(header[3]), Number(header[4] ?? 0), now
      )
      continue
    }
    const bullet = line.match(BULLET_RE)
    if (bullet && currentIso) {
      const documentName = bullet[1].trim()
      deadlines.push({
        sourceKey: `${currentIso}|${documentName}`,
        deadlineAt: currentIso,
        documentName,
      })
      continue
    }
    // 見出しでも箇条書きでもない行が来たらセクション終了（次のセクションの見出し等）
    break
  }

  return { sectionFound: true, deadlines }
}

/** 体育会HPを取得してパースする。fetch 失敗時は throw する */
export async function fetchTaiikukaiDeadlines(now: Date = new Date()): Promise<ScrapeResult> {
  const res = await fetch(getTaiikukaiUrl(), {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BadAttend-DeadlineBot)' },
  })
  if (!res.ok) {
    throw new Error(`体育会HPの取得に失敗しました (HTTP ${res.status})`)
  }
  const html = await res.text()
  return parseDeadlines(htmlToLines(html), now)
}
