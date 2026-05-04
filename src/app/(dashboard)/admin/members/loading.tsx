// メンバー管理/一覧ページ スケルトンスクリーン（Twitter風）
function MemberCardSkeleton() {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="flex items-center gap-3">
        {/* アバター */}
        <div className="skeleton w-10 h-10 rounded-full shrink-0" />
        {/* テキスト */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-10 rounded-full" />
          </div>
          <div className="skeleton h-3 w-40" />
        </div>
        {/* ボタン群 */}
        <div className="flex gap-1.5 shrink-0">
          <div className="skeleton w-7 h-7 rounded-lg" />
        </div>
      </div>
      {/* ドロップダウン行 */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-1">
            <div className="skeleton h-3 w-10" />
            <div className="skeleton h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MembersLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up flex flex-col gap-2">
        <div className="skeleton h-8 w-36" />
        <div className="skeleton h-4 w-56" />
      </div>

      {/* フィルター行 */}
      <div className="animate-slide-up flex gap-2" style={{ animationDelay: '0.04s' }}>
        {[60, 72, 52].map((w, i) => (
          <div key={i} className="skeleton h-9 rounded-xl" style={{ width: `${w}px` }} />
        ))}
      </div>

      {/* メンバーカード × 4 */}
      <div className="flex flex-col gap-3 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        {[0, 1, 2, 3].map(i => (
          <MemberCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
