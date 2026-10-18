// サーバーで起きたエラーを管理者の Slack へ知らせる。
// 部員から報告される前に、システム側でエラーに気づくための仕組み。
//
// - 送り先は環境変数 ADMIN_ALERT_SLACK_WEBHOOK_URL の Slack チャンネル（管理者だけが入る）。
//   未設定なら何もしない（ログには console.error が残る）
// - LINE を使わないのは、監視する側と監視される側を同じ経路に乗せないため。
//   LINE の月200通の枠が尽きると LINE の通知はすべて止まるが、その失敗も Slack なら届く
// - 同じ場所のエラーが続いても通知が埋もれないよう、10 分に1回だけ送る

const THROTTLE_MS = 10 * 60 * 1000

// 場所ごとの最終送信時刻。サーバーレスではインスタンスごとに別々に持つので、
// 同時に複数のインスタンスが動いていると、その数だけ届くことはある
const lastSentAt = new Map<string, number>()

export async function notifyAdminError(source: string, error: unknown): Promise<void> {
  const webhookUrl = process.env.ADMIN_ALERT_SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const now = Date.now()
  const last = lastSentAt.get(source)
  if (last !== undefined && now - last < THROTTLE_MS) return
  lastSentAt.set(source, now)

  // Supabase や LINE API のエラーは Error でないこともあるので message を直接見る
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error)
  const digest =
    error && typeof error === 'object' && 'digest' in error ? String(error.digest) : null
  const time = new Date(now).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const text = [
    ':rotating_light: *BadAttend エラー*',
    `場所: ${source}`,
    `時刻: ${time}`,
    `内容: ${message.slice(0, 500)}`,
    ...(digest ? [`digest: ${digest}`] : []),
    '詳細は Vercel のログを確認してください。',
  ].join('\n')

  // 通知の失敗で元の処理を巻き込まないよう、ここで起きた例外は外に出さない
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error('admin alert error:', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('admin alert failed:', e)
  }
}
