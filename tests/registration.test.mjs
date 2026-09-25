// 出欠登録期間の計算（src/lib/registration.ts）のテスト
//
//   npm test
//
// 実行環境のタイムゾーンに依存しないことを確かめるため、同じケースを
// UTC（Vercel）・Asia/Tokyo（部員のブラウザ）・America/Los_Angeles で実行する。
// DB 側の関数は、同じケース表から生成した BadAttend-db/check_registration_window.sql で確かめる。

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  getRegistrationWindow,
  getSessionRegistrationState,
  checkSelfChange,
  buildDeadlineNotice,
  formatDeadlineLabel,
  registrationErrorMessage,
  toJstDateStr,
} from '../src/lib/registration.ts'
import { LEGACY, PHASE1, J, WINDOW_CASES, SELF_CASES } from './registration-cases.mjs'

const TIMEZONES = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']

for (const tz of TIMEZONES) {
  describe(`TZ=${tz}`, () => {
    // Node は process.env.TZ の変更を即座に反映する
    before(() => { process.env.TZ = tz })

    describe('getRegistrationWindow', () => {
      for (const [label, date, policy, mode, opens, closes] of WINDOW_CASES) {
        it(label, () => {
          const w = getRegistrationWindow(date, policy)
          assert.equal(w.mode, mode)
          assert.equal(w.opensAt.toISOString(), new Date(opens).toISOString())
          assert.equal(w.closesAt.toISOString(), new Date(closes).toISOString())
        })
      }
    })

    describe('checkSelfChange', () => {
      for (const [label, now, date, policy, oldStatus, newStatus, expected] of SELF_CASES) {
        it(label, () => {
          assert.equal(checkSelfChange(new Date(now), date, policy, oldStatus, newStatus), expected)
        })
      }
    })

    describe('toJstDateStr', () => {
      it('JST 0〜9 時は UTC だと前日だが、JST の日付を返す', () => {
        assert.equal(toJstDateStr(new Date(J('2026-09-30T08:59:59'))), '2026-09-30')
      })
      it('JST 23:59 は当日', () => {
        assert.equal(toJstDateStr(new Date(J('2026-09-29T23:59:59'))), '2026-09-29')
      })
    })

    describe('getSessionRegistrationState', () => {
      it('旧ルールの練習は当日も登録できる', () => {
        const s = getSessionRegistrationState(new Date(J('2026-09-25T20:00:00')), '2026-09-25', LEGACY)
        assert.deepEqual([s.isOpen, s.isSameDay, s.isAfterDeadline], [true, true, true])
      })
      it('新ルールの練習当日（JST 8:00）は締切後で、新規登録できない', () => {
        const s = getSessionRegistrationState(new Date(J('2026-09-30T08:00:00')), '2026-09-30', PHASE1)
        assert.deepEqual([s.isOpen, s.isSameDay, s.isAfterDeadline, s.isPastSession], [false, true, true, false])
      })
      it('9/29 23:58 は受付中', () => {
        const s = getSessionRegistrationState(new Date(J('2026-09-29T23:58:00')), '2026-09-30', PHASE1)
        assert.deepEqual([s.isOpen, s.isSameDay, s.isBeforeOpen], [true, false, false])
      })
      it('受付開始前', () => {
        const s = getSessionRegistrationState(new Date(J('2026-09-25T12:00:00')), '2026-09-30', PHASE1)
        assert.deepEqual([s.isOpen, s.isBeforeOpen], [false, true])
      })
      it('10/1 1:00 JST には 9/30 の練習は過去', () => {
        const s = getSessionRegistrationState(new Date(J('2026-10-01T01:00:00')), '2026-09-30', PHASE1)
        assert.equal(s.isPastSession, true)
      })
    })

    describe('表示文', () => {
      const w = getRegistrationWindow('2026-09-30', PHASE1)
      it('締切は「9/29（火）23:59」', () => {
        assert.equal(formatDeadlineLabel(w.closesAt), '9/29（火）23:59')
      })
      it('エラーメッセージが DB と同じ文面', () => {
        assert.equal(registrationErrorMessage('after_deadline', w), '締切（9/29（火）23:59）を過ぎたため登録できません')
        assert.equal(registrationErrorMessage('before_open', w), '受付開始（9/26（土）00:00）前のため、まだ登録できません')
        assert.equal(registrationErrorMessage('status_not_allowed', w), '締切（9/29（火）23:59）を過ぎたため、欠席・遅刻への変更のみ可能です')
        assert.equal(registrationErrorMessage('after_session', w), '練習日を過ぎたため変更できません')
      })
    })

    describe('buildDeadlineNotice', () => {
      const closesAt = getRegistrationWindow('2026-09-30', PHASE1).closesAt
      const sessions = [
        { date: '2026-10-01', unsubmitted: [{ id: 'a', name: '山田' }] },
        { date: '2026-09-30', unsubmitted: [{ id: 'a', name: '山田' }, { id: 'b', name: '佐藤' }] },
        { date: '2026-10-02', unsubmitted: [] },
      ]

      it('締切前：日付の範囲・締切・未提出の人数（重複を数えない）', () => {
        assert.equal(
          buildDeadlineNotice({ kind: 'before', sessions, closesAt, includeNames: false }),
          [
            '【出欠提出のお願い】',
            '9/30（水）〜10/2（金）の練習の出欠は、9/29（火）23:59 締切です。',
            '未提出：2名',
            'アプリから提出をお願いします。締切後は登録できず、未提出の方は練習に参加できません。',
          ].join('\n'),
        )
      })
      it('締切前：名前を入れる', () => {
        const lines = buildDeadlineNotice({ kind: 'before', sessions, closesAt, includeNames: true }).split('\n')
        assert.equal(lines[3], '（山田、佐藤）')
      })
      it('締切後：日付ごとに未提出者を並べる', () => {
        assert.equal(
          buildDeadlineNotice({ kind: 'after', sessions, closesAt, includeNames: false }),
          [
            '【出欠締切のお知らせ】',
            '9/30（水）〜10/2（金）の練習の出欠を締め切りました。',
            '未提出の方は練習に参加できません。',
            '',
            '・9/30（水）：山田、佐藤',
            '・10/1（木）：山田',
            '・10/2（金）：なし',
          ].join('\n'),
        )
      })
      it('全員提出済み', () => {
        assert.equal(
          buildDeadlineNotice({ kind: 'after', sessions: [{ date: '2026-09-30', unsubmitted: [] }], closesAt, includeNames: false }),
          '【出欠締切のお知らせ】\n9/30（水）の練習の出欠を締め切りました。\n全員提出済みです。ありがとうございました！',
        )
      })
      it('同じ日に練習が2つあっても日付は1行にまとめる', () => {
        const text = buildDeadlineNotice({
          kind: 'after',
          sessions: [
            { date: '2026-09-30', unsubmitted: [{ id: 'a', name: '山田' }] },
            { date: '2026-09-30', unsubmitted: [{ id: 'a', name: '山田' }, { id: 'b', name: '佐藤' }] },
          ],
          closesAt,
          includeNames: false,
        })
        assert.match(text, /^9\/30（水）の練習の出欠を締め切りました。$/m)
        assert.match(text, /^・9\/30（水）：山田、佐藤$/m)
      })
    })
  })
}
