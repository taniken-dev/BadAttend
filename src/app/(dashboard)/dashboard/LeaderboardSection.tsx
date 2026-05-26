'use client'

import { useState } from 'react'
import { Crown, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { getAttendanceRateColor } from '@/lib/utils'
import type { SelectionScore } from '@/lib/types'

const PREVIEW_COUNT = 5
const MIN_SESSIONS_FOR_OVERALL = 6

type Tab = 'all' | 1 | 2 | 3 | 4

interface Props {
  scores: SelectionScore[]
  currentUserId: string
  isAdmin: boolean
  warnedUserIds: string[]
}

export default function LeaderboardSection({ scores, currentUserId, isAdmin, warnedUserIds }: Props) {
  const [tab, setTab]           = useState<Tab>('all')
  const [expanded, setExpanded] = useState(false)
  const warnedSet = new Set(warnedUserIds)

  if (scores.length === 0) return null

  // タブに応じたリストを作成
  const filteredScores: SelectionScore[] = tab === 'all'
    ? scores.filter(s => s.total_sessions >= MIN_SESSIONS_FOR_OVERALL)
    : scores.filter(s => s.grade === tab)

  const displayList = expanded ? filteredScores : filteredScores.slice(0, PREVIEW_COUNT)
  const hasMore     = filteredScores.length > PREVIEW_COUNT
  const top3        = filteredScores.slice(0, 3)

  // 存在する学年のみタブに表示
  const existingGrades = ([1, 2, 3, 4] as const).filter(g => scores.some(s => s.grade === g))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: '全体' },
    ...existingGrades.map(g => ({ key: g as Tab, label: `${g}年` })),
  ]

  function handleTabChange(t: Tab) {
    setTab(t)
    setExpanded(false)
  }

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
          {filteredScores.length} 名
        </span>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--gray-100)' }}>
        {tabs.map(t => (
          <button
            key={String(t.key)}
            onClick={() => handleTabChange(t.key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={tab === t.key
              ? { background: 'var(--card-bg)', color: 'var(--club-blue)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--gray-500)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 全体タブの注記 */}
      {tab === 'all' && (
        <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
          ※ {MIN_SESSIONS_FOR_OVERALL}回未満は非表示（学年タブで確認できます）
        </p>
      )}

      {filteredScores.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-8">
          <p className="text-sm font-semibold" style={{ color: 'var(--gray-500)' }}>
            {tab === 'all' ? `${MIN_SESSIONS_FOR_OVERALL}回以上の部員がいません` : 'この学年の部員がいません'}
          </p>
        </div>
      ) : (
        <>
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
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="flex flex-col">
              {displayList.map((s, i) => {
                const isMe      = s.id === currentUserId
                const rateColor = getAttendanceRateColor(s.attendance_rate)
                const isLast    = i === displayList.length - 1

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
                        {tab === 'all' && (
                          <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
                            {s.grade}年
                          </span>
                        )}
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
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: '#16a34a' }}>出席 {s.present_count}</span>
                        <span className="text-xs" style={{ color: '#d97706' }}>遅刻 {s.tardy_count}</span>
                        <span className="text-xs" style={{ color: '#dc2626' }}>
                          欠席 {s.absent_count}
                          {s.emergency_count > 0 && (
                            <span style={{ color: '#9333ea' }}>（当日{s.emergency_count}）</span>
                          )}
                        </span>
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
                style={{ color: 'var(--club-blue)', borderTop: '1px solid var(--gray-100)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--club-blue-muted)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {expanded ? (
                  <><ChevronUp size={15} />折りたたむ</>
                ) : (
                  <><ChevronDown size={15} />残り {filteredScores.length - PREVIEW_COUNT} 名を表示</>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
