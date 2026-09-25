# /push

タスクが終わったときに、テストとビルドを確認してから、作業ブランチを GitHub へプッシュします。
コミットは作りません（先に `/commit`）。BadAttend と BadAttend-db の両方を対象とします。

## 手順

### A. BadAttend（このリポジトリ、公開）

1. `git status` を確認する。コミットされていない変更があれば、プッシュせずに止まり、`/commit` を先に実行するか確認する（未追跡のメモなど、コミットしない前提のファイルだけなら続けてよい）
2. `git branch --show-current` を確認する
   - **main の場合は止まる。** main へのプッシュは Vercel の本番デプロイになるため、作業ブランチを作ってそちらへ移すか、本当に main へ直接プッシュするかをユーザーに確認する
3. プッシュする範囲を確認する：`git log --oneline origin/main..HEAD`（リモートにブランチがあれば `origin/<ブランチ名>..HEAD`）
4. プッシュ前の確認を実行する。失敗したらプッシュせずに報告する
   - `npm test`
   - `npm run build`（`.next/dev/types` に削除済みのルートの古い型が残って失敗する場合は、`.next/dev/types` を消して再実行する）
   - lint: `npm run lint` は既存のエラーで失敗するため、このブランチで変更したファイル（`git diff --name-only origin/main...HEAD`）に `npx eslint` を実行し、既存以外のエラーが増えていないことを確かめる
5. `git push -u origin <ブランチ名>` でプッシュする
6. PR 作成用の URL を案内する：`https://github.com/taniken-dev/BadAttend/compare/main...<ブランチ名>?expand=1`
   - PR の本文の下書き（変更の目的・主な変更・確認したこと・マージ前にやること）も用意して提示する。本文の最後には `🤖 Generated with [Claude Code](https://claude.com/claude-code)` を付ける

### B. BadAttend-db（`../BadAttend-db`、非公開、SQL専用）

7. `../BadAttend-db` で `git status` と `git log --oneline origin/main..HEAD` を確認する
8. 未プッシュのコミットがあれば `git push origin main` でプッシュする（SQL は自動適用されないので main でよい）。なければスキップする

### C. 完了報告

9. リポジトリごとに、プッシュしたブランチとコミット数、確認結果（テスト・ビルド・lint）を報告する
10. 本番反映に必要な残りの作業を添える（PR を作って main へマージする、SQL Editor でマイグレーションを実行する、など）

## 注意事項

- force push は絶対に行わない（履歴の書き換えが必要になったら、自動で実行せずユーザーに確認する）
- main へのマージはこのスキルでは行わない（PR 経由でユーザーが行う）
