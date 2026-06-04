export default function TermsLoading() {
  return (
    <div className="min-h-screen px-5 py-16" style={{ background: 'var(--apple-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* タイトル行 */}
        <div className="flex items-center gap-3 mb-10 animate-slide-up">
          <div className="skeleton w-6 h-6 rounded" />
          <div className="skeleton h-7 w-24" />
        </div>

        {/* 条文スケルトン × 8 */}
        <div className="flex flex-col gap-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
              {i % 3 === 1 && <div className="skeleton h-3 w-4/6" />}
            </div>
          ))}

          {/* 制定日 */}
          <div className="skeleton h-3 w-32" />
        </div>

        {/* フッターリンク */}
        <div className="mt-12 flex items-center gap-4">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-36" />
        </div>

      </div>
    </div>
  )
}
