# タスク02：ドタキャン（出席・遅刻で登録したのに無連絡で欠席）への処罰

> 共通ルール（Next.js ドキュメントの確認、SQL の置き場所、コミット方法）は [README.md](README.md) を参照。

## 背景

練習の出欠を「出席」または「遅刻」で登録しておきながら、当日に何の連絡もなく来ない部員がいる。事前に欠席連絡した人や、当日欠席を連絡した人より悪質なので、区別して処罰したい。

## 現状の仕組み（実装前に自分でもコードを読んで確認すること）

- `attendance_records.status`：部員が自己申告したステータス（`present` / `tardy` / `absent_normal` / `absent_emergency` / `absent_unreported`）。
- `attendance_records.result_status`：管理者・マネージャーが確定した実績。確定処理は `src/app/(dashboard)/calendar/CalendarView.tsx` にある（`handleUpdateResultStatus`・`handleBulkConfirm`・`handleClearResultStatus`・`handleRevertAll`。340〜520行目付近）。
- 未提出者の行は `status = 'absent_unreported'` で作られる。作られるのは次の2通り。
  - 一括確定（`handleBulkConfirm`）：通常練習では、未提出者全員に `status = result_status = 'absent_unreported'` の行を自動で作る（タスク04で追加）
  - 未提出者を1人ずつ実績登録する（`handleRegisterResultForUnsubmitted`）
- **ドタキャンは次の条件で判定できる：** `status IN ('present','tardy') AND result_status = 'absent_unreported'`。
  - 未提出者の行は `status` も `absent_unreported` なので、この条件に当たらない。「未提出の無連絡欠席」と「ドタキャン」はこの条件で区別できる。
  - UI 上では実績「無連絡欠席」を選べばこの状態になるが、専用のラベルや集計はまだない。
- 使えそうな既存の仕組み：
  - `profiles.lockout_until`：体調不良ロック。**⚠️ 今は動いていない可能性が高い。**
    - 値を設定していたのはポイント計算のトリガー `calc_points_on_attendance`（`schema.sql`・`fix_security.sql`）だけで、このトリガーは `migration_remove_points.sql` で削除されている。
    - アプリ側で参照しているのはホーム画面のバナーだけ（`dashboard/page.tsx:167` 付近）。`CalendarView.tsx` も DB のトリガーも、ロック中の出欠登録を止めていない。
    - 本番 DB で確認する：`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.attendance_records'::regclass AND NOT tgisinternal;` と、`lockout_until` が入っている部員がいるか。
    - 案 B（参加制限）を選ぶ場合は、この仕組みを作り直すことになる（登録の制限は、04 の `enforce_registration_window` と同じく DB トリガーで行うのがよい）。README と `/rules` の「体調不良ロック」の記述が実態と合っていないことも、ユーザーに伝える。
  - `warning_flags` テーブル：`flag_type = 'absent_no_report'` と `severity`（`warning` / `final_warning` / `expelled`）がある。ダッシュボードで未解決のフラグを読んでいる（`dashboard/page.tsx:56`）。README には「注意勧告フラグの管理」と書かれているが、管理UIの実装状況は要確認。RLS ポリシーが古いロール `captain` を参照している（`schema.sql:234`）ので、最新の fix ファイルでどう上書きされているかも確認する。
  - `v_selection_scores`：`unreported_count` を集計している。選考スコアへの影響は最新の定義（`../BadAttend-db/migration_fix_v_selection_scores_v5.sql` など）で確認する。

## タスク04で入ったもの（2026-09-30 の練習から適用）

02 の設計に関わるので、実装前に目を通すこと。詳しくは `04_registration-policy.md` と `src/lib/registration.ts`。

- **登録期間の DB 強制**：`attendance_records` の BEFORE INSERT/UPDATE トリガー `enforce_registration_window`（`../BadAttend-db/migration_registration_policy.sql`）。部員本人による次の操作を拒否する。
  - 期間外（締切は練習日より前の直近の火曜 23:59）の新規登録
  - 締切後の、欠席・遅刻以外への変更（許可は「出席→遅刻・欠席」「遅刻→欠席」と、ステータスを変えない修正のみ）
  - **練習日（JST）を過ぎた後の変更すべて**。事後に「出席」を「欠席」へ書き換えてドタキャンを隠すことは、本人にはできない
  - manager / admin と service_role、合宿・部会・自主練・休止は対象外
- **当日の欠席**は今までどおり `absent_emergency`（`result_status` も即確定）で、LINE グループに通知される。
- **未提出者は練習に参加できない**ルールになった。実績確定時に自動で無連絡欠席になる（上記）。
- 既存のトリガー `protect_attendance_results`（`migration_security_hardening.sql`）も、部員による `result_status` / `verified_by` の書き換えを防いでいる。02 で `attendance_records` にトリガーを足す場合は、この2つとの順番（トリガー名のアルファベット順に発火する）と、manager/admin がバイパスされる点に注意する。

## ⚠️ 実装前にユーザーに確認すること（AskUserQuestion で聞く）

処罰の中身はまだ決まっていない。以下の案をユーザーに提示して選んでもらい、決まった内容で実装する。複数を組み合わせてもよい。

| 案 | 内容 | 既存の仕組み |
|----|------|------------|
| A. 注意勧告の自動付与 | ドタキャンが確定したら `warning_flags` に `absent_no_report` を自動で付ける。回数に応じて `warning` → `final_warning` と段階を上げる | `warning_flags` |
| B. 参加制限 | 体調不良ロックと同じように、次回（または N 回）の練習に出欠登録できなくする | `lockout_until` |
| C. 選考スコアの減点 | ドタキャン1回ごとに、通常の無連絡欠席より重く減点する | `v_selection_scores` |
| D. 通知 | 本人に LINE で個別通知する。管理者にもまとめて通知する | なし（個別送信の `src/app/api/line/notify` はタスク04で削除済み）。**LINE は無料枠が月200通で、「個人への送信はやめる」方針（タスク05）なので、選ぶ場合は通数への影響も一緒に伝える** |
| E. 可視化のみ | 実績画面と管理画面にドタキャン回数を表示し、処罰は人が判断する | — |

あわせて確認すること：

- 何回目から処罰するか。カウントの期間（学期ごと、年度ごと、累計）
- 自主練習・部会・合宿・休止日を対象にするか（原則は通常練習のみ）
- 処罰の解除方法（管理者が手動で解除する、期間が過ぎたら自動で解除する）
- 部員に向けたルール説明（`/rules` ページ）を更新するか

## 共通して実装すること（どの案でも必要）

1. **ドタキャンを別のステータスとして扱えるようにする。** 方法は次のどちらか（どちらにするかは自分で判断し、理由を書く）。
   - a) 判定条件（`status IN ('present','tardy') AND result_status = 'absent_unreported'`）で導出する。DB 変更が不要
   - b) `result_status` に新しい値 `no_show` を追加する。集計ビューや型、ラベルの修正が広範囲に及ぶ
2. 実績確定画面で、ドタキャンに当たる行にバッジを出す（例：「ドタキャン」）。
3. 管理画面（`/admin/members`）で、メンバーごとのドタキャン回数を見られるようにする。

## DB 変更がある場合

- `../BadAttend-db/migration_no_show_penalty.sql` を作る。
- 自動で処罰する（A/B）場合、実行場所を決める。候補は次の3つ。
  - DB トリガー（`result_status` の更新時）
  - 確定処理のクライアントコードの中
  - API Route
  - 実績の取消（`result_status = null`）をしたときに処罰も取り消す必要があるので、**冪等に作ること**。
- タスク03（AI 問い合わせ機能）はスキーマ説明を持っているので、列を追加した場合は README の「実行順と衝突」に従って共有する。
- 動作確認用の SQL（`check_no_show_penalty.sql` など）も用意する（README の共通ルール参照）。

## 他タスクとの関係

- **タスク04（登録ルールの厳格化）はマージ済み（PR #2）なので、着手できる。** 上の「タスク04で入ったもの」を参照。
- 04 で「未提出者は参加不可」になり、一括確定で未提出者が自動的に無連絡欠席になるようになった。「未提出の無連絡欠席」と「ドタキャン」の区別は、04 の後にはさらに重要になる。
- **タスク05（LINE の通数削減）**：処罰の通知に LINE を使う場合は、05 の方針（個人への送信をやめる）と矛盾しないか確認する。
- **タスク03（AI 問い合わせ）**：列やテーブルを追加した場合は、03 の ai ビューとスキーマ説明にも反映する。

## 完了条件

- [ ] ユーザーが選んだ処罰が、ドタキャンの確定をきっかけに動く
- [ ] 実績を取り消したら、処罰も元に戻る（または手動で戻す手順がある）
- [ ] 事前の欠席連絡・当日欠席・未提出の無連絡欠席は、ドタキャン扱いにならない
- [ ] 自主練習と休止日は対象外
- [ ] `npm test` / `npm run build` が通る（lint は変更したファイルでエラーが増えていないこと）
- [ ] SQL がある場合は、ユーザーに実行を依頼する
