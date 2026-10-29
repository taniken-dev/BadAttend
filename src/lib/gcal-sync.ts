// Googleカレンダー同期の間引き（#33）
// 月ごとの最終同期時刻は gcal_sync_state（BadAttend-db/migration_gcal_sync_state.sql）に持つ

// この時間内に同期済みの月は Google を読みに行かない
export const SYNC_INTERVAL_MS = 5 * 60 * 1000

// gcal_sync_state.month の値（月の1日）。month は 1-indexed
export function monthStartStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

// 最終同期時刻が SYNC_INTERVAL_MS 以内なら true。記録なし・読めない値は false（同期する）
export function isRecentlySynced(syncedAt: string | null | undefined, now: number): boolean {
  if (!syncedAt) return false
  const t = Date.parse(syncedAt)
  if (isNaN(t)) return false
  return now - t >= 0 && now - t < SYNC_INTERVAL_MS
}
