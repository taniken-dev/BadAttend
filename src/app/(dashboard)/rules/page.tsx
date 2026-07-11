import { BookOpen, Clock, CalendarCheck, AlertTriangle, CheckCircle2, XCircle, Timer } from 'lucide-react'

export default function RulesPage() {
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

        <div className="flex flex-col gap-3">
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
          <div style={{ height: '1px', background: 'var(--gray-100)' }} />
          <PeriodRow
            period="合宿"
            desc="スケジュールが公開された後いつでも登録できます"
            deadline="制限なし"
          />
        </div>

        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }}>
          期間外は登録できません。提出忘れに注意してください。
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
