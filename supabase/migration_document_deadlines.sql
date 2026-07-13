-- ============================================================
-- 体育会 提出書類締切機能 マイグレーション
--  ① profiles に幹部フラグ is_executive を追加
--  ② 権限昇格防止トリガーを拡張（is_executive も admin のみ変更可）
--  ③ is_admin_or_executive() ヘルパー関数
--  ④ document_deadlines テーブル（締切一覧＋提出チェック）
--  ⑤ 提出チェック以外のカラム改変を防ぐトリガー
--  ⑥ deadline_scrape_status テーブル（取得状況の記録）
-- Supabase SQL Editor にて実行してください。
-- ============================================================

-- ① 幹部フラグ（4ロールは固定のまま、直交するフラグとして追加）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_executive boolean NOT NULL DEFAULT false;

-- ② 既存の権限昇格防止トリガー関数を拡張
--    （fix_role_escalation.sql の関数を is_executive 保護付きで置き換え）
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 呼び出し元が admin かどうか確認
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    -- admin は全カラム変更可
    RETURN NEW;
  END IF;

  -- 非 admin が role を変更しようとした場合は拒否
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role changes require admin privileges';
  END IF;

  -- 非 admin が is_approved を変更しようとした場合は拒否
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION 'Approval changes require admin privileges';
  END IF;

  -- 非 admin が is_executive（幹部フラグ）を変更しようとした場合は拒否
  IF NEW.is_executive IS DISTINCT FROM OLD.is_executive THEN
    RAISE EXCEPTION 'Executive flag changes require admin privileges';
  END IF;

  RETURN NEW;
END;
$$;

-- トリガー本体は fix_role_escalation.sql で作成済み（関数置換のみで反映される）
-- 未適用環境向けに念のため再作成
DROP TRIGGER IF EXISTS prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

REVOKE EXECUTE ON FUNCTION public.prevent_privilege_escalation() FROM public;
REVOKE EXECUTE ON FUNCTION public.prevent_privilege_escalation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_privilege_escalation() FROM authenticated;

-- ③ 管理者または幹部かを判定するヘルパー（RLS から再帰なしで使う）
CREATE OR REPLACE FUNCTION public.is_admin_or_executive()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR is_executive = true)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_executive() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin_or_executive() TO authenticated;

-- ④ 提出書類締切テーブル
--    行の作成・削除は cron（service role）のみ。
--    source_key（締切日時＋書類名）を自然キーとして upsert するため、
--    再取得しても提出チェック（submitted_*）は保持される。
CREATE TABLE IF NOT EXISTS public.document_deadlines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key    text UNIQUE NOT NULL,          -- '2026-07-16T18:00+09:00|8月分【施設使用願】最終提出締切'
  deadline_at   timestamptz NOT NULL,          -- 締切日時（JST の時刻まで保持）
  document_name text NOT NULL,                 -- 書類名（サイトの箇条書きそのまま）
  is_active     boolean NOT NULL DEFAULT true, -- サイトから消えたら false（履歴として保持）
  submitted_at  timestamptz,                   -- 「提出しました」チェック日時
  submitted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_deadlines_active
  ON public.document_deadlines (deadline_at)
  WHERE is_active;

ALTER TABLE public.document_deadlines ENABLE ROW LEVEL SECURITY;

-- 閲覧は管理者・幹部のみ
DROP POLICY IF EXISTS "deadlines_select" ON public.document_deadlines;
CREATE POLICY "deadlines_select"
  ON public.document_deadlines
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_executive());

-- 更新（提出チェック）も管理者・幹部のみ。
-- INSERT / DELETE ポリシーは作らない = service role（cron）専用
DROP POLICY IF EXISTS "deadlines_update" ON public.document_deadlines;
CREATE POLICY "deadlines_update"
  ON public.document_deadlines
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_executive())
  WITH CHECK (public.is_admin_or_executive());

-- ⑤ 認証ユーザーの UPDATE は提出チェック（submitted_at / submitted_by）のみに制限。
--    締切日時や書類名の改変、他人名義での提出チェックを防ぐ。
--    service role（cron）は auth.uid() が NULL なので制限対象外。
CREATE OR REPLACE FUNCTION public.enforce_deadline_submission_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- cron（service role）は全カラム更新可
  END IF;

  IF NEW.source_key    IS DISTINCT FROM OLD.source_key
  OR NEW.deadline_at   IS DISTINCT FROM OLD.deadline_at
  OR NEW.document_name IS DISTINCT FROM OLD.document_name
  OR NEW.is_active     IS DISTINCT FROM OLD.is_active
  OR NEW.first_seen_at IS DISTINCT FROM OLD.first_seen_at
  OR NEW.last_seen_at  IS DISTINCT FROM OLD.last_seen_at
  OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only submission fields can be updated';
  END IF;

  -- 提出チェックは自分名義のみ（NULL = チェック解除は可）
  IF NEW.submitted_by IS NOT NULL AND NEW.submitted_by <> auth.uid() THEN
    RAISE EXCEPTION 'submitted_by must be the current user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_deadline_submission_only ON public.document_deadlines;
CREATE TRIGGER enforce_deadline_submission_only
  BEFORE UPDATE ON public.document_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deadline_submission_only();

REVOKE EXECUTE ON FUNCTION public.enforce_deadline_submission_only() FROM public;
REVOKE EXECUTE ON FUNCTION public.enforce_deadline_submission_only() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_deadline_submission_only() FROM authenticated;

-- ⑥ 取得ステータス（1行のみ）。「最終取得日時」の表示と障害検知に使う
CREATE TABLE IF NOT EXISTS public.deadline_scrape_status (
  id              int PRIMARY KEY CHECK (id = 1),
  last_success_at timestamptz,
  last_error      text,
  last_error_at   timestamptz
);

INSERT INTO public.deadline_scrape_status (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.deadline_scrape_status ENABLE ROW LEVEL SECURITY;

-- 閲覧は管理者・幹部のみ。書き込みポリシーなし = service role（cron）専用
DROP POLICY IF EXISTS "scrape_status_select" ON public.deadline_scrape_status;
CREATE POLICY "scrape_status_select"
  ON public.deadline_scrape_status
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_executive());
