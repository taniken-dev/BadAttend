# 改修タスク一覧（2026-09-23 作成・2026-09-26 更新）

BadAttend（バドミントン部の出欠管理アプリ）の改修を、機能ごとに別の Claude Code セッションへ渡すためのタスク指示書です。
各ファイルはそれだけ読めば作業を始められるように書いてあります。

| # | ファイル | 内容 | 規模 | DB変更 | 状態 |
|---|---------|------|------|--------|------|
| 01 | [01_suggestions-jst-and-delete.md](01_suggestions-jst-and-delete.md) | 意見箱の日時をJSTに統一し、管理者に削除機能を付ける | 小 | あり（DELETEポリシー） | ✅ 完了（PR #4、SQL 実行済み） |
| 02 | [02_no-show-penalty.md](02_no-show-penalty.md) | 「出席・遅刻」で登録したのに無連絡で来なかった人（ドタキャン）を処罰する | 中 | 仕様次第 | 未着手（着手できる） |
| 03 | [03_ai-data-query.md](03_ai-data-query.md) | **メイン**：管理者・マネージャーが自然言語で質問すると、LLM が SQL を作って結果を返す機能 | 大 | あり（読み取り専用ロール・ビュー・RPC・ログ） | 未着手 |
| 04 | [04_registration-policy.md](04_registration-policy.md) | 出欠登録ルールの厳格化：締切の DB 強制・当日登録の廃止・未提出者の扱い・2週間ごとの提出（段階導入） | 大 | あり（設定テーブル・登録期間の DB 強制） | ✅ 完了（PR #2、SQL 実行済み。2026-09-30 の練習から適用。フェーズ2は未切り替え） |
| 05 | [05_line-quota.md](05_line-quota.md) | LINE の通数削減（グループ自動通知の見直し・個人への送信の廃止）と使用状況の見える化 | 小〜中 | なし | 未着手 |

完了したタスクの指示書は記録として残してある。書かれている「現状の仕組み」は着手前の状態なので、今のコードとは異なる。

## 実行順と衝突

```
04 ✅ ──→ 02    （04 がマージ済みなので、02 は着手できる）
01 ✅
05 ──────────── （いつでも。未提出者向けの送信は 04 で廃止済み）
03 ──────────── （ほぼ新規ファイルなので並行でよい。最後に 02 のスキーマ変更を反映する）
```

- **02**：04 で `CalendarView.tsx` の登録・実績確定まわりが大きく変わった。02 の指示書の「04 で入ったもの」を読んでから着手する。
- **05**：対象は残った2つの送信（グループへの自動通知 `group-notify`、管理者・幹部向けの `cron/deadlines`）だけ。`vercel.json` の cron は今 `/api/cron/deadlines` だけ。
- **03** は並行で進めてよい。ただし次の 2 点に注意する。
  - `src/components/ui/NavBar.tsx` と `src/lib/types.ts` は他のタスクも触る可能性がある。後からマージする側がコンフリクトを解消すること。
  - 03 は LLM に渡すスキーマ説明を持つ。02 で列やテーブルを追加・変更した場合は、03 の ai ビューとスキーマ説明にも反映する。04 で追加した `registration_policy` の扱いは 03 の指示書を参照。

## コード化しないもの

- **夏季休暇中に出席0回だった人の扱い**：どう処遇するかは部の運用方針の話なので、タスクにしていない。
  - 該当者の抽出は、03 の AI 問い合わせ機能で「8月〜9月に出席0回の人」と聞けばできる（03 の受け入れテストにも含めてある）。
  - 抽出した後の対応（退部処理・注意勧告など）は既存の機能で行える。
  - 「休眠部員」フラグのような専用機能が必要になったら、別タスクとして起こす。
- **退部者をアプリから消す件**：今回は対応しない。なお、現状の「退部処理」は `profiles.is_active = false` にするだけのソフトデリートで（`src/app/api/admin/delete-user/route.ts`）、出欠記録などのデータはすべて残る。

## 全タスク共通のルール

- リポジトリ：`c:\Users\kenta\project\BadAttend`（Next.js 16.2 App Router / React 19 / Supabase / Tailwind v4 / Vercel）
- **Next.js は学習データと異なる破壊的変更がある。** コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読むこと（`AGENTS.md` 参照）。
- **SQL・マイグレーションはこのリポジトリに置かない。** 別リポジトリ `c:\Users\kenta\project\BadAttend-db` のルート直下に `migration_xxx.sql` / `fix_xxx.sql` として作成する。既存のスキーマは同リポジトリの `schema.sql` と各 migration を読んで把握する。本番DBへの適用はユーザーが Supabase SQL Editor で行うので、ファイルの先頭に目的と実行手順をコメントで書く。
- **作業は main から作業ブランチを切って行う**（main へのプッシュは Vercel の本番デプロイになる）。本番への反映は PR → main へのマージ（Create a merge commit）で行う。
  - 例外：ドキュメントだけの変更（Markdown と `docs/` 配下のみ）は、PR を使わず main に直接入れてよい。
- コミットは `/commit`（目的ごとに分けて複数コミット。プッシュしない）、プッシュは `/push`（テスト・ビルド・lint を確認してから作業ブランチをプッシュ）で行う。両方を続けて行う `/commitpush` もある。ユーザーの指示があるまでコミットしない。
- DB の変更には、動作を確かめる SQL（`check_xxx.sql`）も用意する。部員として振る舞う確認は、JWT claims を偽装して `SET LOCAL ROLE authenticated` し、最後にエラーかROLLBACKで必ず取り消す（例：`check_registration_enforcement.sql`、`check_suggestions_delete.sql`）。
- **時刻の扱い：保存は UTC のまま（`timestamptz`）。** JST に変換するのは次の2つだけにする。
  - 画面や LINE の文面に**表示するとき**
  - 「今日は何日か」「何曜日か」「締切を過ぎたか」を**判定するとき**
  - Vercel のサーバーは UTC で動くので、`new Date().getDay()` や `toISOString().split('T')[0]` をそのまま使うと、JST の 0〜9 時に日付がずれる。
  - 使えるヘルパー：
    - 表示：`formatJst(value, options)`（`src/lib/utils.ts`。`timestamptz` の値を JST で整形する。`YYYY-MM-DD` の日付文字列には使わない）
    - 判定：`toJstDateStr(date)`（`src/lib/registration.ts`。JST の今日の日付）、登録期間まわりは同ファイルの `getRegistrationWindow` / `getSessionRegistrationState` / `checkSelfChange`
- UI はすべて日本語。既存ページのスタイル（`card` クラス、`var(--gray-xxx)` などの CSS 変数、lucide-react のアイコン）に合わせる。
- 実装が終わったら `npm test` と `npm run build` が通ることを確認する。
  - `npm test` は `tests/` の `node:test`（登録期間の計算を3タイムゾーンで検証）。ロジックを純粋関数に切り出した場合は、ここにテストを足す。
  - `npm run lint` は変更前からあるエラーで失敗する。変更したファイルに `npx eslint` を実行し、エラーが増えていないことを確かめる。
- README.md の「主な機能」に影響する変更をした場合は、`/readme` スキルで README を更新する。
