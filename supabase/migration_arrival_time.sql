-- 遅刻の「参加予定時刻」カラムを追加
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS arrival_time time;

-- 既存データのマイグレーション（授業限 → arrival_time）
-- 「8限（〜17:00）」パターン → 17:00
UPDATE public.attendance_records
SET arrival_time = '17:00:00'
WHERE status = 'tardy'
  AND reason_detail LIKE '%17:00%'
  AND arrival_time IS NULL;

-- 「9限（〜18:00）」パターン → 18:00
UPDATE public.attendance_records
SET arrival_time = '18:00:00'
WHERE status = 'tardy'
  AND reason_detail LIKE '%18:00%'
  AND arrival_time IS NULL;

-- 「10限（〜19:00）」パターン → 19:00
UPDATE public.attendance_records
SET arrival_time = '19:00:00'
WHERE status = 'tardy'
  AND reason_detail LIKE '%19:00%'
  AND arrival_time IS NULL;
