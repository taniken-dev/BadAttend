import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Cookie の読み書き権限を response に持たせた SSR クライアントを生成
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // リフレッシュ後の新しいトークンをブラウザへ返す
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() はサーバーと通信してトークンを検証・リフレッシュする
  // ※ getSession() は署名未検証のため認可判断に使ってはいけない
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 未認証ユーザーが保護ルートへアクセスしたらログインへ
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/pending'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 認証済みユーザーがログイン画面へアクセスしたらダッシュボードへ
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにマッチ:
     *   - _next/static  (静的ファイル)
     *   - _next/image   (画像最適化)
     *   - favicon.ico 等の静的アセット
     *   - /api/         (API ルートは独自認証)
     *   - /auth/        (コールバックルート)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)|api/|auth/).*)',
  ],
}
