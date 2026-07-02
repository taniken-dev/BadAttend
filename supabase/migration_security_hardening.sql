-- ============================================================
-- セキュリティ強化パッチ
-- Supabase SQL Editor にて実行してください。
--
-- 対応する脆弱性:
--   S1. 部員が自分の出欠レコードの result_status / verified_by を
--       改ざんして「実績確定」を偽装できる
--   S2. 部員が自分の skill_rank / is_active / joined_at / display_name /
--       grade / student_id / lockout_until を書き換えて選考を有利にできる
--   S7. 未承認ユーザーが承認済み部員のプロフィールを全件閲覧できる
--
-- 前提: 以下のヘルパー関数が既存であること
--   public.is_admin(), public.is_manager_or_admin(), public.is_observer()
--
-- 注意: いずれのトリガーも auth.uid() が NULL（= service_role による
--       サーバー側処理）の場合はバイパスする。RLS が service_role を
--       バイパスしても BEFORE トリガーは発火するため、cron やインポート
--       スクリプト等の正規のサーバー処理を壊さないための措置。
--       部員は RLS により必ず auth.uid() = 自分の id でしかアクセス
--       できないため、NULL バイパスが悪用されることはない。
-- ============================================================


-- ============================================================
-- [S2] プロフィールの権限昇格・自己選考操作の防止
-- 既存の prevent_privilege_escalation を拡張し、選考に影響する
-- カラムを非 admin が変更できないようにする
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role（サーバー側処理）はバイパス
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- admin は全カラム変更可
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 以下は非 admin ユーザーによる更新
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role changes require admin privileges';
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION 'Approval changes require admin privileges';
  END IF;
  IF NEW.skill_rank IS DISTINCT FROM OLD.skill_rank THEN
    RAISE EXCEPTION 'skill_rank changes require admin privileges';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'is_active changes require admin privileges';
  END IF;
  IF NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'joined_at changes require admin privileges';
  END IF;
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    RAISE EXCEPTION 'display_name changes require admin privileges';
  END IF;
  IF NEW.grade IS DISTINCT FROM OLD.grade THEN
    RAISE EXCEPTION 'grade changes require admin privileges';
  END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'student_id changes require admin privileges';
  END IF;
  IF NEW.lockout_until IS DISTINCT FROM OLD.lockout_until THEN
    RAISE EXCEPTION 'lockout_until changes require admin privileges';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

REVOKE EXECUTE ON FUNCTION public.prevent_privilege_escalation() FROM public, anon, authenticated;


-- ============================================================
-- [S1] 出欠実績（result_status / verified_by）の改ざん防止
-- 部員が自分のレコードで実績確定を偽装できないようにする。
--   - result_status / verified_by は manager/admin 専用
--   - 例外: 部員自身の「当日欠席（absent_emergency）」自動確定のみ許可
--   - manager が確定済み（verified_by あり）のレコードは部員変更不可
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_attendance_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- service_role / manager / admin はバイパス
  IF auth.uid() IS NULL OR public.is_manager_or_admin() THEN
    RETURN NEW;
  END IF;

  -- 以下は部員本人による INSERT / UPDATE

  -- verified_by は manager/admin 専用
  IF NEW.verified_by IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.verified_by IS DISTINCT FROM OLD.verified_by) THEN
    RAISE EXCEPTION 'verified_by requires manager/admin privileges';
  END IF;

  -- result_status は「当日欠席の自動確定」以外セット不可
  IF NEW.result_status IS NOT NULL
     AND NOT (NEW.result_status = 'absent_emergency' AND NEW.status = 'absent_emergency')
     AND (TG_OP = 'INSERT' OR NEW.result_status IS DISTINCT FROM OLD.result_status) THEN
    RAISE EXCEPTION 'result_status requires manager/admin privileges';
  END IF;

  -- manager が確定済みのレコードは部員による変更禁止
  IF TG_OP = 'UPDATE' AND OLD.verified_by IS NOT NULL THEN
    RAISE EXCEPTION 'this record has been confirmed and is read-only';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_attendance_results ON public.attendance_records;
CREATE TRIGGER protect_attendance_results
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_attendance_results();

REVOKE EXECUTE ON FUNCTION public.protect_attendance_results() FROM public, anon, authenticated;


-- ============================================================
-- [S7] プロフィール閲覧を「承認済みユーザー」に限定
-- 未承認ユーザー（LINE ログイン直後など）が承認済み部員の
-- 氏名・学年・skill_rank 等を全件取得できる穴を塞ぐ。
--   - 承認済みユーザー: 承認済み部員全員 + 自分を閲覧可
--   - 未承認ユーザー:   自分のみ閲覧可
--   - admin / coach:    既存ポリシー（全件）を維持
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_approved = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_user() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;

-- 「is_approved = true なら誰でも閲覧可」だった従来ポリシーを差し替え
DROP POLICY IF EXISTS "profiles_select_approved"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_member_approved" ON public.profiles;

CREATE POLICY "profiles_select_member_approved" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (is_approved = true AND public.is_approved_user())
  );
