-- ============================================================
-- パフォーマンス用インデックス追加（動作は一切変わらない）
-- Supabase SQL Editor にて実行してください。
--
-- PostgreSQL は外部キー列に自動でインデックスを張らないため、
-- データが増える attendance_records で明示的に索引を追加する。
-- ============================================================

-- attendance_records(user_id):
--   個人の出欠履歴取得（ダッシュボードの直近実績）や
--   v_selection_scores の user_id 集計 JOIN で使用。
--   既存の UNIQUE(session_id, user_id) は先頭列が session_id のため
--   user_id 単独の検索には効かない。
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id
  ON public.attendance_records(user_id);

-- ※ その他の未インデックス外部キー（warning_flags.user_id,
--   attendance_records.verified_by など）は
--   Supabase Dashboard → Database → Advisors → Performance の
--   "Unindexed foreign keys" で必要に応じて確認・追加してください。
--   小テーブルは索引の効果が薄いため本ファイルには含めていません。
