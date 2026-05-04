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
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4338ca',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full`}>
      <head>
        {/* フラッシュなしでテーマを適用 */}
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');})()`}</Script>
      </head>
      <body className="min-h-full" style={{ fontFamily: 'var(--font-noto), sans-serif' }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
