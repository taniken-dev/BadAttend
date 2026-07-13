import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const notoSansJP = Noto_Sans_JP({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-noto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '出欠管理システム',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BadAttend',
  },
  other: {
    // iOS Safari PWA: タブ切り替え時にURLバーが出ないようにする
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  // themeColor はここでは指定しない。media 付き meta を出すと Safari が
  // 「端末のシステム設定」で色を選ぶため、アプリ内テーマと食い違う
  // （システム=ライト × アプリ=ダークで下部バーだけ白くなる）。
  // 代わりに <head> の単一 meta をインラインスクリプトで描画前に書き換える。
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f7f6f3" suppressHydrationWarning />
        {/* next/script beforeInteractive は __next_s キュー経由で実行が初回描画後になるため、
            素の <script> で描画前に .dark クラスと theme-color を確定させる。
            デフォルトはライト固定。手動トグルで 'dark' を保存した場合のみダーク
            （OS の prefers-color-scheme には追従しない）。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=localStorage.getItem('theme')==='dark';if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#191919':'#f7f6f3');}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
