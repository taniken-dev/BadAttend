// DB 関数（registration_window_calc / registration_self_check）を確かめる SQL を出力する
//
//   node scripts/check-registration-window.mjs > ../BadAttend-db/check_registration_window.sql
//
// ケース表は tests/registration-cases.mjs（アプリ側のテスト npm test と共通）。
// 出力した SQL を Supabase SQL Editor で実行し、全行 ok = true になることを確認する。

import { WINDOW_CASES, SELF_CASES } from '../tests/registration-cases.mjs'

const q = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const windowRows = WINDOW_CASES.map(([label, d, p, mode, opens, closes]) =>
  `    (${q(label)}, ${q(d)}::date, ${q(p.strict_start_date)}::date, ${q(p.biweekly_start)}::date, ${q(mode)}, ${q(opens)}::timestamptz, ${q(closes)}::timestamptz)`)
const selfRows = SELF_CASES.map(([label, now, d, p, oldS, newS, exp]) =>
  `    (${q(label)}, ${q(now)}::timestamptz, ${q(d)}::date, ${q(p.strict_start_date)}::date, ${q(p.biweekly_start)}::date, ${q(oldS)}::text, ${q(newS)}::text, ${q(exp)}::text)`)

console.log(`-- ============================================================
-- 出欠登録期間: DB 関数とアプリ（src/lib/registration.ts）の一致確認
--
-- このファイルは自動生成（BadAttend リポジトリで
--   node scripts/check-registration-window.mjs > ../BadAttend-db/check_registration_window.sql
-- ）。ケースを変えるときは tests/registration-cases.mjs を直して再生成する。
--
-- 実行手順: migration_registration_policy.sql を実行したあと、
--   Supabase SQL Editor で全文を実行する。全行 ok = true なら一致している
--   （ok = false の行が先頭に並ぶ）。読み取りのみで、データは変更しない。
-- ============================================================

SELECT * FROM (
SELECT
  'window' AS kind,
  c.label,
  (r.mode = c.exp_mode AND r.opens_at = c.exp_opens AND r.closes_at = c.exp_closes) AS ok,
  format('%s / %s 〜 %s', r.mode, r.opens_at AT TIME ZONE 'Asia/Tokyo', r.closes_at AT TIME ZONE 'Asia/Tokyo') AS actual
FROM (VALUES
${windowRows.join(',\n')}
) AS c(label, d, strict_start, biweekly_start, exp_mode, exp_opens, exp_closes)
CROSS JOIN LATERAL public.registration_window_calc(c.d, c.strict_start, c.biweekly_start) r

UNION ALL

SELECT
  'self_check' AS kind,
  c.label,
  public.registration_self_check(c.now_at, c.d, c.strict_start, c.biweekly_start, c.old_status, c.new_status)
    IS NOT DISTINCT FROM c.expected AS ok,
  coalesce(public.registration_self_check(c.now_at, c.d, c.strict_start, c.biweekly_start, c.old_status, c.new_status), '(許可)') AS actual
FROM (VALUES
${selfRows.join(',\n')}
) AS c(label, now_at, d, strict_start, biweekly_start, old_status, new_status, expected)
) t
ORDER BY ok, kind, label;`)
