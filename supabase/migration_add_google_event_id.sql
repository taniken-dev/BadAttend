-- practice_sessions に google_event_id カラムを追加
-- Google カレンダーの「活動日」イベントとの紐付け用
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS google_event_id TEXT UNIQUE;
