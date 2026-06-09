/**
 * 過去出欠一括インポート用テンプレートCSV生成スクリプト
 *
 * 使い方:
 *   node scripts/generate-past-template.js
 *
 * 出力: past-attendance-template.csv（プロジェクトルート）
 *
 * ※ 出力後に以下を手動編集してください:
 *    - 1行目: 「日付1」「日付2」... を実際の日付（例: 5/1(金)）に書き換える
 *    - 各セル: 出欠（〇/×/△/遅）と理由テキストを入力する
 */

const fs   = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// ---- 設定 ----
// テンプレートに含める日付ペア数（必要に応じて変更）
const DATE_PAIR_COUNT = 15
// 出力先ファイルパス
const OUTPUT_PATH = path.resolve(process.cwd(), 'past-attendance-template.csv')

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

// ---- CSVエスケープ ----
function csvCell(val) {
  const s = String(val ?? '')
  // カンマ・ダブルクォート・改行を含む場合はクォートで囲む
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

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

  console.log('プロフィールを取得中...')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('display_name, full_name, grade')
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('grade', { ascending: false })
    .order('display_name')

  if (error) {
    console.error('プロフィール取得エラー:', error.message)
    process.exit(1)
  }

  if (!profiles || profiles.length === 0) {
    console.error('承認済みの部員が見つかりません')
    process.exit(1)
  }

  // ---- ヘッダー行の構築 ----
  // 列: 名前, 学年, 日付1, 理由1, 日付2, 理由2, ...
  const headerRow = ['名前', '学年']
  for (let i = 1; i <= DATE_PAIR_COUNT; i++) {
    headerRow.push(`日付${i}`, `理由${i}`)
  }

  // ---- データ行の構築 ----
  const dataRows = profiles.map(p => {
    // display_name が未設定の場合は full_name にフォールバック
    const name = p.display_name || p.full_name
    const row = [name, p.grade]
    // 出欠・理由の空セルを DATE_PAIR_COUNT 分追加
    for (let i = 0; i < DATE_PAIR_COUNT; i++) {
      row.push('', '')
    }
    return row
  })

  // ---- CSV文字列の構築（BOM付きUTF-8） ----
  const BOM = '﻿'
  const lines = [headerRow, ...dataRows].map(row =>
    row.map(csvCell).join(',')
  )
  const csvContent = BOM + lines.join('\r\n') + '\r\n'

  fs.writeFileSync(OUTPUT_PATH, csvContent, 'utf-8')

  console.log('✓ テンプレート生成完了')
  console.log(`  出力先   : ${OUTPUT_PATH}`)
  console.log(`  部員数   : ${profiles.length} 名`)
  console.log(`  日付列数 : ${DATE_PAIR_COUNT} ペア`)
  console.log('')
  console.log('【次のステップ】')
  console.log('  1. Excel/スプレッドシートで CSV を開く')
  console.log('  2. 1行目の「日付N」を実際の日付（例: 5/1(金)）に書き換える')
  console.log('  3. 各行に出欠（〇/×/△/遅）と理由を入力する')
  console.log('  4. past-attendance.csv として保存する')
  console.log('  5. node scripts/import-past-attendance.js を実行する')
}

main().catch(err => {
  console.error('予期しないエラー:', err)
  process.exit(1)
})
