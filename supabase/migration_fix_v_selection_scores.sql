-- ============================================================
-- v_selection_scores ビュー修正
-- 変更点:
--   - is_results_confirmed の制約を撤廃
--   - result_status が設定済みのレコードを即時集計
--   - 分母を「過去の全非キャンセルセッション数」に変更
--   - unreported_count（無断欠席数）を末尾に追加
-- ============================================================

CREATE OR REPLACE VIEW public.v_selection_scores
  WITH (security_invoker = on)
AS
WITH all_sessions AS (
  SELECT count(*) AS total
  FROM public.practice_sessions
  WHERE session_date < current_date
    AND is_cancelled = false
),
session_stats AS (
  SELECT
    ar.user_id,
    count(*) FILTER (WHERE ar.result_status = 'present'
                       AND ps.session_date < current_date
                       AND ps.is_cancelled = false) AS present_count,
    count(*) FILTER (WHERE ar.result_status = 'tardy'
                       AND ps.session_date < current_date
                       AND ps.is_cancelled = false) AS tardy_count,
    count(*) FILTER (WHERE ar.result_status IN ('absent_normal','absent_emergency','absent_unreported')
                       AND ps.session_date < current_date
                       AND ps.is_cancelled = false) AS absent_count,
    count(*) FILTER (WHERE ar.result_status = 'absent_emergency'
                       AND ps.session_date < current_date
                       AND ps.is_cancelled = false) AS emergency_count,
    count(*) FILTER (WHERE ar.result_status = 'absent_unreported'
                       AND ps.session_date < current_date
                       AND ps.is_cancelled = false) AS unreported_count
  FROM public.attendance_records ar
  JOIN public.practice_sessions ps ON ps.id = ar.session_id
  GROUP BY ar.user_id
),
calc AS (
  SELECT
    p.id,
    p.full_name,
    p.display_name,
    p.grade,
    p.gender,
    p.skill_rank,
    (SELECT total FROM all_sessions)        AS total_sessions,
    coalesce(ss.present_count,   0)         AS present_count,
    coalesce(ss.tardy_count,     0)         AS tardy_count,
    coalesce(ss.absent_count,    0)         AS absent_count,
    coalesce(ss.emergency_count, 0)         AS emergency_count,
    CASE
      WHEN (SELECT total FROM all_sessions) = 0 THEN 0.0
      ELSE round(
        (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)::numeric
        / (SELECT total FROM all_sessions) * 100,
        1
      )
    END AS attendance_rate,
    round(
      (p.skill_rank::numeric / 6.0)
      * CASE
          WHEN (SELECT total FROM all_sessions) = 0 THEN 0.0
          ELSE (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)
               / (SELECT total FROM all_sessions)
        END
      * 100, 1
    ) AS selection_score,
    coalesce(ss.unreported_count, 0)        AS unreported_count
  FROM public.profiles p
  LEFT JOIN session_stats ss ON ss.user_id = p.id
  WHERE p.is_approved = true
)
-- 既存カラム順を維持しつつ unreported_count を末尾に追加
-- selection_rank(14番目) の後に unreported_count(15番目) を配置
SELECT
  id,
  full_name,
  display_name,
  grade,
  gender,
  skill_rank,
  total_sessions,
  present_count,
  tardy_count,
  absent_count,
  emergency_count,
  attendance_rate,
  selection_score,
  CASE
    WHEN attendance_rate >= 85 THEN 'S'
    WHEN attendance_rate >= 70 THEN 'A'
    WHEN attendance_rate >= 55 THEN 'B'
    WHEN attendance_rate >= 40 THEN 'C'
    WHEN attendance_rate >= 25 THEN 'D'
    ELSE 'E'
  END AS selection_rank,
  unreported_count
FROM calc
ORDER BY attendance_rate DESC, present_count DESC;
