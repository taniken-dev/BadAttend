-- ============================================================
-- coach（顧問）ロール追加 マイグレーション
-- ============================================================

-- 1. role CHECK 制約を更新（coach を追加）
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'captain', 'admin', 'coach'));

-- 2. is_observer() ヘルパー関数（coach かどうかを判定）
CREATE OR REPLACE FUNCTION public.is_observer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'coach'
  );
$$;

-- 3. coach 向け RLS SELECT ポリシー
-- profiles: coach は全部員を閲覧可能
CREATE POLICY "profiles_select_coach"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_observer());

-- attendance_records: coach は全記録を閲覧可能
CREATE POLICY "attendance_select_coach"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (public.is_observer());

-- practice_sessions: coach はセッションを閲覧可能
CREATE POLICY "sessions_select_coach"
  ON public.practice_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_observer());

-- warning_flags が存在する場合のみ適用
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'warning_flags'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "warning_flags_select_coach"
        ON public.warning_flags
        FOR SELECT
        TO authenticated
        USING (public.is_observer())
    $policy$;
  END IF;
END;
$$;
