-- 自主練参加取り消しのために attendance_records の自己削除を許可
-- （RLS にDELETEポリシーが存在しなかったため追加）
CREATE POLICY "attendance_delete_own" ON public.attendance_records
  FOR DELETE USING (auth.uid() = user_id);
