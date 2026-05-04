// カレンダーページ スケルトンスクリーン
export default function CalendarLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up flex flex-col gap-2">
        <div className="skeleton h-8 w-36" />
        <div className="skeleton h-4 w-52" />
      </div>

      {/* カレンダーカード */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.05s', padding: '16px' }}>
        {/* 月ナビ */}
        <div className="flex items-center justify-between mb-3">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="skeleton h-5 w-24" />
          <div className="skeleton w-8 h-8 rounded-lg" />
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1 gap-0.5">
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className="skeleton h-5 rounded" style={{ opacity: 0.5 }} />
          ))}
        </div>

        {/* 日付グリッド（5週分） */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center py-1.5 gap-1">
              <div className="skeleton w-7 h-5 rounded" style={{ opacity: i % 7 === 0 || i % 7 === 6 ? 0.3 : 0.6 }} />
              <div className="w-1 h-1 rounded-full" style={{ background: 'transparent' }} />
            </div>
          ))}
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid var(--gray-100)' }}>
          {[80, 100, 60].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="skeleton w-2 h-2 rounded-full" />
              <div className="skeleton h-3 rounded" style={{ width: `${w}px` }} />
            </div>
          ))}
          <div className="ml-auto skeleton h-5 w-20 rounded" />
        </div>
      </div>
    </div>
  )
}
