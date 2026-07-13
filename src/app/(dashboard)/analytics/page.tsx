import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowDown, ArrowUp, Minus, Info, TrendingUp } from 'lucide-react'
import { getSessionUser, getMyProfile } from '@/lib/supabase/session'
import type { MonthlyKpi } from '@/lib/types'
import TrendChart, { type TrendPoint } from './TrendChart'

/** '2026-05-01' → '26/5' */
function shortLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y.slice(2)}/${Number(m)}`
}

/** '2026-05-01' → '5月' */
function monthOnly(month: string): string {
  return `${Number(month.split('-')[1])}月`
}

/** '2026-05-01' → '2026年5月' */
function fullLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

const fmt = (v: number | null) => (v === null ? '—' : `${v}%`)

/**
 * KPIカード。増減は「色だけ」で意味を伝えず、必ず矢印アイコンと文言を添える。
 * lowerIsBetter = 下がったら良い指標（締切後連絡率・無連絡欠席率）
 */
function KpiCard({
  title, note, current, previous, lowerIsBetter,
}: {
  title: string
  note: string
  current: number | null
  previous: number | null
  lowerIsBetter: boolean
}) {
  const delta =
    current !== null && previous !== null
      ? Math.round((current - previous) * 10) / 10
      : null

  const improved =
    delta === null || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0

  const color =
    improved === null
      ? 'var(--gray-500)'
      : improved
        ? 'var(--kpi-good)'
        : 'var(--kpi-critical)'

  const Arrow = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown

  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs font-semibold" style={{ color: 'var(--gray-500)' }}>
        {title}
      </p>
      <p
        className="text-2xl font-black leading-none"
        style={{ color: 'var(--gray-900)', letterSpacing: '-0.03em' }}
      >
        {fmt(current)}
      </p>
      {delta !== null && (
        <p className="flex items-center gap-1 text-xs font-semibold" style={{ color }}>
          <Arrow size={12} strokeWidth={3} />
          {delta === 0
            ? '前月と同じ'
            : `前月比 ${delta > 0 ? '+' : ''}${delta}pt・${improved ? '改善' : '悪化'}`}
        </p>
      )}
      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--gray-500)' }}>
        {note}
      </p>
    </div>
  )
}

function ChartCard({
  title, subtitle, points, ariaLabel,
}: {
  title: string
  subtitle: string
  points: TrendPoint[]
  ariaLabel: string
}) {
  return (
    <div className="card flex flex-col gap-2">
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>{subtitle}</p>
      </div>
      <TrendChart points={points} ariaLabel={ariaLabel} />
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const myProfile = await getMyProfile()
  if (!myProfile || myProfile.role !== 'admin') redirect('/dashboard')

  const { data } = await supabase
    .from('v_monthly_kpi')
    .select('*')
    .order('month', { ascending: true })

  const rows = (data ?? []) as MonthlyKpi[]

  // アプリ期（2026-05〜）= 部員が自分で出欠を登録している期間。効果測定はここだけで行う
  const appRows = rows.filter(r => r.era === 'app' && r.has_data)
  const latest = appRows.at(-1) ?? null
  const prev   = appRows.at(-2) ?? null

  // 出席率は全期間で描けるが、Excel期は母集団が違うので muted（参考値）にする
  const attendancePoints: TrendPoint[] = rows.map(r => ({
    label: shortLabel(r.month),
    value: r.has_data ? r.attendance_rate : null,
    note: !r.has_data
      ? '実績未確定のためデータなし'
      : r.confirmed_ratio !== null && r.confirmed_ratio < 60
        ? `確定率 ${r.confirmed_ratio}% のため参考値`
        : r.era === 'excel'
          ? 'Excel期・参考値'
          : undefined,
    muted: r.era === 'excel',
  }))

  const appPoints = (key: 'late_report_rate' | 'unreported_rate' | 'submission_rate'): TrendPoint[] =>
    rows
      .filter(r => r.era === 'app')
      .map(r => ({
        label: monthOnly(r.month),
        value: r.has_data ? r[key] : null,
        note: r.has_data ? undefined : '実績未確定のためデータなし',
      }))

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up">
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}
        >
          運用KPI
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          アプリ導入後の出欠連絡の質を月次で追跡します（管理者のみ）
        </p>
      </div>

      {/* 読み方の注意（消さないこと。この画面の数字は誤読しやすい） */}
      <div
        className="card flex items-start gap-3 animate-slide-up"
        style={{ background: 'var(--club-blue-muted)' }}
      >
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--club-blue)' }} />
        <div className="text-xs leading-relaxed" style={{ color: 'var(--gray-700)' }}>
          <p className="font-bold mb-1" style={{ color: 'var(--gray-900)' }}>
            Excel期とアプリ期は直接比較できません
          </p>
          <p>
            母集団（27名→77名）・欠席の定義・記録される項目がすべて異なるためです。
            遅刻・当日欠席・無連絡欠席・連絡時刻は Excel 期には存在しない項目なので、
            0% ではなく「—」と表示しています。
            効果測定は<strong>アプリ期（2026年5月〜）の中だけ</strong>で行ってください。
          </p>
        </div>
      </div>

      {/* アプリ期の最新KPI */}
      {latest ? (
        <>
          <div className="animate-slide-up">
            <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--gray-900)' }}>
              最新月: {fullLabel(latest.month)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard
                title="締切後連絡率"
                note="欠席連絡のうち、締切（火23:59）を過ぎてから出されたもの。低いほど良い"
                current={latest.late_report_rate}
                previous={prev?.late_report_rate ?? null}
                lowerIsBetter
              />
              <KpiCard
                title="無連絡欠席率"
                note="出欠を出さないまま欠席した割合。低いほど良い"
                current={latest.unreported_rate}
                previous={prev?.unreported_rate ?? null}
                lowerIsBetter
              />
              <KpiCard
                title="提出率"
                note="締切までに出欠を提出した割合。高いほど良い"
                current={latest.submission_rate}
                previous={prev?.submission_rate ?? null}
                lowerIsBetter={false}
              />
            </div>
          </div>

          {/* アプリ期の推移（3つを別チャートに分ける。1つの軸に混ぜない） */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-slide-up">
            <ChartCard
              title="締切後連絡率"
              subtitle="主要指標・低いほど良い"
              points={appPoints('late_report_rate')}
              ariaLabel="締切後連絡率の月次推移"
            />
            <ChartCard
              title="無連絡欠席率"
              subtitle="低いほど良い"
              points={appPoints('unreported_rate')}
              ariaLabel="無連絡欠席率の月次推移"
            />
            <ChartCard
              title="提出率"
              subtitle="高いほど良い"
              points={appPoints('submission_rate')}
              ariaLabel="提出率の月次推移"
            />
          </div>
        </>
      ) : (
        <div className="card text-center py-10 animate-slide-up">
          <TrendingUp size={28} className="mx-auto mb-2" style={{ color: 'var(--gray-300)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--gray-500)' }}>
            アプリ期の確定済み実績がまだありません
          </p>
        </div>
      )}

      {/* 出席率（全期間・参考） */}
      <div className="animate-slide-up">
        <ChartCard
          title="出席率（全期間・参考値）"
          subtitle="グレー＝Excel期。母集団が異なるため、アプリ期との比較には使えません"
          points={attendancePoints}
          ariaLabel="出席率の月次推移（Excel期を含む）"
        />
      </div>

      {/* 月次テーブル（データなしを明示するための正本） */}
      <div className="card animate-slide-up overflow-x-auto">
        <p className="text-sm font-bold mb-3" style={{ color: 'var(--gray-900)' }}>
          月次データ
        </p>
        <table
          className="w-full text-xs"
          style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}
        >
          <thead>
            <tr style={{ color: 'var(--gray-500)' }}>
              <th className="text-left  font-semibold py-2 pr-3 whitespace-nowrap">月</th>
              <th className="text-left  font-semibold py-2 pr-3 whitespace-nowrap">期</th>
              <th className="text-right font-semibold py-2 pr-3 whitespace-nowrap">確定/全</th>
              <th className="text-right font-semibold py-2 pr-3 whitespace-nowrap">記録</th>
              <th className="text-right font-semibold py-2 pr-3 whitespace-nowrap">出席率</th>
              <th className="text-right font-semibold py-2 pr-3 whitespace-nowrap">提出率</th>
              <th className="text-right font-semibold py-2 pr-3 whitespace-nowrap">無連絡</th>
              <th className="text-right font-semibold py-2      whitespace-nowrap">締切後</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const noData = !r.has_data
              return (
                <tr
                  key={r.month}
                  style={{
                    borderTop: '1px solid var(--gray-100)',
                    color: noData ? 'var(--gray-400)' : 'var(--gray-700)',
                  }}
                >
                  <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                    {fullLabel(r.month)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.era === 'excel' ? 'Excel' : r.era === 'transition' ? '移行' : 'アプリ'}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {r.sessions_confirmed}/{r.sessions_total}
                  </td>
                  <td className="py-2 pr-3 text-right">{r.records || '—'}</td>
                  <td className="py-2 pr-3 text-right">
                    {noData ? 'データなし' : fmt(r.attendance_rate)}
                  </td>
                  <td className="py-2 pr-3 text-right">{noData ? '—' : fmt(r.submission_rate)}</td>
                  <td className="py-2 pr-3 text-right">{noData ? '—' : fmt(r.unreported_rate)}</td>
                  <td className="py-2      text-right">{noData ? '—' : fmt(r.late_report_rate)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--gray-500)' }}>
          「確定/全」が小さい月は実績確定が進んでいないため、数字が出ていても信用できません。
          締切後連絡率は水・木・金の練習のみを対象にしています（それ以外の曜日は締切を定義できないため除外）。
        </p>
      </div>
    </div>
  )
}
