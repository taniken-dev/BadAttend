import { BookOpen, Clock, CalendarCheck, AlertTriangle, CheckCircle2, XCircle, Timer, UserX, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  LEGACY_POLICY, addDays, formatDateLabel, formatDeadlineLabel, getRegistrationWindow, toJstDateStr,
  type RegistrationPolicy,
} from '@/lib/registration'

export default async function RulesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('registration_policy')
    .select('strict_start_date, biweekly_start')
    .maybeSingle()
  const policy = (data as RegistrationPolicy | null) ?? LEGACY_POLICY

  const now = new Date()
  const today = toJstDateStr(now)
  const strict = !!policy.strict_start_date
  // 2週間ごとの提出は biweekly_start の週の水曜の練習から
  const biweeklyFirst = policy.biweekly_start ? addDays(policy.biweekly_start, 2) : null
  const biweeklyActive = !!biweeklyFirst && today >= biweeklyFirst

  // 次の締切（今後3週間の練習日のうち、締切がまだ来ていない最初のもの）
  let nextDeadline: { closesAt: Date; firstDate: string } | null = null
  if (strict) {
    for (let i = 1; i <= 21 && !nextDeadline; i++) {
      const d = addDays(today, i)
      const w = getRegistrationWindow(d, policy)
      if (w.mode !== 'legacy' && w.closesAt > now) nextDeadline = { closesAt: w.closesAt, firstDate: d }
    }
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--gray-900)' }}>
          出欠ガイド
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          出欠登録のルールと手順
        </p>
      </div>

      {/* 登録期間 */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#e7f3f8', color: '#337ea9' }}>
            <Clock size={18} />
          </span>
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>登録できる期間</h2>
        </div>

        {strict && policy.strict_start_date! > today && (
          <Notice>{formatDateLabel(policy.strict_start_date!)}の練習から、このルールが適用されます。</Notice>
        )}
        {biweeklyFirst && !biweeklyActive && (
          <Notice>{formatDateLabel(biweeklyFirst)}の練習から、2週間分をまとめて提出する方式に変わります。</Notice>
        )}

        <div className="flex flex-col gap-3">
          {!strict ? (
            <>
              <PeriodRow
                period="土〜火曜日"
                desc="同じ週の水・木・金曜の練習を登録できます"
                deadline="火曜 23:59 まで"
              />
              <div style={{ height: '1px', background: 'var(--gray-100)' }} />
              <PeriodRow
                period="水・木・金曜日（当日）"
                desc="当日分のみ登録できます"
                deadline="その日の深夜 0:00 まで"
              />
            </>
          ) : biweeklyActive ? (
            <PeriodRow
              period="2週間ごとの土〜火曜日"
              desc="その後2週間分（水・木・金 × 2週）の練習をまとめて登録できます"
              deadline="火曜 23:59 まで"
            />
          ) : (
            <PeriodRow
              period="土〜火曜日"
              desc="その後の水・木・金曜（翌週火曜まで）の練習を登録できます"
              deadline="火曜 23:59 まで"
            />
          )}
          {strict && (
            <>
              <div style={{ height: '1px', background: 'var(--gray-100)' }} />
              <PeriodRow
                period="締切後〜練習当日"
                desc="登録済みの人だけ、出席→遅刻・欠席、遅刻→欠席への変更ができます（欠席から出席・遅刻には戻せません）"
                deadline="練習当日 23:59 まで"
              />
            </>
          )}
          <div style={{ height: '1px', background: 'var(--gray-100)' }} />
          <PeriodRow
            period="合宿・部会"
            desc="スケジュールが公開された後いつでも登録できます"
            deadline="制限なし"
          />
        </div>

        {nextDeadline && (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#e7f3f8', color: '#2d6d92' }}>
            次の締切：{formatDeadlineLabel(nextDeadline.closesAt)}（{formatDateLabel(nextDeadline.firstDate)}からの練習）
          </div>
        )}

        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }}>
          {strict
            ? '締切後・練習当日の新規登録はできません。締切までに提出しなかった人は練習に参加できず、無連絡欠席として記録されます。'
            : '期間外は登録できません。提出忘れに注意してください。'}
        </div>
      </section>

      {/* ステータスの種類 */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#edf3ec', color: '#448361' }}>
            <CalendarCheck size={18} />
          </span>
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>ステータスの種類</h2>
        </div>

        <div className="flex flex-col gap-2">
          <StatusRow
            icon={<CheckCircle2 size={15} />}
            color="#448361"
            bg="#dbeddb"
            label="出席"
            desc="練習に参加する"
          />
          <StatusRow
            icon={<Timer size={15} />}
            color="#cb912f"
            bg="#fdecc8"
            label="遅刻"
            desc="遅れて参加する。参加予定時刻を30分刻みで選択"
          />
          <StatusRow
            icon={<XCircle size={15} />}
            color="#d44c47"
            bg="#ffe2dd"
            label="欠席"
            desc="練習を休む。理由の入力が必要"
          />
          <StatusRow
            icon={<AlertTriangle size={15} />}
            color="#9065b0"
            bg="#e8deee"
            label="当日欠席"
            desc="当日に欠席を報告した場合に自動で適用される。LINEグループに通知が送られる"
          />
          {strict && (
            <StatusRow
              icon={<UserX size={15} />}
              color="#64748b"
              bg="#f1f5f9"
              label="無連絡欠席"
              desc="締切までに出欠を提出しなかった場合。実績の確定時に自動で記録される"
            />
          )}
        </div>
      </section>

      {/* 理由の種類 */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#f9f2f7', color: '#c14c8a' }}>
            <BookOpen size={18} />
          </span>
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>欠席・遅刻の理由</h2>
        </div>

        <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--gray-700)' }}>
          {[
            ['別練習・大会', '他の試合や練習参加'],
            ['授業', '講義・実験など'],
            ['体調不良', '病気・怪我など。次回練習までロックがかかる場合あり'],
            ['私用', '家庭の事情など'],
            ['その他', '上記に当てはまらない場合。詳細の入力が必要'],
          ].map(([label, desc]) => (
            <div key={label} className="flex gap-2">
              <span className="shrink-0 font-semibold w-28" style={{ color: 'var(--gray-900)' }}>{label}</span>
              <span style={{ color: 'var(--gray-500)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 当日欠席・遅刻の注意 */}
      <section className="card p-5 flex flex-col gap-3"
        style={{ border: '1.5px solid #e5a49e', background: '#fdebec' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#ffe2dd', color: '#d44c47' }}>
            <AlertTriangle size={18} />
          </span>
          <h2 className="text-base font-bold" style={{ color: '#d44c47' }}>当日の連絡について</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm" style={{ color: '#6d302c' }}>
          {strict && (
            <li className="flex gap-2"><span>・</span><span>当日は新規登録できませんが、登録済みの人は欠席・遅刻への変更ができます（急な体調不良なども必ず連絡してください）</span></li>
          )}
          <li className="flex gap-2"><span>・</span><span>当日に欠席を登録すると「当日欠席」として記録され、LINEグループに自動通知されます</span></li>
          <li className="flex gap-2"><span>・</span><span>当日に遅刻を登録した場合も同様にLINEグループへ通知されます</span></li>
          <li className="flex gap-2"><span>・</span><span>体調不良の欠席は、次の練習への登録がロックされる場合があります</span></li>
        </ul>
      </section>

      {/* 手順 */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#e7f3f8', color: '#337ea9' }}>
            <CalendarCheck size={18} />
          </span>
          <h2 className="text-base font-bold" style={{ color: 'var(--gray-900)' }}>登録の手順</h2>
        </div>
        <ol className="flex flex-col gap-3 text-sm" style={{ color: 'var(--gray-700)' }}>
          {[
            'カレンダー画面を開く',
            '対象の練習日をタップする',
            'ステータス（出席・遅刻・欠席）を選ぶ',
            '欠席・遅刻の場合は理由を選択し、必要に応じて詳細を入力する',
            '「登録する」ボタンを押して完了',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ background: '#e7f3f8', color: '#337ea9' }}
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function PeriodRow({ period, desc, deadline }: { period: string; desc: string; deadline: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>{period}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: '#e7f3f8', color: '#337ea9', whiteSpace: 'nowrap' }}>
          {deadline}
        </span>
      </div>
      <span className="text-xs" style={{ color: 'var(--gray-500)' }}>{desc}</span>
    </div>
  )
}

function StatusRow({ icon, color, bg, label, desc }: {
  icon: React.ReactNode; color: string; bg: string; label: string; desc: string
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: bg, color }}>
        {icon}
      </span>
      <div>
        <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>{label}</span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>{desc}</p>
      </div>
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
      style={{ background: '#fdecc8', color: '#6e4a1a', border: '1px solid #e3c47f' }}>
      <Info size={15} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}
