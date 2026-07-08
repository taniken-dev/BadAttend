-- ============================================================
-- ご意見箱（suggestions）の INSERT ポリシー強化
-- Supabase SQL Editor にて実行してください。
--
-- 変更点:
--   1. 投稿を「承認済みユーザー」に限定
--      （従来は WITH CHECK (true) のため、LINE ログイン直後の
--        未承認ユーザーでも投稿できた）
--   2. タイトル100文字・本文1000文字の上限を DB 側でも強制
--      （従来はクライアントの maxLength のみで、API 直叩きで迂回可能だった）
--
-- 前提: public.is_approved_user() が存在すること
--       （migration_security_hardening.sql で作成済み）
-- 匿名性への影響: なし（user_id は引き続き保存されない）
-- ============================================================

DROP POLICY IF EXISTS "suggestions_insert" ON public.suggestions;
CREATE POLICY "suggestions_insert"
  ON public.suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_approved_user()
    AND char_length(title) <= 100
    AND char_length(body)  <= 1000
  );
