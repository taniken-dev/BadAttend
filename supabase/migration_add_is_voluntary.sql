-- 自主練習フラグを practice_sessions に追加
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS is_voluntary boolean NOT NULL DEFAULT false;

-- v_selection_scores ビューを更新：自主練習セッションを選考スコア計算から除外
DROP VIEW IF EXISTS public.v_selection_scores;

CREATE VIEW public.v_selection_scores
  WITH (security_invoker = on)
AS
WITH eligible AS (
  SELECT
    p.id                AS user_id,
    ps.id               AS session_id,
    ar.result_status
  FROM public.profiles p
  CROSS JOIN public.practice_sessions ps
  LEFT JOIN public.attendance_records ar
    ON ar.session_id = ps.id AND ar.user_id = p.id
  WHERE p.is_approved = true
    AND ps.session_date <= current_date
    AND ps.is_cancelled = false
    AND ps.is_results_confirmed = true
    AND ps.is_camp = false
    AND ps.is_bukai = false
    AND ps.is_voluntary = false
    AND ps.session_date >= COALESCE(
      p.joined_at,
      MAKE_DATE(
        (EXTRACT(YEAR FROM current_date)::int
          + CASE WHEN EXTRACT(MONTH FROM current_date) >= 4 THEN 0 ELSE -1 END)
        - (p.grade - 1),
        5, 1
      )
    )
),
user_stats AS (
  SELECT
    user_id,
    count(*)                                                                               AS total_sessions,
    count(*) FILTER (WHERE result_status = 'present')                                      AS present_count,
    count(*) FILTER (WHERE result_status = 'tardy')                                        AS tardy_count,
    count(*) FILTER (WHERE result_status IN ('absent_normal','absent_emergency','absent_unreported')) AS absent_count,
    count(*) FILTER (WHERE result_status = 'absent_emergency')                             AS emergency_count,
    count(*) FILTER (WHERE result_status = 'absent_unreported')                            AS unreported_count
  FROM eligible
  GROUP BY user_id
),
calc AS (
  SELECT
    p.id,
    p.full_name,
    p.display_name,
    p.grade,
    p.gender,
    p.skill_rank,
    p.joined_at,
    coalesce(us.total_sessions,   0)  AS total_sessions,
    coalesce(us.present_count,    0)  AS present_count,
    coalesce(us.tardy_count,      0)  AS tardy_count,
    coalesce(us.absent_count,     0)  AS absent_count,
    coalesce(us.emergency_count,  0)  AS emergency_count,
    coalesce(us.unreported_count, 0)  AS unreported_count,
    CASE
      WHEN coalesce(us.total_sessions, 0) = 0 THEN 0.0
      ELSE round(
        (coalesce(us.present_count, 0) + coalesce(us.tardy_count, 0) * 0.5)::numeric
        / us.total_sessions * 100,
        1
      )
    END AS attendance_rate,
    CASE
      WHEN coalesce(us.total_sessions, 0) = 0 THEN 0.0
      ELSE round(
        (p.skill_rank::numeric / 6.0)
        * (coalesce(us.present_count, 0) + coalesce(us.tardy_count, 0) * 0.5)
        / us.total_sessions * 100,
        1
      )
    END AS selection_score
  FROM public.profiles p
  LEFT JOIN user_stats us ON us.user_id = p.id
  WHERE p.is_approved = true
)
SELECT
  id,
  full_name,
  display_name,
  grade,
  gender,
  skill_rank,
  joined_at,
  total_sessions,
  present_count,
  tardy_count,
  absent_count,
  emergency_count,
  unreported_count,
  attendance_rate,
  selection_score,
  CASE
    WHEN attendance_rate >= 85 THEN 'S'
    WHEN attendance_rate >= 70 THEN 'A'
    WHEN attendance_rate >= 55 THEN 'B'
    WHEN attendance_rate >= 40 THEN 'C'
    WHEN attendance_rate >= 25 THEN 'D'
    ELSE 'E'
  END AS selection_rank
FROM calc
ORDER BY attendance_rate DESC, present_count DESC;
