// ホームページ スケルトンスクリーン
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up flex flex-col gap-2">
        <div className="skeleton h-8 w-28" />
        <div className="skeleton h-4 w-48" />
      </div>

      {/* 今日のセッションカード */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.04s' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="skeleton w-11 h-11 rounded-xl shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-32" />
          </div>
        </div>
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>

      {/* 自分の出席状況カード */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div className="skeleton h-4 w-24 mb-4" />
        {/* 出席率 */}
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="skeleton h-10 w-20" />
          <div className="skeleton h-2 w-full rounded-full" />
        </div>
        {/* 3つのスタッツボックス */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
        {/* 直近実績ドット */}
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-24" />
          <div className="flex gap-1.5 ml-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton w-5 h-5 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* ランキングセクション */}
      <div className="animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-4 w-10" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: '12px 16px' }}>
              <div className="flex items-center gap-3">
                <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
                <div className="skeleton w-10 h-10 rounded-full shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-3 w-16" />
                </div>
                <div className="skeleton h-6 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
