-- 同じ日に複数の練習セッション（例: 部会 + 部活）を持てるようにする。
-- 従来は session_date に unique 制約があり、同日に2つ目のGCalイベントが
-- あっても片方が完全に無視されていた（例: 部会が部活に上書きされて消える）。
-- 出欠は session_id 単位で管理されているため、この制約を外すだけで
-- セッションごとに独立した出欠登録が可能になる。
-- 代わりに GCal 同期の upsert 衝突キーには既存の google_event_id（unique）を使う。
DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT tc.constraint_name INTO cons_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'practice_sessions'
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.column_name = 'session_date';

  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.practice_sessions DROP CONSTRAINT %I', cons_name);
  END IF;
END $$;

-- 日付での絞り込みは引き続き頻繁に行うためインデックスとして残す
CREATE INDEX IF NOT EXISTS idx_practice_sessions_session_date ON public.practice_sessions (session_date);
