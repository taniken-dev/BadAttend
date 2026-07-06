-- 時間：09:00〜12:00（15:00） のように括弧書きされた補足時間
-- （強制練習の終了後も体育館を借りていて自主練習できる時間帯など）を保持する
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS time_note TEXT DEFAULT NULL;
