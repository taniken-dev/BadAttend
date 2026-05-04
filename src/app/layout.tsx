import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const notoSansJP = Noto_Sans_JP({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-noto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '千葉工大 バドミントン部 | 出欠管理',
  description: '部活動の出欠連絡・選手選考支援システム',
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
  // themeColor はダークモードトグルと連動させるため JS で管理
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full`}>
      <head>
        {/* theme-color: ライト=#f5f5f7 / ダーク=#0f0f11 — JS で動的に切り替え */}
        <meta name="theme-color" content="#f5f5f7" />
        {/* フラッシュなし＆theme-color即時適用 */}
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){var d=localStorage.getItem('theme')==='dark';if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#0f0f11':'#f5f5f7');})()`}</Script>
      </head>
      <body className="min-h-full" style={{ fontFamily: 'var(--font-noto), sans-serif' }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
