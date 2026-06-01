-- ============================================================
-- [SECURITY FIX] is_admin_or_captain() の再定義
-- マイグレーションファイルに定義が存在せず、
-- SET search_path = '' が付与されていない可能性があるため再作成する
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_captain()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'captain')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_captain() FROM public;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_captain() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin_or_captain() TO authenticated;
