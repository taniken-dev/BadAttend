/**
 * 過去出欠データ一括インポートスクリプト
 *
 * 使い方:
 *   node scripts/import-past-attendance.js [CSVファイルパス]
 *   （省略時は {月}past-attendance.csv を自動検索、例: 5past-attendance.csv）
 *
 * ファイル命名規則:
 *   5月  → 5past-attendance.csv
 *   6月  → 6past-attendance.csv
 *   ...
 *   12月 → 12past-attendance.csv
 *   1月  → 1past-attendance.csv  （2026年）
 *   2月  → 2past-attendance.csv  （2026年）
 *   3月  → 3past-attendance.csv  （2026年）
 *
 * 年の自動判定:
 *   5月〜12月 → 2025年
 *   1月〜3月  → 2026年
 *
 * CSVフォーマット（generate-past-template.js の出力形式）:
 *   1行目: 名前, 学年, 5/1(金), 理由1, 5/6(水), 理由2, ...
 *   2行目以降: 部員名, 学年, 〇/×/△/遅, 理由テキスト, ...
 *
 * ⚠️  注意: INSERT 時に DB トリガー（calc_points_on_attendance）が発火し、
 *          profiles.total_points が更新されます。過去データ投入後に
 *          ポイントの整合性を確認してください。
 */

const fs   = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// ================================================================
// ---- 設定（必要に応じて変更） ----
// ================================================================

// 欠席レコードの status（過去データのため absent_normal をデフォルトとする）
const DEFAULT_ABSENT_STATUS = 'absent_normal'

// インポート済みレコードがあった場合の挙動: 'skip' | 'overwrite'
const ON_CONFLICT = 'skip'

// ================================================================

// ---- 月から年を自動判定（5〜12月 → 2025年、1〜3月 → 2026年） ----
function getYearForMonth(month) {
  return month >= 5 ? 2025 : 2026
}

// ================================================================

// ---- .env.local 読み込み ----
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  const env = {}
  try {
    fs.readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim()
    })
  } catch {
    console.error('エラー: .env.local が見つかりません')
    process.exit(1)
  }
  return env
}

// ---- シンプルCSVパーサー（BOM・クォート対応） ----
function parseCSV(content) {
  // BOM除去
  const raw = content.replace(/^﻿/, '')
  const lines = []
  let cur = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]

    if (inQuote) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        cur.push(field)
        field = ''
      } else if (ch === '\r') {
        // skip
      } else if (ch === '\n') {
        cur.push(field)
        lines.push(cur)
        cur = []
        field = ''
      } else {
        field += ch
      }
    }
  }

  // 末尾行
  if (field || cur.length > 0) {
    cur.push(field)
    lines.push(cur)
  }

  return lines
}

// ---- 日付文字列のパース: 「5/1(金)」→ 「2025-05-01」 ----
function parseJapaneseDate(raw) {
  if (!raw || !raw.trim()) return null
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const month = parseInt(m[1], 10)
  const day   = parseInt(m[2], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const year = getYearForMonth(month)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// ---- 出欠セルのマッピング ----
function parseStatus(cell) {
  const v = (cell ?? '').trim()
  if (!v) return null

  // 出席
  if (v === '〇' || v === '○' || v === 'o' || v === 'O' || v === '◯') {
    return 'present'
  }
  // 遅刻
  if (v === '△' || v === '▲' || v === '遅' || v.startsWith('遅')) {
    return 'tardy'
  }
  // 欠席
  if (v === '×' || v === 'x' || v === 'X' || v === '✕' || v === '✗') {
    return DEFAULT_ABSENT_STATUS
  }

  return null
}

// ---- 理由テキストを DB の reason enum に自動マッピング ----
// reason_detail には元テキストをそのまま保存する
const REASON_KEYWORDS = {
  practice: ['練習', '大会', '試合', '遠征', '部活'],
  class:    ['授業', '課題', 'レポート', 'テスト', '講義', '実習', '研究', 'ゼミ'],
  sick:     ['体調', '風邪', '病気', '発熱', '頭痛', '腹痛', '怪我', 'ケガ', '肩', '腰', '足', '膝'],
  personal: ['用事', '私用', '家', '帰省', '就活', '面接', '本会議', 'クラブ', '冠婚'],
}

function mapReason(text) {
  const t = (text ?? '').trim()
  if (!t) return { reason: null, reasonDetail: null }

  for (const [key, keywords] of Object.entries(REASON_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw))) {
      return { reason: key, reasonDetail: t }
    }
  }
  return { reason: 'other', reasonDetail: t }
}

// ================================================================
// メイン処理
// ================================================================
async function main() {
  const env = loadEnv()

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error(
      'エラー: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です'
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ---- CSVファイル読み込み ----
  let csvPath
  if (process.argv[2]) {
    csvPath = path.resolve(process.argv[2])
  } else {
    // {月}past-attendance.csv を 5月〜翌3月の順で検索
    const months = [5,6,7,8,9,10,11,12,1,2,3]
    const found = months.find(m =>
      fs.existsSync(path.resolve(process.cwd(), `${m}past-attendance.csv`))
    )
    if (found) {
      csvPath = path.resolve(process.cwd(), `${found}past-attendance.csv`)
    }
  }

  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('エラー: CSVファイルが見つかりません')
    console.error('  ファイル名は「{月}past-attendance.csv」形式にしてください')
    console.error('  例: 5past-attendance.csv, 12past-attendance.csv')
    console.error('  または: node scripts/import-past-attendance.js <ファイルパス>')
    process.exit(1)
  }

  console.log(`CSVを読み込み中: ${csvPath}`)
  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content).filter(r => r.some(c => c.trim()))

  if (rows.length < 2) {
    console.error('エラー: CSVにデータがありません（ヘッダー行 + 1行以上必要）')
    process.exit(1)
  }

  // ---- ヘッダー行のパース ----
  // 列構造: [0]=名前, [1]=学年, [2]=日付1, [3]=理由1, [4]=日付2, [5]=理由2, ...
  const headerRow = rows[0]
  const datePairs = [] // [{ dateStr, colIndex }]

  for (let col = 2; col < headerRow.length; col += 2) {
    const dateStr = parseJapaneseDate(headerRow[col])
    if (dateStr) {
      datePairs.push({ dateStr, colIndex: col })
    } else if (headerRow[col] && headerRow[col].trim()) {
      console.warn(`  ⚠ 日付パース失敗（スキップ）: 列${col + 1} = "${headerRow[col]}"`)
    }
  }

  if (datePairs.length === 0) {
    console.error('エラー: 有効な日付ヘッダーが見つかりません')
    console.error('  1行目の日付セルが「5/1(金)」のような形式になっているか確認してください')
    process.exit(1)
  }

  console.log(`\n日付: ${datePairs.map(d => d.dateStr).join(', ')}`)

  // ---- practice_sessions の upsert ----
  console.log('\npractice_sessions を確認・作成中...')
  const sessionDates = [...new Set(datePairs.map(d => d.dateStr))]

  const { error: sessionError } = await supabase
    .from('practice_sessions')
    .upsert(
      sessionDates.map(d => ({ session_date: d })),
      { onConflict: 'session_date', ignoreDuplicates: true }
    )

  if (sessionError) {
    console.error('practice_sessions upsert エラー:', sessionError.message)
    process.exit(1)
  }

  // session_date → session_id のマップを構築
  const { data: sessions, error: sessionsError } = await supabase
    .from('practice_sessions')
    .select('id, session_date')
    .in('session_date', sessionDates)

  if (sessionsError) {
    console.error('practice_sessions 取得エラー:', sessionsError.message)
    process.exit(1)
  }

  const sessionMap = Object.fromEntries(
    sessions.map(s => [s.session_date, s.id])
  )

  // ---- profiles の取得（full_name → id マップ） ----
  console.log('プロフィールを取得中...')
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, full_name')

  if (profilesError) {
    console.error('profiles 取得エラー:', profilesError.message)
    process.exit(1)
  }

  // display_name → id（未設定の場合は full_name をキーとして登録）
  const profileMap = {}
  for (const p of profiles) {
    const key = (p.display_name || p.full_name || '').trim()
    if (key) profileMap[key] = p.id
  }

  // ---- データ行の処理 ----
  console.log('\n出欠データをインポート中...\n')

  const stats = {
    skippedRows:    0, // 名前なし行
    unknownMembers: [], // 名前不一致
    inserted:       0,
    skippedRecords: 0, // 空セルまたは競合スキップ
    errors:         [],
  }

  const dataRows = rows.slice(1)

  for (const row of dataRows) {
    const memberName = (row[0] ?? '').trim()

    // 空行スキップ
    if (!memberName) {
      stats.skippedRows++
      continue
    }

    const userId = profileMap[memberName]
    if (!userId) {
      stats.unknownMembers.push(memberName)
      console.warn(`  ⚠ 名前が一致しません: "${memberName}"`)
      continue
    }

    // 各日付ペアを処理
    for (const { dateStr, colIndex } of datePairs) {
      const statusCell = (row[colIndex] ?? '').trim()
      const reasonCell = (row[colIndex + 1] ?? '').trim()

      const status = parseStatus(statusCell)
      if (!status) continue // 空セルまたは不明な値はスキップ

      const sessionId = sessionMap[dateStr]
      if (!sessionId) {
        stats.errors.push(`session_id 未取得: ${dateStr}`)
        continue
      }

      const { reason, reasonDetail } = mapReason(reasonCell)

      // 欠席・遅刻で理由が未記入の場合は 'other' / '不明' をセット
      const isAbsentOrTardy = status !== 'present'
      const finalReason     = isAbsentOrTardy ? (reason ?? 'other')       : null
      const finalDetail     = isAbsentOrTardy ? (reasonDetail ?? '不明')  : (reasonDetail || null)

      const record = {
        session_id:    sessionId,
        user_id:       userId,
        status,
        reason:        finalReason,
        reason_detail: finalDetail,
        reported_at:   null,
      }

      if (ON_CONFLICT === 'skip') {
        // INSERT ... ON CONFLICT DO NOTHING
        const { error } = await supabase
          .from('attendance_records')
          .insert(record)

        if (error) {
          if (error.code === '23505') {
            // unique constraint violation = 既存レコード
            stats.skippedRecords++
          } else {
            stats.errors.push(
              `${memberName} / ${dateStr}: ${error.message}`
            )
          }
        } else {
          stats.inserted++
          process.stdout.write('.')
        }
      } else {
        // upsert（overwrite モード）
        const { error } = await supabase
          .from('attendance_records')
          .upsert(record, { onConflict: 'session_id,user_id' })

        if (error) {
          stats.errors.push(`${memberName} / ${dateStr}: ${error.message}`)
        } else {
          stats.inserted++
          process.stdout.write('.')
        }
      }
    }
  }

  // ---- 結果サマリー ----
  console.log('\n\n========================================')
  console.log('インポート完了')
  console.log('========================================')
  console.log(`  挿入成功       : ${stats.inserted} 件`)
  console.log(`  スキップ（空行）: ${stats.skippedRows} 行`)
  console.log(`  スキップ（既存）: ${stats.skippedRecords} 件`)

  if (stats.unknownMembers.length > 0) {
    console.log(`\n⚠ 名前不一致（${stats.unknownMembers.length} 名）:`)
    stats.unknownMembers.forEach(n => console.log(`    - "${n}"`))
    console.log(
      '  → profiles.full_name と完全一致している必要があります。CSVの名前を確認してください。'
    )
  }

  if (stats.errors.length > 0) {
    console.log(`\n✗ エラー（${stats.errors.length} 件）:`)
    stats.errors.forEach(e => console.log(`    - ${e}`))
  }

  if (stats.inserted > 0) {
    console.log('\n⚠ ポイントについて:')
    console.log(
      '  DBトリガーにより profiles.total_points が更新されています。'
    )
    console.log(
      '  過去データ投入後はダッシュボードでポイントの整合性を確認してください。'
    )
  }
}

main().catch(err => {
  console.error('予期しないエラー:', err)
  process.exit(1)
})
