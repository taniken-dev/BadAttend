import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin

  const state = randomBytes(16).toString('hex')
  const nonce = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINE_CLIENT_ID!,
    redirect_uri:  `${origin}/auth/callback`,
    state,
    scope:         'profile openid',
    nonce,
  })

  const response = NextResponse.redirect(
    `https://access.line.me/oauth2/v2.1/authorize?${params}`
  )

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600,  // 10分
    path:     '/',
    sameSite: 'lax' as const,
  }
  response.cookies.set('line_state', state, cookieOpts)
  response.cookies.set('line_nonce', nonce, cookieOpts)

  return response
}
