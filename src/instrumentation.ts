import type { Instrumentation } from 'next'
import { notifyAdminError } from '@/lib/alert'

// 画面・API・Server Action・proxy で、どこにも catch されずに投げられた例外は
// すべてここに集まる（Next.js の onRequestError）。
// try/catch で受け止めて 500 を返しているエラーはここに来ないので、
// それぞれの catch で notifyAdminError を呼んでいる。
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // クエリ文字列にはトークン等が入りうるので、パスだけを送る
  const path = request.path.split('?')[0]
  await notifyAdminError(`${request.method} ${path}（${context.routeType}）`, err)
}
