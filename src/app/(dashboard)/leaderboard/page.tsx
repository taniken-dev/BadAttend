import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertTriangle, Users, Crown } from 'lucide-react'
import { getAttendanceRateColor } from '@/lib/utils'
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

  const isAdmin = myProfile?.role === 'admin'

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
    { label: '80%以上', min: 80,  max: 101, color: '#16a34a', bg: '#dcfce7' },
    { label: '60〜79%', min: 60,  max: 80,  color: '#4338ca', bg: '#e0e7ff' },
    { label: '40〜59%', min: 40,  max: 60,  color: '#d97706', bg: '#fef3c7' },
    { label: '40%未満', min: 0,   max: 40,  color: '#dc2626', bg: '#fee2e2' },
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
          出席率の高い順に表示しています
        </p>
      </div>

      {/* 出席率帯サマリー */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {bands.map(b => {
          const count = allScores.filter(s =>
            s.attendance_rate >= b.min && s.attendance_rate < b.max
          ).length
          return (
            <div key={b.label}
              className="card flex flex-col gap-1 py-4 text-center"
              style={{ background: b.bg, boxShadow: 'none', border: `1px solid ${b.color}30` }}>
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
                      {member ? (member.display_name ?? member.full_name) : '—'}
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
            <p className="text-2xl font-black"
              style={{ color: getAttendanceRateColor(allScores[1].attendance_rate) }}>
              {allScores[1].attendance_rate}%
            </p>
            <p className="text-xs font-bold text-center leading-tight"
              style={{ color: 'var(--gray-700)' }}>
              {allScores[1].display_name ?? allScores[1].full_name}
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
            <p className="text-2xl font-black text-white">
              {allScores[0].attendance_rate}%
            </p>
            <p className="text-xs font-bold text-center leading-tight text-white">
              {allScores[0].display_name ?? allScores[0].full_name}
            </p>
          </div>
          {/* 3位 */}
          <div className="card flex flex-col items-center gap-2 py-5">
            <span className="text-2xl">🥉</span>
            <p className="text-2xl font-black"
              style={{ color: getAttendanceRateColor(allScores[2].attendance_rate) }}>
              {allScores[2].attendance_rate}%
            </p>
            <p className="text-xs font-bold text-center leading-tight"
              style={{ color: 'var(--gray-700)' }}>
              {allScores[2].display_name ?? allScores[2].full_name}
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
                <div key={s.id}
                  className="flex items-center gap-3 py-3"
                  style={{
                    borderBottom: i < allScores.length - 1 ? '1px solid var(--gray-100)' : 'none',
                    background: isMe ? 'var(--club-blue-muted)' : 'transparent',
                    margin: isMe ? '2px -4px' : undefined,
                    padding: isMe ? '12px 4px' : undefined,
                    borderRadius: isMe ? 'var(--radius)' : undefined,
                  }}>
                  {/* 順位 */}
                  <span className="text-sm font-black w-6 text-center shrink-0"
                    style={{ color: i < 3 ? 'var(--club-amber)' : 'var(--gray-300)' }}>
                    {i + 1}
                  </span>

                  {/* 名前・出席率バー */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                        {s.display_name ?? s.full_name}
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
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
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
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: '#16a34a' }}>
                        出席 {s.present_count}
                      </span>
                      <span className="text-xs" style={{ color: '#d97706' }}>
                        遅刻 {s.tardy_count}
                      </span>
                      <span className="text-xs" style={{ color: '#dc2626' }}>
                        欠席 {s.absent_count}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--gray-400)' }}>
                        / {s.total_sessions}回
                      </span>
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
