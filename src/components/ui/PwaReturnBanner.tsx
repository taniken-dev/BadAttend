'use client'

import { useEffect, useState } from 'react'

export default function PwaReturnBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const flag = localStorage.getItem('pwa_auth_pending')
    if (!flag) return

    const isPwa =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    if (isPwa) {
      // Already in the PWA — just clear the flag silently
      localStorage.removeItem('pwa_auth_pending')
    } else {
      // In Safari after LINE OAuth redirect — show the "tap app icon" overlay
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(145deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}
    >
      {/* 成功アイコン */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(6,199,85,0.15)', border: '2px solid rgba(6,199,85,0.4)' }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="text-2xl font-black text-white mb-2" style={{ letterSpacing: '-0.03em' }}>
        ログイン完了！
      </h1>
      <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
        認証に成功しました。<br />
        ホーム画面の <strong style={{ color: 'white' }}>BadAttend</strong> アイコンをタップして<br />
        アプリに戻ってください。
      </p>

      {/* アプリアイコンのイメージ */}
      <div
        className="flex flex-col items-center gap-2 px-8 py-6 rounded-2xl mb-8"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
            <line x1="16" y1="8" x2="2" y2="22"/>
            <line x1="17.5" y1="15" x2="9" y2="15"/>
          </svg>
        </div>
        <span className="text-sm font-bold text-white">BadAttend</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>↑ このアイコンをタップ</span>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem('pwa_auth_pending')
          setShow(false)
        }}
        className="text-xs"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        このままブラウザで続ける
      </button>
    </div>
  )
}
