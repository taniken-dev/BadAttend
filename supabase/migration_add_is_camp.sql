-- practice_sessions に is_camp カラムを追加
-- 合宿など複数日イベントの各日セッションを識別するフラグ
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS is_camp BOOLEAN NOT NULL DEFAULT FALSE;
