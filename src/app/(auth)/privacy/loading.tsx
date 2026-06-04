export default function PrivacyLoading() {
  return (
    <div className="min-h-screen px-5 py-16" style={{ background: 'var(--apple-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* タイトル行 */}
        <div className="flex items-center gap-3 mb-10 animate-slide-up">
          <div className="skeleton w-6 h-6 rounded" />
          <div className="skeleton h-7 w-40" />
        </div>

        {/* リード文 */}
        <div className="flex flex-col gap-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex flex-col gap-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>

          {/* セクション × 8 */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-11/12" />
              {i % 2 === 0 && <div className="skeleton h-3 w-3/4" />}
              {/* お問い合わせ枠 */}
              {i === 7 && (
                <div className="mt-1 rounded-xl p-4 flex flex-col gap-2" style={{ border: '1px solid var(--hairline)' }}>
                  <div className="skeleton h-3 w-28" />
                  <div className="skeleton h-3 w-48" />
                </div>
              )}
            </div>
          ))}

          {/* 制定日 */}
          <div className="skeleton h-3 w-32" />
        </div>

        {/* フッターリンク */}
        <div className="mt-12 flex items-center gap-4">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-20" />
        </div>

      </div>
    </div>
  )
}
