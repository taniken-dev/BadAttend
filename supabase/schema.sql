-- ============================================================
-- 千葉工業大学 バドミントン部 出欠管理システム
-- Supabase DB スキーマ
-- ============================================================

-- ① プロフィール（部員マスタ）
create table if not exists public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  full_name    text not null,
  student_id   text unique,                        -- 学籍番号
  grade        int  not null check (grade between 1 and 4),
  gender       text check (gender in ('male','female','other')),
  role         text not null default 'member'
                check (role in ('member','captain','admin')),

  -- 選考用固定値（コーチが設定）
  -- 1=E  2=D  3=C  4=B  5=A  6=S
  skill_rank   int  not null default 3
                check (skill_rank between 1 and 6),

  -- 累積ポイント（初期値 1000）
  total_points int  not null default 1000,

  -- ロックアウトフラグ（体調不良翌日）
  lockout_until date,

  avatar_url   text,
  is_approved  boolean not null default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ② 練習セッション（水・木・金 17:00〜20:00）
create table if not exists public.practice_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_date    date not null unique,
  start_time      time not null default '17:00:00',
  end_time        time not null default '20:00:00',
  location        text not null default '新習志野体育館',
  is_cancelled    boolean not null default false,
  note            text,
  created_at      timestamptz default now()
);

-- ③ 出欠記録
create table if not exists public.attendance_records (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.practice_sessions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,

  status          text not null
                   check (status in (
                     'present',       -- 出席
                     'tardy',         -- 遅刻
                     'absent_normal', -- 通常欠席（1時間以上前の連絡）
                     'absent_emergency', -- 当日欠席（出席予定で来なかった）
                     'absent_unreported' -- 無連絡欠席
                   )),

  reason          text
                   check (reason in (
                     'practice',    -- 練習（別大会など）
                     'class',       -- 授業
                     'sick',        -- 体調不良
                     'personal',    -- 私用
                     'other'        -- その他
                   )),

  reason_detail   text,            -- 自由記述
  reported_at     timestamptz,     -- 連絡した時刻
  is_emergency    boolean not null default false,  -- 1時間以内連絡フラグ

  -- ポイント変動（本レコード起因）
  points_delta    int not null default 0,

  created_at      timestamptz default now(),
  unique (session_id, user_id)
);

-- ④ ペナルティ / ボーナスログ
create table if not exists public.point_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid references public.practice_sessions(id),
  delta       int not null,
  reason_code text not null,  -- 'absent_normal', 'absent_emergency', etc.
  note        text,
  created_at  timestamptz default now()
);

-- ⑤ 警告フラグ（部則第5項：2ヶ月継続違反）
create table if not exists public.warning_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  flag_type   text not null
               check (flag_type in (
                 'dues_overdue',      -- 部費滞納
                 'absent_no_report',  -- 無連絡欠席継続
                 'conduct'            -- 品位違反
               )),
  started_at  date not null,
  resolved_at date,
  severity    text not null default 'warning'
               check (severity in ('warning','final_warning','expelled')),
  note        text,
  created_at  timestamptz default now()
);

-- ============================================================
-- ビュー: 選考スコア計算
--   selection_score = (skill_rank / 6.0) × attendance_rate × 100
-- ============================================================
create or replace view public.v_selection_scores as
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
    -- 選考スコア
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
  -- 選考ランク S/A/B/C/D/E
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
-- Row Level Security
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.practice_sessions  enable row level security;
alter table public.attendance_records enable row level security;
alter table public.point_logs         enable row level security;
alter table public.warning_flags      enable row level security;

-- profiles: 自分のプロフィールは読み書き可、承認済み部員のプロフィールは全員読み取り可
create policy "profiles_select_approved" on public.profiles
  for select using (is_approved = true or auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- practice_sessions: 全員読み取り可、admin/captainのみ書き込み可
create policy "sessions_select_all" on public.practice_sessions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved = true)
  );

create policy "sessions_write_admin" on public.practice_sessions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','captain'))
  );

-- attendance_records: 自分のレコードは読み書き可、admin/captainは全員分読み取り可
create policy "attendance_select_own" on public.attendance_records
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','captain'))
  );

create policy "attendance_insert_own" on public.attendance_records
  for insert with check (auth.uid() = user_id);

create policy "attendance_update_own" on public.attendance_records
  for update using (auth.uid() = user_id);

-- point_logs: 自分のログのみ読み取り可
create policy "point_logs_select_own" on public.point_logs
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','captain'))
  );

create policy "point_logs_insert_admin" on public.point_logs
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','captain'))
  );

-- warning_flags: admin/captainのみ
create policy "warning_select_admin" on public.warning_flags
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','captain'))
  );

create policy "warning_write_admin" on public.warning_flags
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','captain'))
  );

-- ============================================================
-- トリガー: updated_at 自動更新
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- 関数: 出欠登録時にポイントを自動計算して profiles に反映
-- ============================================================
create or replace function public.calc_points_on_attendance()
returns trigger language plpgsql security definer as $$
declare
  v_delta int;
  v_session_start timestamptz;
begin
  -- セッション開始日時を取得
  select (ps.session_date + ps.start_time)::timestamptz into v_session_start
  from public.practice_sessions ps
  where ps.id = new.session_id;

  -- ポイント計算
  v_delta := case new.status
    when 'present'              then  0
    when 'tardy'                then -10
    when 'absent_normal'        then -20
    when 'absent_emergency'     then -50
    when 'absent_unreported'    then -100
    else 0
  end;

  -- 1時間以内の連絡かどうか判定
  if new.reported_at is not null
     and new.status in ('absent_normal','absent_emergency')
     and v_session_start - new.reported_at <= interval '1 hour' then
    new.is_emergency := true;
    new.status := 'absent_emergency';
    v_delta := -50;
  end if;

  new.points_delta := v_delta;

  -- profiles.total_points を更新
  update public.profiles
  set total_points = total_points + v_delta
  where id = new.user_id;

  -- point_logs に記録
  insert into public.point_logs (user_id, session_id, delta, reason_code)
  values (new.user_id, new.session_id, v_delta, new.status);

  -- 体調不良の場合、翌日をロックアウト
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

create trigger attendance_calc_points
  before insert on public.attendance_records
  for each row execute procedure public.calc_points_on_attendance();

-- ============================================================
-- 関数: auth.users に新規ユーザー登録時、profiles を自動作成
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id,
    full_name,
    grade,
    role,
    skill_rank,
    total_points,
    is_approved
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '未設定'),
    coalesce((new.raw_user_meta_data->>'grade')::int, 1),
    'member',
    3,      -- デフォルト C級
    1000,   -- 初期ポイント
    false   -- 承認待ち
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- シードデータ: 練習セッション（2026年5月〜6月）
-- ============================================================
insert into public.practice_sessions (session_date, start_time, end_time)
select d::date, '17:00:00', '20:00:00'
from generate_series('2026-04-01'::date, '2026-06-30'::date, '1 day') d
where extract(dow from d) in (3, 4, 5)  -- 水・木・金
on conflict (session_date) do nothing;
