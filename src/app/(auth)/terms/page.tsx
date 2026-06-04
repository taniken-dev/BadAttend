import Link from 'next/link'
import { Feather } from 'lucide-react'

export const metadata = {
  title: '利用規約 | BadAttend',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen px-5 py-16" style={{ background: 'var(--apple-bg)' }}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-10">
          <Feather size={22} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
            利用規約
          </h1>
        </div>

        <div
          className="flex flex-col gap-8"
          style={{ color: 'var(--ink)', fontSize: '15px', lineHeight: '1.75' }}
        >
          <Section title="第1条（本規約について）">
            本規約は、谷 謙太郎（以下「運営者」）が提供する出欠管理サービス「BadAttend」（以下「本サービス」）の利用条件を定めるものです。本サービスを利用した時点で、本規約に同意したものとみなします。
          </Section>

          <Section title="第2条（利用資格）">
            本サービスは、千葉工業大学バドミントン部の部員および運営者が許可した者のみが利用できます。部員でなくなった場合は、速やかに利用を停止してください。
          </Section>

          <Section title="第3条（利用目的）">
            本サービスは、部活動の出欠記録・管理を目的としています。それ以外の目的での利用は禁止します。
          </Section>

          <Section title="第4条（禁止事項）">
            <p>利用者は以下の行為を行ってはなりません。</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
              <li>他の部員になりすますこと</li>
              <li>虚偽の出欠情報を登録すること</li>
              <li>本サービスのシステムに不正アクセスすること</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ul>
          </Section>

          <Section title="第5条（免責事項）">
            <p>運営者は以下について責任を負いません。</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
              <li>本サービスの停止・中断・不具合による損害</li>
              <li>利用者同士のトラブル</li>
              <li>通信環境・端末環境に起因する問題</li>
            </ul>
          </Section>

          <Section title="第6条（サービスの変更・終了）">
            運営者は事前の通知なく本サービスの内容を変更・終了することがあります。これにより生じた損害について運営者は責任を負いません。
          </Section>

          <Section title="第7条（規約の変更）">
            運営者は必要に応じて本規約を変更することがあります。変更後もサービスを利用した場合は、変更後の規約に同意したものとみなします。
          </Section>

          <Section title="第8条（準拠法・管轄）">
            本規約は日本法に準拠します。本サービスに関する紛争は、運営者の所在地を管轄する裁判所を専属的合意管轄裁判所とします。
          </Section>

          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            制定日：2026年6月4日
          </p>
        </div>

        <div className="mt-12 flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            ← ログイン画面に戻る
          </Link>
          <Link
            href="/privacy"
            className="text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            プライバシーポリシー →
          </Link>
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-base font-semibold mb-2"
        style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
      <div style={{ color: 'var(--ink-secondary)' }}>{children}</div>
    </section>
  )
}
