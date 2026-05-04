'use client'

import { useState } from 'react'
import { Crown, ChevronDown, ChevronUp, AlertTriangle, Users } from 'lucide-react'
import { getAttendanceRateColor } from '@/lib/utils'
import type { SelectionScore } from '@/lib/types'

const PREVIEW_COUNT = 5

interface Props {
  scores: SelectionScore[]
  currentUserId: string
  isAdmin: boolean
  warnedUserIds: string[]
}

export default function LeaderboardSection({ scores, currentUserId, isAdmin, warnedUserIds }: Props) {
  const [expanded, setExpanded] = useState(false)
  const warnedSet = new Set(warnedUserIds)

  if (scores.length === 0) return null

  const displayList = expanded ? scores : scores.slice(0, PREVIEW_COUNT)
  const hasMore = scores.length > PREVIEW_COUNT

  // 表彰台用: 1位・2位・3位
  const top3 = scores.slice(0, 3)

  return (
    <div className="flex flex-col gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
          出席率ランキング
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}
        >
          {scores.length} 名
        </span>
      </div>

      {/* 表彰台（3名以上の場合） */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-2">
          {/* 2位 */}
          <div className="card flex flex-col items-center gap-1.5 py-4" style={{ boxShadow: 'none', border: '1px solid var(--gray-200)' }}>
            <span className="text-xl">🥈</span>
            <p
              className="text-xl font-black"
              style={{ color: getAttendanceRateColor(top3[1].attendance_rate), letterSpacing: '-0.03em' }}
            >
              {top3[1].attendance_rate}%
            </p>
            <p className="text-xs font-semibold text-center leading-tight" style={{ color: 'var(--gray-700)' }}>
              {top3[1].display_name ?? top3[1].full_name}
            </p>
          </div>

          {/* 1位 */}
          <div
            className="card flex flex-col items-center gap-1.5 py-4 relative"
            style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)', boxShadow: 'none' }}
          >
            <Crown size={14} color="#fbbf24" className="absolute top-2 right-2" />
            <span className="text-xl">🥇</span>
            <p className="text-xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              {top3[0].attendance_rate}%
            </p>
            <p className="text-xs font-semibold text-center leading-tight text-white opacity-90">
              {top3[0].display_name ?? top3[0].full_name}
            </p>
          </div>

          {/* 3位 */}
          <div className="card flex flex-col items-center gap-1.5 py-4" style={{ boxShadow: 'none', border: '1px solid var(--gray-200)' }}>
            <span className="text-xl">🥉</span>
            <p
              className="text-xl font-black"
              style={{ color: getAttendanceRateColor(top3[2].attendance_rate), letterSpacing: '-0.03em' }}
            >
              {top3[2].attendance_rate}%
            </p>
            <p className="text-xs font-semibold text-center leading-tight" style={{ color: 'var(--gray-700)' }}>
              {top3[2].display_name ?? top3[2].full_name}
            </p>
          </div>
        </div>
      )}

      {/* 全員リスト */}
      <div className="card" style={{ padding: '0' }}>
        <div className="flex flex-col">
          {displayList.map((s, i) => {
            const isMe = s.id === currentUserId
            const rateColor = getAttendanceRateColor(s.attendance_rate)
            const isLast = i === displayList.length - 1

            return (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom: !isLast ? '1px solid var(--gray-100)' : 'none',
                  background: isMe ? 'var(--club-blue-muted)' : 'transparent',
                }}
              >
                {/* 順位 */}
                <span
                  className="text-sm font-black w-6 text-center shrink-0"
                  style={{ color: i < 3 ? 'var(--club-amber, #f59e0b)' : 'var(--gray-300)' }}
                >
                  {i + 1}
                </span>

                {/* 名前・バー */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                      {s.display_name ?? s.full_name}
                    </span>
                    {isMe && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--club-blue)', color: 'white' }}
                      >
                        自分
                      </span>
                    )}
                    {isAdmin && warnedSet.has(s.id) && (
                      <AlertTriangle size={11} style={{ color: '#c2410c' }} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--gray-200)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.attendance_rate}%`, background: rateColor }}
                      />
                    </div>
                    <span className="text-xs font-bold w-9 text-right shrink-0" style={{ color: rateColor }}>
                      {s.attendance_rate}%
                    </span>
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs" style={{ color: '#16a34a' }}>出席 {s.present_count}</span>
                    <span className="text-xs" style={{ color: '#d97706' }}>遅刻 {s.tardy_count}</span>
                    <span className="text-xs" style={{ color: '#dc2626' }}>欠席 {s.absent_count}</span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--gray-400)' }}>/ {s.total_sessions}回</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 展開ボタン */}
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold cursor-pointer transition-colors"
            style={{
              color: 'var(--club-blue)',
              borderTop: '1px solid var(--gray-100)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--club-blue-muted)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {expanded ? (
              <>
                <ChevronUp size={15} />
                折りたたむ
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                残り {scores.length - PREVIEW_COUNT} 名を表示
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
