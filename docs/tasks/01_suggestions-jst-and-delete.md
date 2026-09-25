# タスク01：意見箱の日時をJSTに統一し、管理者に削除機能を付ける

> 共通ルール（Next.js ドキュメントの確認、SQL の置き場所、コミット方法）は [README.md](README.md) を参照。

## 背景

- 意見箱の確認画面（`/admin/suggestions`）で、投稿日時が UTC で表示されている（例：日本時間 20:41 の投稿が 11:41 と表示される）。
- 原因：`src/app/(dashboard)/admin/suggestions/page.tsx` は Server Component で、`toLocaleString('ja-JP', {...})` に `timeZone` を指定していない。Vercel のサーバーは UTC で動くため、UTC の時刻がそのまま表示されている。
- あわせて、管理者が不要な投稿（いたずら、対応済みのものなど）を削除できるようにしたい。

## 要件

### ① 日時をJSTに統一する

**JST にするのは表示だけ。** DB の保存形式（`timestamptz`、つまり UTC）と保存の処理は変えない。

1. 意見箱の日時表示を JST（`Asia/Tokyo`）にする。
2. 日時の整形がばらばらなので、共通のヘルパーを `src/lib/utils.ts` に作る（例：`formatJstDateTime(iso, options?)`）。中では必ず `timeZone: 'Asia/Tokyo'` を指定する。
3. アプリ全体で、`timestamptz` の値（`created_at`、`reported_at` など時刻を含む値）を `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` / `getHours()` で表示している箇所を洗い出し、ヘルパーに置き換える。判明している箇所：
   - `src/app/(dashboard)/admin/suggestions/page.tsx:74`（今回の不具合）
   - `src/app/(dashboard)/admin/members/MembersManager.tsx:260`（Client Component なので日本のブラウザでは正しく見えるが、統一のため置き換える）
   - 既に `timeZone: 'Asia/Tokyo'` を指定している `DeadlineSection.tsx` と `cron/deadlines/route.ts` は、ヘルパーに寄せてもよいし、そのままでもよい。
4. **`YYYY-MM-DD` 形式の日付文字列（`session_date` など）の表示は対象外。** `new Date('2026-09-23')` は UTC の 0 時として解釈されるので、そこに `timeZone: 'Asia/Tokyo'` を付けると問題なく表示される。ただし、付け方を誤ると日付が1日ずれる危険がある。置き換える場合は、ずれないことを必ず確認する。

### ② 管理者の削除機能

1. `/admin/suggestions` の各投稿カードに削除ボタン（lucide の `Trash2` など）を付ける。
2. 押すと確認ダイアログを出し、OK なら削除する。削除後は一覧から消し、件数表示も更新する。
3. 削除できるのは `role = 'admin'` のみ。ページ自体が admin 専用なので（`page.tsx:20`）、UI の表示制御はそれに従う。**権限は DB 側（RLS）でも必ず守る。**
4. ページは Server Component のままにし、削除ボタンだけを Client Component に切り出す。削除処理は Server Action かクライアントの Supabase で行う（Next.js 16 の Server Actions の書き方はドキュメントで確認すること）。
5. 物理削除でよい（意見箱は匿名で `user_id` を持たず、ほかのテーブルから参照もされていない）。

### DB（`../BadAttend-db` に作成）

- `migration_suggestions_delete.sql` を作り、DELETE ポリシーを追加する。

  ```sql
  CREATE POLICY "suggestions_delete_admin"
    ON public.suggestions
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
  ```

- 既存のポリシーは `migration_suggestions.sql` と `fix_suggestions_policy.sql` にある。`public.is_admin()` は既存のヘルパー関数。

## やらないこと

- 投稿者を特定できる情報の追加（匿名性を保つ）
- 論理削除やゴミ箱機能

## 完了条件

- [ ] 本番相当の環境（または `TZ=UTC npm run build && TZ=UTC npm start`）で、意見箱の日時が JST で表示される
- [ ] admin で投稿を削除でき、リロードしても消えたままになっている
- [ ] admin 以外のユーザーが Supabase クライアントから直接 `delete` しても、1件も消えない（RLS の確認）
- [ ] `session_date` を使う表示（カレンダー、ダッシュボード、LINE通知の文面）の日付がずれていない
- [ ] `npm run lint` / `npm run build` が通る
- [ ] ユーザーに「`migration_suggestions_delete.sql` を Supabase SQL Editor で実行してください」と伝える
