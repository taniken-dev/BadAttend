-- practice_sessions に is_bukai カラムを追加
-- 部会（ミーティング）セッションを識別するフラグ
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS is_bukai BOOLEAN NOT NULL DEFAULT FALSE;
