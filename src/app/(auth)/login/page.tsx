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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      {/* 装飾グロー */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(6,199,85,0.1) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* ロゴ */}
      <div className="flex flex-col items-center gap-3 mb-8 z-10" style={{ animation: 'slideUp 0.4s ease both' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
            boxShadow: '0 8px 32px rgba(67,56,202,0.5)',
          }}
        >
          <Feather size={30} color="white" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-white" style={{ letterSpacing: '-0.03em' }}>
            BadAttend
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            千葉工大バドミントン部 出欠管理
          </p>
        </div>
      </div>

      {/* グラスカード */}
      <div
        className="w-full max-w-sm z-10 flex flex-col gap-5 rounded-3xl p-7"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.4s ease 0.05s both',
        }}
      >
        {/* エラー */}
        {error && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5' }}
          >
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── LINEログイン（メイン） ── */}
        <button
          type="button"
          onClick={handleLineLogin}
          disabled={lineLoading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-white text-base transition-all duration-200"
          style={{
            background: lineLoading ? '#04a348' : '#06C755',
            boxShadow: lineLoading ? 'none' : '0 4px 24px rgba(6,199,85,0.45)',
            transform: lineLoading ? 'scale(0.98)' : 'scale(1)',
            fontSize: '17px',
          }}
          onMouseEnter={e => {
            if (!lineLoading) (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
        >
          {lineLoading ? (
            <>
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              LINEへ接続中...
            </>
          ) : (
            <>
              <LineIcon size={24} />
              LINEでログイン
            </>
          )}
        </button>

        {/* LINE説明テキスト */}
        <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginTop: '-8px' }}>
          上のボタンからログインしてください
        </p>
      </div>

      {/* フッター */}
      <p
        className="text-xs mt-8 z-10"
        style={{ color: 'rgba(255,255,255,0.2)', animation: 'slideUp 0.4s ease 0.1s both' }}
      >
        © 2026 Kentaro Tani
      </p>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  )
}
