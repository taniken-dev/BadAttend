// 運用KPIページ スケルトンスクリーン
export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up flex flex-col gap-2">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-4 w-64" />
      </div>

      {/* 注意バナー */}
      <div className="card animate-slide-up flex flex-col gap-2" style={{ animationDelay: '0.04s' }}>
        <div className="skeleton h-4 w-48" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-3/4" />
      </div>

      {/* KPIカード × 3 */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-slide-up"
        style={{ animationDelay: '0.08s' }}
      >
        {[0, 1, 2].map(i => (
          <div key={i} className="card flex flex-col gap-2">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-16" />
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>

      {/* チャート × 3 */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-slide-up"
        style={{ animationDelay: '0.12s' }}
      >
        {[0, 1, 2].map(i => (
          <div key={i} className="card flex flex-col gap-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* テーブル */}
      <div className="card animate-slide-up flex flex-col gap-2" style={{ animationDelay: '0.16s' }}>
        <div className="skeleton h-4 w-24" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-6 w-full" />
        ))}
      </div>
    </div>
  )
}
