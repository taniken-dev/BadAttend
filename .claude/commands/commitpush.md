# /commitpush

変更内容を自動解析してコミットメッセージを生成し、GitHub へコミット・プッシュします。
BadAttend（公開リポジトリ）と BadAttend-db（非公開リポジトリ、SQL/migration専用）の
2つを対象とし、それぞれ変更があれば別々にコミット・プッシュします。

## 手順

### A. BadAttend（このリポジトリ、公開）

1. `git status` でステージ済み・未ステージの変更ファイルを確認する
2. `git diff HEAD` で変更の全差分を確認する
3. `git log --oneline -10` で直近10件のコミット履歴を確認してメッセージスタイルを把握する
4. 以下のルールでコミットメッセージを作成する：
   - プレフィックス: `feat:` / `fix:` / `refactor:` / `style:` / `docs:` のいずれか
   - 1行目: 変更の「目的・理由」を日本語で簡潔に（50文字以内）
   - 本文: 変更の要点を箇条書きで列挙（必要な場合のみ）
   - フッター: 実際に作業している Claude のモデル名で `Co-Authored-By: Claude <モデル名> <noreply@anthropic.com>` を付ける（例: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`）
5. 未ステージのファイルを `git add` する（`.env` 等の機密ファイル、`supabase/` 配下は絶対に除外。`.gitignore`で弾かれるはずだが、念のため`git status`で混入していないか目視確認する）
6. ヒアドキュメント形式でコミットを実行する
7. `git branch --show-current` で現在のブランチ名を取得し、`git push origin <ブランチ名>` でプッシュする

### B. BadAttend-db（`../BadAttend-db`、非公開、SQL専用）

8. `../BadAttend-db` ディレクトリが存在するか確認する
9. 存在すれば、そのディレクトリで `git status` を確認する
10. 変更があれば、Aと同様のコミットメッセージルールでコミットし、`git push origin main` でプッシュする
11. 変更がなければこのステップはスキップする

### C. 完了報告

12. 完了後、リポジトリごとにコミットハッシュとメッセージを1行で報告する（BadAttend-db側に変更がなければ「BadAttend-dbは変更なし」と添える）

## 注意事項

- コミットするものがない場合は「変更なし」と報告してスキップする
- 機密ファイル（`.env`, `*.key`, `*secret*` 等）、および `supabase/` 配下のSQLファイルは絶対にBadAttendへステージしない（SQLはBadAttend-db側のみで管理）
- force push は絶対に行わない（履歴の書き換えが必要な場合はスキル経由で自動実行せず、都度ユーザーに確認する）
- コミット前にユーザーへの確認は不要（スキル発動が承認とみなす）。ただし force push が必要になった場合はこの限りではなく、必ず確認する
