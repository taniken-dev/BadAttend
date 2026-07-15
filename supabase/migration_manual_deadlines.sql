-- ============================================================
-- 提出書類締切：手動登録対応 マイグレーション
--  ① document_deadlines に source（scraped/manual）を追加
--  ② 手動行の INSERT / DELETE を管理者のみに許可
--  ③ 改変防止トリガーを拡張（手動行の書類名・締切日時は管理者のみ編集可）
-- 幹部は従来通り閲覧と提出チェックのみ。
-- migration_document_deadlines.sql 適用後に Supabase SQL Editor で実行してください。
-- ============================================================

-- ① 取得元の区別。既存行は全て自動取得（scraped）
ALTER TABLE public.document_deadlines
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'scraped'
    CHECK (source IN ('scraped', 'manual'));

-- ② 手動行の作成・削除は管理者のみ
--    （scraped を装った行は作れず、サイト由来の行は削除できない）
DROP POLICY IF EXISTS "deadlines_insert_manual_admin" ON public.document_deadlines;
CREATE POLICY "deadlines_insert_manual_admin"
  ON public.document_deadlines
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND source = 'manual');

DROP POLICY IF EXISTS "deadlines_delete_manual_admin" ON public.document_deadlines;
CREATE POLICY "deadlines_delete_manual_admin"
  ON public.document_deadlines
  FOR DELETE
  TO authenticated
  USING (public.is_admin() AND source = 'manual');

-- ③ 改変防止トリガーを拡張
--    - source の書き換えは全面禁止
--    - 書類名・締切日時の変更は「手動行かつ管理者」のみ
--    - それ以外のカラムは従来通り提出チェック（submitted_*）だけ変更可
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

  IF NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'source cannot be changed';
  END IF;

  IF NEW.source_key    IS DISTINCT FROM OLD.source_key
  OR NEW.is_active     IS DISTINCT FROM OLD.is_active
  OR NEW.first_seen_at IS DISTINCT FROM OLD.first_seen_at
  OR NEW.last_seen_at  IS DISTINCT FROM OLD.last_seen_at
  OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only submission fields can be updated';
  END IF;

  IF (NEW.document_name IS DISTINCT FROM OLD.document_name
   OR NEW.deadline_at   IS DISTINCT FROM OLD.deadline_at)
  AND NOT (OLD.source = 'manual' AND public.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can edit manual deadlines';
  END IF;

  -- 提出チェックは自分名義のみ（NULL = チェック解除は可）
  IF NEW.submitted_by IS NOT NULL AND NEW.submitted_by <> auth.uid() THEN
    RAISE EXCEPTION 'submitted_by must be the current user';
  END IF;

  RETURN NEW;
END;
$$;
