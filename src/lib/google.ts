import { google } from 'googleapis'

// Google Calendar API 用 OAuth クライアント（リフレッシュトークン方式）
export function buildOAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

// カンマ区切りのカレンダーID環境変数を配列へ
export function parseCalendarIds(env: string | undefined): string[] {
  return (env ?? '').split(',').map(s => s.trim()).filter(Boolean)
}
