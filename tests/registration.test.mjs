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
  sessionTimeAt,
  absenceDeadline,
  tardyDeadline,
  isPastDeadline,
  absenceClosedMessage,
  tardyClosedMessage,
  arrivalTimeLimit,
  arrivalTimeOptions,
  LEGACY_ARRIVAL_TIMES,
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

    describe('当日の連絡締切', () => {
      it('練習日の時刻は JST（秒なしも可）', () => {
        assert.equal(sessionTimeAt('2026-09-30', '17:00:00').toISOString(), new Date(J('2026-09-30T17:00:00')).toISOString())
        assert.equal(sessionTimeAt('2026-09-30', '09:30').toISOString(), new Date(J('2026-09-30T09:30:00')).toISOString())
      })

      const CASES = [
        // [ラベル, 現在時刻（JST）, 練習日, 開始, 終了, 欠席の締切後か, 遅刻の締切後か]
        ['開始1分前',                    '2026-09-30T16:59:00', '2026-09-30', '17:00:00', '20:00:00', false, false],
        ['開始ちょうど',                 '2026-09-30T17:00:00', '2026-09-30', '17:00:00', '20:00:00', true,  false],
        ['終了1時間前の1分前（18:59）',  '2026-09-30T18:59:00', '2026-09-30', '17:00:00', '20:00:00', true,  false],
        ['終了1時間前ちょうど（19:00）', '2026-09-30T19:00:00', '2026-09-30', '17:00:00', '20:00:00', true,  true],
        ['前日の夜',                     '2026-09-29T23:00:00', '2026-09-30', '17:00:00', '20:00:00', false, false],
        ['午前の練習・JST 8:59（UTC だと前日）', '2026-09-30T08:59:00', '2026-09-30', '09:00:00', '12:00:00', false, false],
        ['午前の練習・10:59',            '2026-09-30T10:59:00', '2026-09-30', '09:00:00', '12:00:00', true,  false],
        ['午前の練習・11:00',            '2026-09-30T11:00:00', '2026-09-30', '09:00:00', '12:00:00', true,  true],
        ['翌日',                         '2026-10-01T00:00:00', '2026-09-30', '17:00:00', '20:00:00', true,  true],
        ['時刻が未設定',                 '2026-09-30T23:00:00', '2026-09-30', null,       null,       false, false],
      ]
      for (const [label, now, date, start, end, absenceClosed, tardyClosed] of CASES) {
        it(label, () => {
          const t = new Date(J(now))
          assert.equal(isPastDeadline(t, absenceDeadline(date, start)), absenceClosed)
          assert.equal(isPastDeadline(t, tardyDeadline(date, end)), tardyClosed)
        })
      }

      it('表示文の前半は DB のエラーメッセージと同じ', () => {
        assert.ok(absenceClosedMessage(absenceDeadline('2026-09-30', '17:00:00')).startsWith('練習開始（17:00）を過ぎたため、欠席の連絡はできません'))
        assert.ok(tardyClosedMessage(tardyDeadline('2026-09-30', '20:00:00')).startsWith('練習終了の1時間前（19:00）を過ぎたため、遅刻の連絡はできません'))
      })
    })

    describe('遅刻の参加予定時刻', () => {
      it('上限は練習終了の1時間前、授業なら30分前', () => {
        assert.equal(arrivalTimeLimit('20:00:00', 'sick'), '19:00')
        assert.equal(arrivalTimeLimit('20:00:00', null), '19:00')
        assert.equal(arrivalTimeLimit('20:00:00', 'class'), '19:30')
        assert.equal(arrivalTimeLimit('12:00', 'class'), '11:30')
        assert.equal(arrivalTimeLimit(null, 'class'), null)
      })
      it('17〜20時の練習：17:30 から 19:00 まで（授業なら 19:30 まで）', () => {
        assert.deepEqual(arrivalTimeOptions('17:00:00', '20:00:00', 'personal'), ['17:30', '18:00', '18:30', '19:00'])
        assert.deepEqual(arrivalTimeOptions('17:00:00', '20:00:00', 'class'), ['17:30', '18:00', '18:30', '19:00', '19:30'])
      })
      it('午前の練習（9〜12時）でも選択肢がある', () => {
        assert.deepEqual(arrivalTimeOptions('09:00:00', '12:00:00', 'other'), ['09:30', '10:00', '10:30', '11:00'])
      })
      it('短い練習（17〜19時）', () => {
        assert.deepEqual(arrivalTimeOptions('17:00', '19:00', 'sick'), ['17:30', '18:00'])
      })
      it('時刻が空の練習は今までの 15:00〜22:00', () => {
        assert.deepEqual(arrivalTimeOptions(null, null, 'class'), LEGACY_ARRIVAL_TIMES)
        assert.equal(LEGACY_ARRIVAL_TIMES[0], '15:00')
        assert.equal(LEGACY_ARRIVAL_TIMES.at(-1), '22:00')
        assert.equal(LEGACY_ARRIVAL_TIMES.length, 15)
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
