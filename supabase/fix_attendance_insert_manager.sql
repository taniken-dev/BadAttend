-- manager/admin が他メンバーの attendance_records を INSERT できるポリシー追加
-- 背景: 未提出者への実績登録時に INSERT が必要だが、既存の attendance_insert_own は
--       auth.uid() = user_id のみ許可しており、他ユーザー分の INSERT がブロックされていた

CREATE POLICY "attendance_insert_manager" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin());
