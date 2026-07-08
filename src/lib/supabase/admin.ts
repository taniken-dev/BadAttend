import { createClient } from '@supabase/supabase-js'

// service_role キーで RLS をバイパスする管理クライアント。
// サーバー側（API ルート・cron）専用。クライアントに import しないこと。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
