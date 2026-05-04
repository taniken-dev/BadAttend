// 出欠連絡ページ スケルトンスクリーン（Twitter風カードスケルトン）
export default function AttendanceLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up flex flex-col gap-2">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-4 w-44" />
      </div>

      {/* 受付中バナー */}
      <div className="skeleton h-14 w-full rounded-2xl animate-slide-up" style={{ animationDelay: '0.04s' }} />

      {/* セッションカード × 3 */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="card animate-slide-up"
          style={{ animationDelay: `${0.06 + i * 0.06}s` }}
        >
          <div className="flex items-center gap-3">
            {/* アイコン */}
            <div className="skeleton w-11 h-11 rounded-xl shrink-0" />
            {/* テキスト */}
            <div className="flex flex-col gap-2 flex-1">
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-3 w-48" />
            </div>
            {/* ステータスバッジ */}
            <div className="skeleton h-7 w-14 rounded-full shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}
