import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertTriangle, Users, Crown } from 'lucide-react'
import { getRankClass, getSkillRankLabel, getAttendanceRateColor } from '@/lib/utils'
import type { SelectionScore, WarningFlag, Profile } from '@/lib/types'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  const isAdmin = myProfile?.role === 'admin' || myProfile?.role === 'captain'

  const { data: scores } = await supabase
    .from('v_selection_scores')
    .select('*')
    .order('attendance_rate', { ascending: false })

  const allScores = (scores ?? []) as SelectionScore[]

  const { data: warningData } = isAdmin
    ? await supabase.from('warning_flags').select('*').is('resolved_at', null)
    : { data: [] }

  const warnings = (warningData ?? []) as WarningFlag[]
  const warnedUserIds = new Set(warnings.map(w => w.user_id))

  // 出席率帯別の集計
  const bands = [
    { label: '80%以上', min: 80,  color: '#16a34a', bg: '#dcfce7' },
    { label: '60〜79%', min: 60,  color: '#4338ca', bg: '#e0e7ff' },
    { label: '40〜59%', min: 40,  color: '#d97706', bg: '#fef3c7' },
    { label: '40%未満', min: 0,   color: '#dc2626', bg: '#fee2e2' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-black tracking-tight"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}>
          出席率ランキング
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          出席率 × 技術ランクによる選考スコア順
        </p>
      </div>

      {/* 出席率帯サマリー */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {bands.map(b => {
          const count = allScores.filter(s =>
            b.min === 0
              ? s.attendance_rate < 40
              : s.attendance_rate >= b.min && (b.min === 80 || s.attendance_rate < b.min + 20)
          ).length
          return (
            <div key={b.label}
              className="card flex flex-col gap-1 py-4 text-center"
              style={{ background: b.bg, boxShadow: 'none', border: `1px solid ${b.color}20` }}>
              <span className="text-2xl font-black" style={{ color: b.color }}>{count}</span>
              <span className="text-xs font-semibold" style={{ color: b.color }}>{b.label}</span>
            </div>
          )
        })}
      </div>

      {/* 注意勧告（adminのみ） */}
      {isAdmin && warnings.length > 0 && (
        <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: '#c2410c' }} />
            <h2 className="text-sm font-bold" style={{ color: '#c2410c' }}>
              注意勧告対象
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {warnings.map(w => {
              const member = allScores.find(s => s.id === w.user_id)
              return (
                <div key={w.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                      {member?.full_name ?? '—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                      {new Date(w.started_at).toLocaleDateString('ja-JP')}〜
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{ background: '#fee2e2', color: '#b91c1c' }}>
                    {w.severity === 'final_warning' ? '最終警告' : '警告'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* トップ3 */}
      {allScores.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* 2位 */}
          <div className="card flex flex-col items-center gap-2 py-5" style={{ order: 0 }}>
            <span className="text-2xl">🥈</span>
            <div className={`rank-badge ${getRankClass(allScores[1].selection_rank)}`}>
              {allScores[1].selection_rank}
            </div>
            <p className="text-xs font-bold text-center leading-tight"
              style={{ color: 'var(--gray-800)' }}>
              {allScores[1].full_name}
            </p>
            <p className="text-sm font-black"
              style={{ color: getAttendanceRateColor(allScores[1].attendance_rate) }}>
              {allScores[1].attendance_rate}%
            </p>
          </div>
          {/* 1位 */}
          <div className="card flex flex-col items-center gap-2 py-5 relative"
            style={{
              order: -1,
              background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
            }}>
            <Crown size={16} color="#fbbf24" className="absolute top-3 right-3" />
            <span className="text-2xl">🥇</span>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {allScores[0].selection_rank}
            </div>
            <p className="text-xs font-bold text-center leading-tight text-white">
              {allScores[0].full_name}
            </p>
            <p className="text-sm font-black text-white">
              {allScores[0].attendance_rate}%
            </p>
          </div>
          {/* 3位 */}
          <div className="card flex flex-col items-center gap-2 py-5">
            <span className="text-2xl">🥉</span>
            <div className={`rank-badge ${getRankClass(allScores[2].selection_rank)}`}>
              {allScores[2].selection_rank}
            </div>
            <p className="text-xs font-bold text-center leading-tight"
              style={{ color: 'var(--gray-800)' }}>
              {allScores[2].full_name}
            </p>
            <p className="text-sm font-black"
              style={{ color: getAttendanceRateColor(allScores[2].attendance_rate) }}>
              {allScores[2].attendance_rate}%
            </p>
          </div>
        </div>
      )}

      {/* 全員リスト */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold"
            style={{ color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
            全部員
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
            {allScores.length} 名
          </span>
        </div>

        {allScores.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Users size={28} style={{ color: 'var(--gray-300)' }} />
            <p style={{ color: 'var(--gray-500)' }}>データがありません</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {allScores.map((s, i) => {
              const isMe = s.id === user.id
              const rateColor = getAttendanceRateColor(s.attendance_rate)

              return (
                <div key={s.id} className="list-item"
                  style={{
                    background: isMe ? 'var(--club-blue-muted)' : 'transparent',
                    margin: isMe ? '2px -4px' : undefined,
                    padding: isMe ? '14px 4px' : undefined,
                    borderRadius: isMe ? 'var(--radius)' : undefined,
                  }}>
                  {/* 順位 */}
                  <span className="text-sm font-black w-6 text-center shrink-0"
                    style={{ color: i < 3 ? 'var(--club-amber)' : 'var(--gray-400)' }}>
                    {i + 1}
                  </span>

                  {/* ランクバッジ */}
                  <div className={`rank-badge ${getRankClass(s.selection_rank)}`}>
                    {s.selection_rank}
                  </div>

                  {/* 名前・出席率バー */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                        {s.full_name}
                      </span>
                      {isMe && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: 'var(--club-blue)', color: 'white' }}>
                          自分
                        </span>
                      )}
                      {isAdmin && warnedUserIds.has(s.id) && (
                        <AlertTriangle size={12} style={{ color: '#c2410c' }} />
                      )}
                    </div>

                    {/* 出席率バー */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: 'var(--gray-200)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${s.attendance_rate}%`, background: rateColor }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right shrink-0"
                        style={{ color: rateColor }}>
                        {s.attendance_rate}%
                      </span>
                    </div>

                    {/* 出欠内訳 */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: '#16a34a' }}>
                        ●{s.present_count}出席
                      </span>
                      <span className="text-xs" style={{ color: '#d97706' }}>
                        ●{s.tardy_count}遅刻
                      </span>
                      <span className="text-xs" style={{ color: '#dc2626' }}>
                        ●{s.absent_count}欠席
                      </span>
                      {isAdmin && (
                        <span className="text-xs ml-auto" style={{ color: 'var(--gray-400)' }}>
                          {getSkillRankLabel(s.skill_rank)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
