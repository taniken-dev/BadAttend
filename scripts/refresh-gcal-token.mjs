/**
 * Google Calendar リフレッシュトークン再発行スクリプト
 * 使い方: node scripts/refresh-gcal-token.mjs
 */

import { createServer } from 'http'
import { readFileSync } from 'fs'

// .env.local から CLIENT_ID / SECRET を読み込む
const envLines = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8').split('\n')
function getEnv(key) {
  const line = envLines.find(l => l.startsWith(key + '='))
  return line ? line.slice(key.length + 1).trim() : ''
}

const CLIENT_ID     = getEnv('GOOGLE_CLIENT_ID')
const CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET')
const REDIRECT_URI  = 'http://localhost:9999/callback'
const SCOPES        = 'https://www.googleapis.com/auth/calendar.readonly'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('GOOGLE_CLIENT_ID または GOOGLE_CLIENT_SECRET が .env.local に見つかりません')
  process.exit(1)
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log('\n以下のURLをブラウザで開いてください:\n')
console.log(authUrl)
console.log('\nGoogleアカウントで認証すると自動でトークンが表示されます...\n')

// 認証コードを受け取るローカルサーバー
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:9999')
  if (url.pathname !== '/callback') { res.end(); return }

  const code = url.searchParams.get('code')
  if (!code) { res.end('エラー: code が見つかりません'); return }

  const params = new URLSearchParams({
    code,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  })
  const tokenData = await tokenRes.json()

  if (tokenData.refresh_token) {
    console.log('\n✅ 新しいリフレッシュトークン:')
    console.log(tokenData.refresh_token)
    console.log('\n.env.local の GOOGLE_REFRESH_TOKEN と')
    console.log('Vercel の環境変数 GOOGLE_REFRESH_TOKEN を上記の値に更新してください\n')
    res.end('<h2>トークン取得成功！ターミナルを確認してください。</h2>')
  } else {
    console.error('\nエラー:', tokenData)
    res.end('<h2>エラーが発生しました。ターミナルを確認してください。</h2>')
  }

  server.close()
})

server.listen(9999, () => {
  console.log('(ポート 9999 で待機中...)')
})
