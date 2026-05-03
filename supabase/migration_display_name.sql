-- ============================================================
-- display_name カラム追加 + ロール統合 + RLS 強化
-- 変更点:
--   1. profiles に display_name（管理者が設定する本名）を追加
--   2. captain ロールを admin に統合（既存レコードも更新）
--   3. role チェック制約を ('member','admin') のみに変更
--   4. 管理者が他ユーザーのプロフィールを更新できる RLS を追加
--   5. 書き込み系ポリシーを admin のみに統一
--   6. v_selection_scores を display_name 対応で再作成
-- ============================================================

-- ① display_name カラム追加（既存DBに存在しない場合のみ）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- ② captain → admin へ移行
UPDATE public.profiles SET role = 'admin' WHERE role = 'captain';

-- ③ role チェック制約を更新（captain を除外）
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('member', 'admin'));

-- ④ 管理者チェック用 SECURITY DEFINER ヘルパー関数
--    RLS ポリシー内での再帰クエリを防ぐために使用
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ⑤ 管理者が他部員のプロフィールを更新できるポリシーを追加
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ⑥ 練習セッションの書き込みを admin のみに変更
DROP POLICY IF EXISTS "sessions_write_admin" ON public.practice_sessions;
CREATE POLICY "sessions_write_admin" ON public.practice_sessions
  FOR ALL USING (public.is_admin());

-- ⑦ 警告フラグの書き込みを admin のみに変更
DROP POLICY IF EXISTS "warning_write_admin" ON public.warning_flags;
CREATE POLICY "warning_write_admin" ON public.warning_flags
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "warning_select_admin" ON public.warning_flags;
CREATE POLICY "warning_select_admin" ON public.warning_flags
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- ⑧ 出欠記録の管理者閲覧を admin のみに変更
DROP POLICY IF EXISTS "attendance_select_own" ON public.attendance_records;
CREATE POLICY "attendance_select_own" ON public.attendance_records
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- ⑨ v_selection_scores を display_name 対応で再作成
--    ※ attendance_rate の計算も修正済み版（全セッション数を分母に使用）
DROP VIEW IF EXISTS public.v_selection_scores;

CREATE VIEW public.v_selection_scores
  WITH (security_invoker = on)
AS
WITH all_sessions AS (
  SELECT count(*) AS total
  FROM public.practice_sessions
  WHERE session_date <= current_date
    AND is_cancelled = false
),
session_stats AS (
  SELECT
    ar.user_id,
    count(*) FILTER (WHERE ar.status = 'present'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS present_count,
    count(*) FILTER (WHERE ar.status = 'tardy'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS tardy_count,
    count(*) FILTER (WHERE ar.status IN ('absent_normal','absent_emergency','absent_unreported')
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS absent_count,
    count(*) FILTER (WHERE ar.is_emergency = true
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS emergency_count
  FROM public.attendance_records ar
  JOIN public.practice_sessions ps ON ps.id = ar.session_id
  GROUP BY ar.user_id
),
calc AS (
  SELECT
    p.id,
    p.full_name,
    p.display_name,
    p.grade,
    p.gender,
    p.skill_rank,
    (SELECT total FROM all_sessions)        AS total_sessions,
    coalesce(ss.present_count,   0)         AS present_count,
    coalesce(ss.tardy_count,     0)         AS tardy_count,
    coalesce(ss.absent_count,    0)         AS absent_count,
    coalesce(ss.emergency_count, 0)         AS emergency_count,
    CASE
      WHEN (SELECT total FROM all_sessions) = 0 THEN 0.0
      ELSE round(
        (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)::numeric
        / (SELECT total FROM all_sessions) * 100,
        1
      )
    END AS attendance_rate,
    round(
      (p.skill_rank::numeric / 6.0)
      * CASE
          WHEN (SELECT total FROM all_sessions) = 0 THEN 0.0
          ELSE (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)
               / (SELECT total FROM all_sessions)
        END
      * 100, 1
    ) AS selection_score
  FROM public.profiles p
  LEFT JOIN session_stats ss ON ss.user_id = p.id
  WHERE p.is_approved = true
)
SELECT
  *,
  CASE
    WHEN attendance_rate >= 85 THEN 'S'
    WHEN attendance_rate >= 70 THEN 'A'
    WHEN attendance_rate >= 55 THEN 'B'
    WHEN attendance_rate >= 40 THEN 'C'
    WHEN attendance_rate >= 25 THEN 'D'
    ELSE 'E'
  END AS selection_rank
FROM calc
ORDER BY attendance_rate DESC, present_count DESC;
