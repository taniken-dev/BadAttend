import type { CSSProperties } from 'react'

export interface TrendPoint {
  /** X軸ラベル（例: '5月'） */
  label: string
  /** 値。null = データなし（0 ではない）。線はここで途切れる */
  value: number | null
  /** ツールチップに出す補足（例: '実績未確定'） */
  note?: string
  /** 参考値扱い（Excel期など）。グレーで描き、比較対象でないことを示す */
  muted?: boolean
}

const W = 340
const H = 132
const PAD = { top: 10, right: 14, bottom: 22, left: 30 }

const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

/** 値の最大から、0基線を保ったままキリのよい上限を決める */
function niceMax(values: number[]): number {
  const max = Math.max(...values, 1)
  if (max > 80) return 100
  return Math.min(100, Math.ceil((max * 1.25) / 10) * 10)
}

/**
 * 単系列の折れ線チャート（インラインSVG・依存ライブラリなし）
 *
 * - 常に 0 を基線にする（軸を切り詰めて変化を誇張しない）
 * - null の月は線を切る。0 として繋がない
 * - 単系列なので凡例は置かない（タイトルが系列名を兼ねる）
 */
export default function TrendChart({
  points,
  ariaLabel,
}: {
  points: TrendPoint[]
  ariaLabel: string
}) {
  const values = points.filter(p => p.value !== null).map(p => p.value as number)
  if (values.length === 0) {
    return (
      <p className="text-xs py-8 text-center" style={{ color: 'var(--gray-500)' }}>
        表示できるデータがまだありません
      </p>
    )
  }

  const yMax = niceMax(values)
  const n = points.length

  const x = (i: number) => PAD.left + (n === 1 ? PLOT_W / 2 : (PLOT_W * i) / (n - 1))
  const y = (v: number) => PAD.top + PLOT_H - (PLOT_H * v) / yMax

  // null で区切って連続区間に分割する（データなしの月で線を途切れさせる）
  const segments: { i: number; v: number; muted: boolean }[][] = []
  let cur: { i: number; v: number; muted: boolean }[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length) segments.push(cur)
      cur = []
    } else {
      cur.push({ i, v: p.value, muted: !!p.muted })
    }
  })
  if (cur.length) segments.push(cur)

  const gridValues = [0, yMax / 2, yMax]

  // X軸ラベルは詰まると読めないので、点が多いときは間引く
  const labelStep = n > 9 ? 2 : 1

  const axisStyle: CSSProperties = { fill: 'var(--gray-500)', fontSize: '8px' }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="auto"
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* グリッド（控えめに） */}
      {gridValues.map(gv => (
        <g key={gv}>
          <line
            x1={PAD.left} x2={W - PAD.right} y1={y(gv)} y2={y(gv)}
            stroke="var(--gray-200)" strokeWidth={1}
          />
          <text x={PAD.left - 6} y={y(gv) + 3} textAnchor="end" style={axisStyle}>
            {Math.round(gv)}
          </text>
        </g>
      ))}

      {/* X軸ラベル */}
      {points.map((p, i) =>
        i % labelStep === 0 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" style={axisStyle}>
            {p.label}
          </text>
        ) : null
      )}

      {/* 折れ線（区間ごと。muted な区間はグレー＝参考値） */}
      {segments.map((seg, si) => {
        if (seg.length < 2) return null
        const mutedSeg = seg.every(s => s.muted)
        return (
          <polyline
            key={si}
            points={seg.map(s => `${x(s.i)},${y(s.v)}`).join(' ')}
            fill="none"
            stroke={mutedSeg ? 'var(--gray-400)' : 'var(--club-blue)'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}

      {/* データ点（ホバーでツールチップ） */}
      {points.map((p, i) => {
        if (p.value === null) return null
        const color = p.muted ? 'var(--gray-400)' : 'var(--club-blue)'
        return (
          <circle
            key={i}
            cx={x(i)} cy={y(p.value)} r={4}
            fill={color}
            stroke="var(--card-bg)"
            strokeWidth={2}
          >
            <title>
              {p.label}: {p.value}%{p.note ? `（${p.note}）` : ''}
            </title>
          </circle>
        )
      })}

      {/* 最終点だけ直接ラベル（全点に数字を振らない） */}
      {(() => {
        const last = [...points].reverse().find(p => p.value !== null)
        if (!last) return null
        const li = points.lastIndexOf(last)
        const lv = last.value as number
        const anchor = li > n - 2 ? 'end' : 'middle'
        return (
          <text
            x={x(li)} y={y(lv) - 9}
            textAnchor={anchor}
            style={{ fill: 'var(--gray-900)', fontSize: '10px', fontWeight: 700 }}
          >
            {lv}%
          </text>
        )
      })()}
    </svg>
  )
}
