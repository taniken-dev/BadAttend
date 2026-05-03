-- ============================================================
-- 出席率計算の修正
-- 変更点:
--   - 分母を「ユーザーが提出したセッション数」→「実施された全セッション数」に変更
--   - 未提出＝欠席扱いとなり、出席率が正しく計算される
--   - セッションが0件のときは出席率 0% (従来は 100%)
-- ============================================================

CREATE OR REPLACE VIEW public.v_selection_scores
  WITH (security_invoker = on)
AS
WITH all_sessions AS (
  -- 今日までに実施された全練習セッション数（キャンセル除く）
  SELECT count(*) AS total
  FROM public.practice_sessions
  WHERE session_date <= current_date
    AND is_cancelled = false
),
session_stats AS (
  -- ユーザーごとの提出済み出欠記録を集計
  SELECT
    ar.user_id,
    count(*) FILTER (WHERE ar.status = 'present'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS present_count,
    count(*) FILTER (WHERE ar.status = 'tardy'
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS tardy_count,
    count(*) FILTER (WHERE ar.status IN ('absent_normal','absent_emergency','absent_unreported')
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS absent_count,
    count(*) FILTER (WHERE ar.is_emergency = true
                       AND ps.session_date <= current_date
                       AND ps.is_cancelled = false) AS emergency_count
  FROM public.attendance_records ar
  JOIN public.practice_sessions ps ON ps.id = ar.session_id
  GROUP BY ar.user_id
),
calc AS (
  SELECT
    p.id,
    p.full_name,
    p.grade,
    p.gender,
    p.skill_rank,
    (SELECT total FROM all_sessions)        AS total_sessions,
    coalesce(ss.present_count,   0)         AS present_count,
    coalesce(ss.tardy_count,     0)         AS tardy_count,
    coalesce(ss.absent_count,    0)         AS absent_count,
    coalesce(ss.emergency_count, 0)         AS emergency_count,
    -- 出席率: (出席 + 遅刻×0.5) / 全セッション数
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
