import Link from 'next/link'
import { Feather } from 'lucide-react'

export const metadata = {
  title: 'プライバシーポリシー | BadAttend',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-5 py-16" style={{ background: 'var(--apple-bg)' }}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-10">
          <Feather size={22} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
            プライバシーポリシー
          </h1>
        </div>

        <div
          className="flex flex-col gap-8"
          style={{ color: 'var(--ink)', fontSize: '15px', lineHeight: '1.75' }}
        >
          <p style={{ color: 'var(--ink-secondary)' }}>
            谷 謙太郎（以下「運営者」）は、出欠管理サービス「BadAttend」（以下「本サービス」）において、利用者の個人情報を以下の通り取り扱います。
          </p>

          <Section title="1. 収集する情報">
            <p>本サービスでは、以下の情報を収集します。</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
              <li>
                <strong>LINEアカウント情報</strong>：LINE認証を通じて取得するユーザーID・表示名・プロフィール画像
              </li>
              <li>
                <strong>出欠情報</strong>：部活動への出席・欠席の記録（日時・理由を含む）
              </li>
            </ul>
          </Section>

          <Section title="2. 利用目的">
            <p>収集した情報は以下の目的のみに使用します。</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
              <li>ユーザーの本人確認・ログイン処理</li>
              <li>出欠状況の記録・集計・表示</li>
              <li>部活動の運営管理（管理者向け機能）</li>
            </ul>
          </Section>

          <Section title="3. 第三者への提供">
            運営者は、法令に基づく場合を除き、利用者の個人情報を第三者に提供・開示することはありません。
          </Section>

          <Section title="4. 情報の管理">
            <p>収集した情報は Supabase（データベース）に保存し、適切なアクセス制御のもとで管理します。不正アクセス・紛失・改ざんを防ぐため、合理的なセキュリティ対策を実施しています。</p>
          </Section>

          <Section title="5. Cookie・ローカルストレージの使用">
            本サービスは、ログイン状態の維持のためにブラウザのCookieおよびローカルストレージを使用することがあります。これらはサービスの機能提供のみを目的としています。
          </Section>

          <Section title="6. 情報の削除">
            利用者は、退部・卒業等により本サービスの利用を終了する際、運営者に連絡することで個人情報の削除を依頼できます。
          </Section>

          <Section title="7. プライバシーポリシーの変更">
            本ポリシーは必要に応じて変更することがあります。変更後もサービスを利用した場合は、変更後のポリシーに同意したものとみなします。
          </Section>

          <Section title="8. お問い合わせ">
            個人情報の取り扱いに関するご質問・ご要望は以下までご連絡ください。
            <div className="mt-2 p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--hairline)' }}>
              <p>運営者：谷 謙太郎</p>
              <p>
                メール：{' '}
                <a
                  href="mailto:kentaro0626a@gmail.com"
                  style={{ color: 'var(--ink)' }}
                >
                  s24g2079za@chibatech.ac.jp
                </a>
              </p>
            </div>
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
            href="/terms"
            className="text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            ← 利用規約
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
