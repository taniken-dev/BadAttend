import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const state      = searchParams.get('state')
  const tokenHash  = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next') ?? '/dashboard'

  const savedState  = request.cookies.get('line_state')?.value

  // ① LINE コールバック（state クッキーと一致）
  if (state && savedState && state === savedState && code) {
    return handleLineCallback(code, origin, next)
  }

  // ② magic link 経由のセッション確立（LINE callback から内部リダイレクト）
  if (tokenHash && type) {
    return handleMagicLink(tokenHash, type as EmailOtpType, origin, next)
  }

  // ③ 通常の Supabase PKCE フロー（メール認証など）
  if (code) {
    return handleSupabasePkce(code, origin, next)
  }

  return NextResponse.redirect(new URL('/login?error=missing_params', origin))
}

// ─── LINE OAuth コールバック ───────────────────────────────────────────────

async function handleLineCallback(code: string, origin: string, next: string) {
  // 1. LINE トークン取得
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  `${origin}/auth/callback`,
      client_id:     process.env.LINE_CLIENT_ID!,
      client_secret: process.env.LINE_CLIENT_SECRET!,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    console.error('LINE token error:', tokenData)
    return NextResponse.redirect(new URL('/login?error=line_token', origin))
  }

  // 2. LINE ユーザー情報取得
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const lineProfile = await profileRes.json()
  const lineUserId  = lineProfile.userId as string
  const displayName = (lineProfile.displayName as string) ?? 'LINEユーザー'
  const pictureUrl  = lineProfile.pictureUrl as string | undefined

  if (!lineUserId) {
    return NextResponse.redirect(new URL('/login?error=line_profile', origin))
  }

  // 3. Admin クライアント
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const syntheticEmail = `line_${lineUserId}@line.user`

  // 4. ユーザー作成（既存なら email_exists を無視）
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email:         syntheticEmail,
    email_confirm: true,
    user_metadata: {
      full_name:    displayName,
      avatar_url:   pictureUrl ?? null,
      provider:     'custom:line',
      line_user_id: lineUserId,
    },
  })

  if (createErr && !createErr.message.includes('already been registered')) {
    console.error('createUser error:', createErr)
    return NextResponse.redirect(new URL('/login?error=user_create', origin))
  }

  // 新規ユーザー: プロフィールを作成
  if (!createErr && createData?.user) {
    await admin.from('profiles').insert({
      id:          createData.user.id,
      full_name:   displayName,
      avatar_url:  pictureUrl ?? null,
      grade:       1,
      role:        'member',
      skill_rank:  3,
      is_approved: false,
    })
  }

  // 既存ユーザー: 名前・アイコンのみ更新（is_approved は絶対に触らない）
  if (createErr?.message.includes('already been registered')) {
    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const existing = listData?.users?.find(u => u.email === syntheticEmail)
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { full_name: displayName, avatar_url: pictureUrl ?? null },
      })
      // profiles 行が存在しない場合（削除後の再登録など）は INSERT、存在する場合は名前/アイコンのみ UPDATE
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('id', existing.id)
        .single()
      if (existingProfile) {
        await admin.from('profiles')
          .update({ full_name: displayName, avatar_url: pictureUrl ?? null })
          .eq('id', existing.id)
      } else {
        await admin.from('profiles').insert({
          id:          existing.id,
          full_name:   displayName,
          avatar_url:  pictureUrl ?? null,
          grade:       1,
          role:        'member',
          skill_rank:  3,
          is_approved: false,
        })
      }
    }
  }

  // 5. magic link トークンを生成（メール送信なし・token_hash だけ使う）
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email: syntheticEmail,
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('generateLink error:', linkErr)
    return NextResponse.redirect(new URL('/login?error=link_gen', origin))
  }

  // 6. token_hash を使ったセッション確立ルートへ内部リダイレクト
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('token_hash', linkData.properties.hashed_token)
  callbackUrl.searchParams.set('type', 'magiclink')
  callbackUrl.searchParams.set('next', next)

  const response = NextResponse.redirect(callbackUrl)
  response.cookies.delete('line_state')
  response.cookies.delete('line_nonce')
  return response
}

// ─── magic link → verifyOtp でセッション確立 ─────────────────────────────

async function handleMagicLink(
  tokenHash: string,
  type: EmailOtpType,
  origin: string,
  next: string
) {
  const cookieStore = await cookies()
  // redirect レスポンスを先に作り、Cookie をそこに直接書き込む
  const response = NextResponse.redirect(new URL(next, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // redirect レスポンスと cookieStore 両方に書く
            response.cookies.set(name, value, options)
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    console.error('verifyOtp error:', error)
    return NextResponse.redirect(new URL('/login?error=verify_otp', origin))
  }

  return response
}

// ─── 通常の Supabase PKCE フロー ──────────────────────────────────────────

async function handleSupabasePkce(code: string, origin: string, next: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) {
    return NextResponse.redirect(new URL(next, origin))
  }
  return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
}
