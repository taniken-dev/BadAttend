-- ============================================================
-- ランキング計算を実績確定（result_status）ベースに変更
-- 変更点:
--   - 分母を「実績確定済みセッション数」に変更（is_results_confirmed = true）
--   - ar.status → ar.result_status を参照
--   - 未確定セッションは集計対象外
-- ============================================================

CREATE OR REPLACE VIEW public.v_selection_scores
  WITH (security_invoker = on)
AS
WITH all_sessions AS (
  -- 実績確定済みの練習セッション数
  SELECT count(*) AS total
  FROM public.practice_sessions
  WHERE session_date <= current_date
    AND is_cancelled = false
    AND is_results_confirmed = true
),
session_stats AS (
  -- ユーザーごとの実績ステータスを集計（確定済みセッションのみ）
  SELECT
    ar.user_id,
    count(*) FILTER (WHERE ar.result_status = 'present'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false
                       AND ps.is_results_confirmed = true) AS present_count,
    count(*) FILTER (WHERE ar.result_status = 'tardy'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false
                       AND ps.is_results_confirmed = true) AS tardy_count,
    count(*) FILTER (WHERE ar.result_status IN ('absent_normal','absent_emergency','absent_unreported')
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false
                       AND ps.is_results_confirmed = true) AS absent_count,
    count(*) FILTER (WHERE ar.result_status = 'absent_emergency'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false
                       AND ps.is_results_confirmed = true) AS emergency_count
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
    -- 出席率: (出席 + 遅刻×0.5) / 確定済みセッション数
    CASE
      WHEN (SELECT total FROM all_sessions) = 0 THEN 0.0
      ELSE round(
        (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)::numeric
        / (SELECT total FROM all_sessions) * 100,
        1
      )
    END AS attendance_rate,
    -- 選考スコア（内部計算用、表示しない）
    round(
      (p.skill_rank::numeric / 6.0)
      * CASE
          WHEN (SELECT total FROM all_sessions) = 0 THEN 0.0
          ELSE (coalesce(ss.present_count, 0) + coalesce(ss.tardy_count, 0) * 0.5)
               / (SELECT total FROM all_sessions)
        END
      * 100, 1
    ) AS selection_score
  FROM public.profiles p
  LEFT JOIN session_stats ss ON ss.user_id = p.id
  WHERE p.is_approved = true
)
SELECT
  *,
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
