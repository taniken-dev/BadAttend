<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Supabase SQL / migrations

SQL・マイグレーションファイルはこのリポジトリに置かない。

- 新しいマイグレーション/修正SQLを作成するときは、必ず `../BadAttend-db`（`c:\Users\kenta\project\BadAttend-db`、別リポジトリ）のルート直下に作成する。このリポジトリの `supabase/` 配下には作らない（`.gitignore`で除外済み）。
- `../BadAttend-db` が存在しない場合はユーザーに確認する。
- コミット・プッシュは `/commitpush` スキルが両リポジトリ（BadAttend / BadAttend-db）を自動で処理する。
