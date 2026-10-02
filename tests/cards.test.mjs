// イエロー・レッドカードの表示用の関数（src/lib/cards.ts）のテスト
//
//   npm test
//
// カードの付与としきい値の判定は DB 側にあり、BadAttend-db/check_cards.sql で確かめる。
// ここでは、DB から読んだカードを数える・並べる処理だけを確かめる。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  monthStartOf,
  formatMonthLabel,
  summarizeCards,
  groupCardsByUser,
  sortRedFirst,
  yellowsBehindRed,
} from '../src/lib/cards.ts'

const card = (over) => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  user_id: 'u1',
  color: 'yellow',
  source: 'no_show',
  session_id: null,
  period_month: '2026-11-01',
  seq: null,
  reason: null,
  range_from: null,
  range_to: null,
  created_by: null,
  created_at: '2026-11-05T10:00:00Z',
  resolved_at: null,
  resolved_by: null,
  ...over,
})

describe('monthStartOf / formatMonthLabel', () => {
  it('月初日にする', () => {
    assert.equal(monthStartOf('2026-11-30'), '2026-11-01')
    assert.equal(monthStartOf('2026-01-01'), '2026-01-01')
  })
  it('月の表示', () => {
    assert.equal(formatMonthLabel('2026-11-01'), '11月')
    assert.equal(formatMonthLabel('2027-01-01'), '1月')
  })
})

describe('summarizeCards', () => {
  const cards = [
    card({ color: 'yellow', period_month: '2026-11-01' }),
    card({ color: 'yellow', period_month: '2026-11-01', source: 'manual' }),
    card({ color: 'yellow', period_month: '2026-11-01', resolved_at: '2026-11-10T00:00:00Z' }),
    card({ color: 'yellow', period_month: '2026-10-01' }),
    card({ color: 'red', source: 'yellow_limit', period_month: '2026-10-01', seq: 1 }),
    card({ color: 'red', source: 'yellow_limit', period_month: '2026-09-01', seq: 1, resolved_at: '2026-10-01T00:00:00Z' }),
  ]

  it('イエローは今月の取り消されていない分だけ数える', () => {
    assert.equal(summarizeCards(cards, '2026-11-20').yellowThisMonth, 2)
  })
  it('月が変わるとイエローは0に戻る', () => {
    assert.equal(summarizeCards(cards, '2026-12-01').yellowThisMonth, 0)
  })
  it('レッドは月をまたいで残り、解除したものは数えない', () => {
    assert.equal(summarizeCards(cards, '2026-11-20').redActive, 1)
    assert.equal(summarizeCards(cards, '2027-03-01').redActive, 1)
  })
  it('カードがなければ0枚', () => {
    assert.deepEqual(summarizeCards([], '2026-11-20'), { yellowThisMonth: 0, redActive: 0 })
  })
})

describe('groupCardsByUser', () => {
  it('部員ごとにまとめる', () => {
    const g = groupCardsByUser([card({ user_id: 'a' }), card({ user_id: 'b' }), card({ user_id: 'a' })])
    assert.equal(g.get('a').length, 2)
    assert.equal(g.get('b').length, 1)
    assert.equal(g.get('c'), undefined)
  })
})

describe('sortRedFirst', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  it('レッドの人を先頭にし、それ以外の順番は変えない', () => {
    const red = new Set(['c', 'a'])
    assert.deepEqual(sortRedFirst(list, id => red.has(id)).map(m => m.id), ['a', 'c', 'b', 'd'])
  })
  it('レッドがいなければ元の順', () => {
    assert.deepEqual(sortRedFirst(list, () => false).map(m => m.id), ['a', 'b', 'c', 'd'])
  })
  it('元の配列は変えない', () => {
    sortRedFirst(list, id => id === 'd')
    assert.deepEqual(list.map(m => m.id), ['a', 'b', 'c', 'd'])
  })
})

describe('yellowsBehindRed', () => {
  const red = card({ color: 'red', source: 'yellow_limit', period_month: '2026-11-01', seq: 1 })
  const y1 = card({ id: 'y1', session_id: 's2', period_month: '2026-11-01' })
  const y2 = card({ id: 'y2', session_id: 's1', period_month: '2026-11-01' })
  const y3 = card({ id: 'y3', source: 'manual', period_month: '2026-11-01', created_at: '2026-11-03T00:00:00Z' })
  const other = card({ id: 'y4', period_month: '2026-10-01' })
  const voided = card({ id: 'y5', source: 'manual', period_month: '2026-11-01', resolved_at: '2026-11-04T00:00:00Z' })
  const dates = { s1: '2026-11-02', s2: '2026-11-06' }
  const dateOf = c => (c.session_id ? dates[c.session_id] : null)

  it('同じ月の取り消されていないイエローを、練習日（なければ付けた日）の古い順に並べる', () => {
    assert.deepEqual(
      yellowsBehindRed(red, [y1, y2, y3, other, voided, red], dateOf).map(c => c.id),
      ['y2', 'y3', 'y1'],
    )
  })
  it('連続欠席のレッドには内訳のイエローがない', () => {
    assert.deepEqual(yellowsBehindRed({ source: 'streak', period_month: '2026-11-01' }, [y1, y2], dateOf), [])
  })
})
