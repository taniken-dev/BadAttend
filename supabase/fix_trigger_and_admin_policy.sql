-- ============================================================
-- トリガー修正 + 管理者RLSポリシー修正
-- 問題:
--   1. handle_new_user が total_points カラムを参照していたため
--      LINE ログイン時にプロフィールが作成されず孤立ユーザーが発生
--   2. profiles_select_admin が自己参照再帰を起こし
--      プロフィールSELECT全体がエラーになり管理者もログイン不能に
-- ============================================================

-- ① handle_new_user トリガーを最新版に更新（total_points不要版）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, avatar_url, grade, role, skill_rank, is_approved
  ) VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    COALESCE((new.raw_user_meta_data->>'grade')::int, 1),
    'member',
    3,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- ② is_admin() ヘルパー関数（SECURITY DEFINERで再帰しない）
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

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ③ 再帰しない正しい管理者SELECTポリシー
--    （再帰版は DROP して is_admin() を使う版に差し替え）
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT
  USING (public.is_admin());
