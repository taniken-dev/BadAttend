-- ============================================================
-- ポイント制度 完全削除マイグレーション
-- Supabase SQL Editor にて実行してください
-- ============================================================

-- ① トリガー削除
drop trigger if exists attendance_calc_points on public.attendance_records;
drop function if exists public.calc_points_on_attendance();

-- ② point_logs テーブル削除
drop table if exists public.point_logs;

-- ③ profiles からポイント列削除
alter table public.profiles drop column if exists total_points;

-- ④ attendance_records からポイント列削除
alter table public.attendance_records drop column if exists points_delta;

-- ⑤ v_selection_scores ビュー再作成（ポイント除去 + 出席率フォーカス）
create or replace view public.v_selection_scores
  with (security_invoker = on)
as
with session_stats as (
  select
    ar.user_id,
    count(*) filter (where ps.session_date <= current_date)  as total_sessions,
    count(*) filter (where ar.status = 'present'
                       and ps.session_date <= current_date)  as present_count,
    count(*) filter (where ar.status = 'tardy'
                       and ps.session_date <= current_date)  as tardy_count,
    count(*) filter (where ar.status in (
                       'absent_normal','absent_emergency','absent_unreported')
                       and ps.session_date <= current_date)  as absent_count,
    count(*) filter (where ar.is_emergency = true
                       and ps.session_date <= current_date)  as emergency_count
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
    coalesce(ss.total_sessions, 0)   as total_sessions,
    coalesce(ss.present_count, 0)    as present_count,
    coalesce(ss.tardy_count, 0)      as tardy_count,
    coalesce(ss.absent_count, 0)     as absent_count,
    coalesce(ss.emergency_count, 0)  as emergency_count,
    case
      when coalesce(ss.total_sessions, 0) = 0 then 100.0
      else round(
        (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)::numeric
        / ss.total_sessions * 100, 1
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
order by attendance_rate desc, selection_score desc;
