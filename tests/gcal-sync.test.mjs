// Googleカレンダー同期の間引き（src/lib/gcal-sync.ts）のテスト
//
//   npm test

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SYNC_INTERVAL_MS, isRecentlySynced, monthStartStr } from '../src/lib/gcal-sync.ts'

describe('monthStartStr', () => {
  it('月の1日を YYYY-MM-DD で返す', () => {
    assert.equal(monthStartStr(2026, 10), '2026-10-01')
    assert.equal(monthStartStr(2027, 1), '2027-01-01')
  })
})

describe('isRecentlySynced', () => {
  const now = Date.parse('2026-10-29T06:00:00Z')
  const ago = ms => new Date(now - ms).toISOString()

  it('記録なしは同期する', () => {
    assert.equal(isRecentlySynced(null, now), false)
    assert.equal(isRecentlySynced(undefined, now), false)
    assert.equal(isRecentlySynced('', now), false)
  })

  it('読めない値は同期する', () => {
    assert.equal(isRecentlySynced('not a date', now), false)
  })

  it('間隔内なら同期しない', () => {
    assert.equal(isRecentlySynced(ago(0), now), true)
    assert.equal(isRecentlySynced(ago(SYNC_INTERVAL_MS - 1), now), true)
  })

  it('間隔を過ぎたら同期する', () => {
    assert.equal(isRecentlySynced(ago(SYNC_INTERVAL_MS), now), false)
    assert.equal(isRecentlySynced(ago(60 * 60 * 1000), now), false)
  })

  it('未来の時刻（時計のずれ）は同期する', () => {
    assert.equal(isRecentlySynced(ago(-1000), now), false)
  })

  it('Supabase の timestamptz 形式（+00:00）も読める', () => {
    assert.equal(isRecentlySynced('2026-10-29T05:58:00.123+00:00', now), true)
  })
})
