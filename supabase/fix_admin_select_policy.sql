-- ============================================================
-- 管理者が未承認ユーザーを閲覧できるポリシーの追加
-- 問題: profiles_select_approved のみだと管理者も他人の未承認
--       プロフィールを SELECT できず、承認待ちリストに出ない
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT
  USING (public.is_admin());
