'use client'

import { useState } from 'react'
import { AlertCircle, Feather } from 'lucide-react'

function LineIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

export default function LoginPage() {
  const [lineLoading, setLineLoading] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  function handleLineLogin() {
    setLineLoading(true)
    setError(null)
    const isPwa = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isPwa) localStorage.setItem('pwa_auth_pending', '1')
    window.location.href = '/api/auth/line'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-[#f5f5f7]">

      {/* ロゴ */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--club-blue)' }}
        >
          <Feather size={26} color="white" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">BadAttend</h1>
          <p className="text-sm mt-0.5 text-gray-500">千葉工大バドミントン部 出欠管理</p>
        </div>
      </div>

      {/* カード */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-gray-200">

        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 border border-red-200 text-red-600">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleLineLogin}
          disabled={lineLoading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-white text-base transition-all duration-150"
          style={{
            background: '#06C755',
            opacity: lineLoading ? 0.7 : 1,
            fontSize: '16px',
          }}
          onMouseEnter={e => { if (!lineLoading) (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >
          {lineLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              接続中...
            </>
          ) : (
            <>
              <LineIcon size={22} />
              LINEでログイン
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          上のボタンからログインしてください
        </p>
      </div>

      {/* フッター */}
      <p className="text-xs mt-8 text-gray-400">© 2026 Kentaro Tani</p>
    </div>
  )
}
