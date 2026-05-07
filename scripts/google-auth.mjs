/**
 * Google OAuth 2.0 リフレッシュトークン取得スクリプト（一度だけ実行）
 *
 * 使い方:
 *   1. .env.local に以下を追加:
 *        GOOGLE_CLIENT_ID=...
 *        GOOGLE_CLIENT_SECRET=...
 *   2. node scripts/google-auth.mjs を実行
 *   3. 表示されたURLをブラウザで開いて認証
 *   4. リダイレクト先URLの ?code=XXX をターミナルに貼り付ける
 *   5. 表示された GOOGLE_REFRESH_TOKEN を .env.local に追加
 */

import { createInterface } from 'readline'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local から環境変数を読み込む
const envPath = resolve(process.cwd(), '.env.local')
const env = {}
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  })
} catch {
  console.error('.env.local が見つかりません')
  process.exit(1)
}

const CLIENT_ID     = env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を .env.local に設定してください')
  process.exit(1)
}

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log('\n=== Google OAuth 認証 ===\n')
console.log('以下のURLをブラウザで開いてください:\n')
console.log(authUrl)
console.log('\n認証後に表示されたコードを貼り付けてください:')

const rl = createInterface({ input: process.stdin, output: process.stdout })
rl.question('> コード: ', async (code) => {
  rl.close()

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })

  const data = await res.json()

  if (data.error) {
    console.error('\nエラー:', data.error_description ?? data.error)
    process.exit(1)
  }

  console.log('\n=== .env.local に以下を追加してください ===\n')
  console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`)
  console.log('\n※ GOOGLE_CALENDAR_ID も忘れずに追加してください')
  console.log('  （Google カレンダーの設定 > カレンダーの統合 > カレンダーID）')
})
