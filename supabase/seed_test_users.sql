-- ============================================================
-- テスト用アカウント作成
-- Supabase SQL Editor にて実行してください（schema.sql 実行後）
-- ============================================================

do $$
declare
  v_tani_id uuid;
begin

  -- 既存チェック
  select id into v_tani_id
  from auth.users
  where email = 'tani@cit-badminton.jp';

  -- ① auth.users に挿入（未登録の場合のみ）
  if v_tani_id is null then
    v_tani_id := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      v_tani_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'tani@cit-badminton.jp',
      crypt('Tani1234!', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', '谷 謙太郎', 'grade', 3),
      '{"provider":"email","providers":["email"]}',
      now(), now(),
      '', '', '', ''
    );
  end if;

  -- ② profiles を upsert（トリガーが is_approved=false で作っていても上書き）
  insert into public.profiles (
    id, full_name, grade, role, skill_rank, total_points, is_approved
  ) values (
    v_tani_id, '谷 謙太郎', 3, 'captain', 5, 1000, true
  )
  on conflict (id) do update
    set
      full_name   = excluded.full_name,
      grade       = excluded.grade,
      role        = excluded.role,
      skill_rank  = excluded.skill_rank,
      is_approved = excluded.is_approved;

  -- ③ 念のため直接 UPDATE（upsert が効かなかった場合の保険）
  update public.profiles
  set
    is_approved = true,
    role        = 'captain',
    skill_rank  = 5,
    full_name   = '谷 謙太郎',
    grade       = 3
  where id = v_tani_id;

end $$;

-- 確認クエリ（is_approved が true になっていることを確認）
select
  u.email,
  p.full_name,
  p.grade,
  p.role,
  p.skill_rank,
  p.is_approved
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'tani@cit-badminton.jp';
