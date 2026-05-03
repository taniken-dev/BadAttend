-- ============================================================
-- セキュリティ修正パッチ
-- Supabase Security Advisor エラー・警告の解消
-- ============================================================
-- Supabase SQL Editor にて実行してください。
-- ============================================================


-- ============================================================
-- [ERROR 修正] Security Definer View → Security Invoker
-- v_selection_scores を呼び出し元ユーザー権限で実行するよう変更
-- ============================================================
create or replace view public.v_selection_scores
  with (security_invoker = on)
as
with session_stats as (
  select
    ar.user_id,
    count(*) filter (where ps.session_date <= current_date)           as total_sessions,
    count(*) filter (where ar.status = 'present'
                       and ps.session_date <= current_date)           as present_count,
    count(*) filter (where ar.status = 'tardy'
                       and ps.session_date <= current_date)           as tardy_count,
    count(*) filter (where ar.status in ('absent_normal','absent_emergency','absent_unreported')
                       and ps.session_date <= current_date)           as absent_count,
    count(*) filter (where ar.is_emergency = true
                       and ps.session_date <= current_date)           as emergency_count
  from public.attendance_records ar
  join public.practice_sessions ps on ps.id = ar.session_id
  group by ar.user_id
),
calc as (
  select
    p.id,
    p.full_name,
    p.grade,
    p.gender,
    p.skill_rank,
    p.total_points,
    coalesce(ss.total_sessions, 0)   as total_sessions,
    coalesce(ss.present_count, 0)    as present_count,
    coalesce(ss.tardy_count, 0)      as tardy_count,
    coalesce(ss.absent_count, 0)     as absent_count,
    coalesce(ss.emergency_count, 0)  as emergency_count,
    case
      when coalesce(ss.total_sessions, 0) = 0 then 100.0
      else round(
        (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)::numeric
        / ss.total_sessions * 100,
        1
      )
    end as attendance_rate,
    round(
      (p.skill_rank::numeric / 6.0)
      * case
          when coalesce(ss.total_sessions, 0) = 0 then 1.0
          else (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)
               / ss.total_sessions
        end
      * 100, 1
    ) as selection_score
  from public.profiles p
  left join session_stats ss on ss.user_id = p.id
  where p.is_approved = true
)
select
  *,
  case
    when selection_score >= 85 then 'S'
    when selection_score >= 70 then 'A'
    when selection_score >= 55 then 'B'
    when selection_score >= 40 then 'C'
    when selection_score >= 25 then 'D'
    else 'E'
  end as selection_rank
from calc
order by selection_score desc;


-- ============================================================
-- [WARNING 修正] Function Search Path Mutable
-- 全関数に SET search_path = '' を付与
-- ============================================================

-- handle_updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- calc_points_on_attendance
create or replace function public.calc_points_on_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta int;
  v_session_start timestamptz;
begin
  select (ps.session_date + ps.start_time)::timestamptz into v_session_start
  from public.practice_sessions ps
  where ps.id = new.session_id;

  v_delta := case new.status
    when 'present'              then  0
    when 'tardy'                then -10
    when 'absent_normal'        then -20
    when 'absent_emergency'     then -50
    when 'absent_unreported'    then -100
    else 0
  end;

  if new.reported_at is not null
     and new.status in ('absent_normal','absent_emergency')
     and v_session_start - new.reported_at <= interval '1 hour' then
    new.is_emergency := true;
    new.status := 'absent_emergency';
    v_delta := -50;
  end if;

  new.points_delta := v_delta;

  update public.profiles
  set total_points = total_points + v_delta
  where id = new.user_id;

  insert into public.point_logs (user_id, session_id, delta, reason_code)
  values (new.user_id, new.session_id, v_delta, new.status);

  if new.reason = 'sick' then
    update public.profiles
    set lockout_until = (
      select ps.session_date + interval '1 day'
      from public.practice_sessions ps
      where ps.id = new.session_id
    )
    where id = new.user_id;
  end if;

  return new;
end;
$$;

-- handle_new_user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, grade, role, skill_rank, total_points, is_approved
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '未設定'),
    coalesce((new.raw_user_meta_data->>'grade')::int, 1),
    'member',
    3,
    1000,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ============================================================
-- [WARNING 修正] Public/Signed-In Can Execute SECURITY DEFINER
-- SECURITY DEFINER 関数の実行権限を public・anon・authenticated から剥奪
-- ※ トリガー関数はトリガー経由でのみ呼ばれるため、直接実行は不要
-- ============================================================

revoke execute on function public.calc_points_on_attendance() from public;
revoke execute on function public.calc_points_on_attendance() from anon;
revoke execute on function public.calc_points_on_attendance() from authenticated;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.handle_updated_at() from public;
revoke execute on function public.handle_updated_at() from anon;
revoke execute on function public.handle_updated_at() from authenticated;


-- ============================================================
-- [WARNING 参考] Leaked Password Protection
-- これは SQL では設定できません。Supabase Dashboard で対応:
--   Authentication → Providers → Email
--   → "Enable Leaked Password Protection" を ON に切り替える
-- ============================================================
