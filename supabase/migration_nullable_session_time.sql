-- 説明文に時間が書かれていないGCalイベント（合宿・部会など）は
-- 実在しない開始・終了時刻をでっち上げず null のまま保存できるようにする
ALTER TABLE practice_sessions ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE practice_sessions ALTER COLUMN start_time DROP DEFAULT;
ALTER TABLE practice_sessions ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE practice_sessions ALTER COLUMN end_time DROP DEFAULT;
