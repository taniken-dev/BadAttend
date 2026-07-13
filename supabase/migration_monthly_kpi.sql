-- ============================================================
-- 月次KPIビュー（v_monthly_kpi）
--   導入効果の継続トラッキング用。閲覧は admin のみ。
--
-- 【このビューが存在する理由】
--   Excel運用期（〜2026-03）とアプリ運用期（2026-05〜）は、
--   母集団（27名→77名）・記録の定義・記録される項目がすべて異なるため、
--   出席率の単純な前後比較は成立しない。
--   そこで「アプリ期の中で継続的に追える指標」を1か所に固定し、
--   施策の効果を正しく測れるベースラインを作る。
--
-- 【集計対象の定義（アプリ各所に散らばっていた条件をここに集約）】
--   - 通常練習のみ（休止・合宿・部会・自主練は除外）
--   - 実績確定済み（is_results_confirmed = true）のセッションのみ
--   - 実績は COALESCE(result_status, status) を採用
--
-- Supabase SQL Editor にて実行してください。
-- ============================================================

-- security_invoker = on:
--   ビューを「呼び出したユーザーの権限」で実行する（既定は作成者権限＝SECURITY DEFINER相当で、
--   Supabase の Security Advisor に "Security Definer View" として検出される）。
--   本来 definer が必要になるのは RLS で行が絞られて集計が壊れる場合だが、
--   このアプリでは承認済みメンバーが全 attendance_records / practice_sessions を
--   SELECT できる（fix_member_attendance_visibility.sql）ため、管理者は invoker でも
--   全行を読めて集計は正しく出る。よって definer にする必要がない。
CREATE OR REPLACE VIEW public.v_monthly_kpi
WITH (security_invoker = on) AS
WITH target_sessions AS (
  SELECT
    ps.id,
    ps.session_date,
    date_trunc('month', ps.session_date)::date AS month,
    ps.is_results_confirmed,
    -- 出欠提出の締切 = 練習週の火曜 23:59 (JST)。
    -- 練習は水・木・金が前提（168件中164件）。それ以外の曜日は
    -- 締切を定義できないため NULL とし、締切後連絡率の分母から除外する。
    CASE
      WHEN EXTRACT(isodow FROM ps.session_date) IN (3, 4, 5)
        THEN ((date_trunc('week', ps.session_date)::date + 1) + time '23:59')
               AT TIME ZONE 'Asia/Tokyo'
      ELSE NULL
    END AS report_deadline
  FROM public.practice_sessions ps
  WHERE ps.is_cancelled = false
    AND ps.is_camp      = false
    AND ps.is_bukai     = false
    AND ps.is_voluntary = false
),

session_counts AS (
  SELECT
    month,
    count(*)                                    AS sessions_total,
    count(*) FILTER (WHERE is_results_confirmed) AS sessions_confirmed
  FROM target_sessions
  GROUP BY month
),

recs AS (
  SELECT
    ts.month,
    ts.report_deadline,
    COALESCE(ar.result_status, ar.status) AS st,
    ar.reported_at
  FROM public.attendance_records ar
  JOIN target_sessions ts ON ts.id = ar.session_id
  WHERE ts.is_results_confirmed = true
),

agg AS (
  SELECT
    month,
    count(*)                                            AS records,
    count(*) FILTER (WHERE st = 'present')              AS present_count,
    count(*) FILTER (WHERE st = 'tardy')                AS tardy_count,
    count(*) FILTER (WHERE st = 'absent_emergency')     AS emergency_count,
    count(*) FILTER (WHERE st = 'absent_unreported')    AS unreported_count,
    -- 締切後連絡率の分母: 締切が定義でき、連絡時刻が記録されている欠席・遅刻
    count(*) FILTER (
      WHERE reported_at     IS NOT NULL
        AND report_deadline IS NOT NULL
        AND st <> 'present'
    ) AS reports_total,
    count(*) FILTER (
      WHERE reported_at     IS NOT NULL
        AND report_deadline IS NOT NULL
        AND st <> 'present'
        AND reported_at > report_deadline
    ) AS late_reports,
    -- 締切を定義できない曜日（土日月火）のレコード数。透明性のため出す。
    count(*) FILTER (WHERE report_deadline IS NULL) AS excluded_records
  FROM recs
  GROUP BY month
),

base AS (
  SELECT
    sc.month,
    -- excel      : Excel運用期。出席率しか存在しない
    -- transition : 2026-04。管理者が実績を手入力したが部員は自己登録していない
    --              （reported_at が1件もない）ため、提出率・締切後連絡率は無意味
    -- app        : 2026-05〜。部員の自己登録が始まった。ここが本当のベースライン
    CASE
      WHEN sc.month < date '2026-04-01' THEN 'excel'
      WHEN sc.month < date '2026-05-01' THEN 'transition'
      ELSE 'app'
    END AS era,
    sc.sessions_total,
    sc.sessions_confirmed,
    COALESCE(a.records,          0) AS records,
    COALESCE(a.present_count,    0) AS present_count,
    COALESCE(a.tardy_count,      0) AS tardy_count,
    COALESCE(a.emergency_count,  0) AS emergency_count,
    COALESCE(a.unreported_count, 0) AS unreported_count,
    COALESCE(a.reports_total,    0) AS reports_total,
    COALESCE(a.late_reports,     0) AS late_reports,
    COALESCE(a.excluded_records, 0) AS excluded_records
  FROM session_counts sc
  LEFT JOIN agg a USING (month)
)

SELECT
  month,
  era,
  sessions_total,
  sessions_confirmed,
  -- 実績確定率。低い月は数字が出ても信用できない（例: 2025-08 は 17件中5件のみ確定）
  round(sessions_confirmed::numeric / NULLIF(sessions_total, 0) * 100, 1) AS confirmed_ratio,
  -- 実績が1件も確定していない月は「データなし」。UI では 0% ではなく「—」と表示すること
  (sessions_confirmed > 0) AS has_data,
  records,
  present_count,
  tardy_count,
  emergency_count,
  unreported_count,
  reports_total,
  late_reports,
  excluded_records,

  -- 出席率（出席 + 遅刻×0.5）。両期間で算出できるが、母集団が異なるため
  -- Excel期とアプリ期を直接比較してはいけない。
  CASE WHEN records > 0
    THEN round((present_count + tardy_count * 0.5)::numeric / records * 100, 1)
  END AS attendance_rate,

  -- ▼ 以下はアプリ期のみ。Excel期・移行期は概念そのものが存在しないため NULL。
  --   ここを 0 にすると「無連絡欠席がゼロだった」という嘘になるので絶対に 0 にしない。
  CASE WHEN era = 'app' AND records > 0
    THEN round((records - unreported_count)::numeric / records * 100, 1)
  END AS submission_rate,

  CASE WHEN era = 'app' AND records > 0
    THEN round(unreported_count::numeric / records * 100, 1)
  END AS unreported_rate,

  CASE WHEN era = 'app' AND records > 0
    THEN round(emergency_count::numeric / records * 100, 1)
  END AS emergency_rate,

  -- 主要指標: 締切（火23:59）を過ぎてから出された欠席連絡の割合。
  -- 「直前の欠席連絡の常態化」を直接測る唯一の指標。
  CASE WHEN era = 'app' AND reports_total > 0
    THEN round(late_reports::numeric / reports_total * 100, 1)
  END AS late_report_rate

FROM base
-- 閲覧は管理者のみ。
-- security_invoker = on なので下位テーブルの RLS はそのまま効くが、
-- 承認済みメンバーなら誰でも全出欠レコードを読めてしまう（＝集計は見えてしまう）。
-- そこでビュー自身に管理者チェックを置き、admin 以外には 0 行返す。
--
-- auth.uid() IS NULL は service role（cron・スクリプト）のみ。
-- 未ログインの anon ロールは下の REVOKE でそもそもこのビューに触れず、
-- ログイン済みユーザーは必ず auth.uid() を持つため、この条件で緩むのは
-- 元から全テーブルを読める service role だけ（＝権限は増えない）。
WHERE public.is_admin() OR auth.uid() IS NULL
ORDER BY month;

REVOKE ALL   ON public.v_monthly_kpi FROM anon;
GRANT  SELECT ON public.v_monthly_kpi TO authenticated;
