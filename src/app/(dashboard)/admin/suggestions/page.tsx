import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Inbox, MessageSquarePlus } from 'lucide-react'

interface Suggestion {
  id: string
  title: string
  body: string
  created_at: string
}

export default async function AdminSuggestionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!myProfile || myProfile.role !== 'admin') redirect('/dashboard')

  const { data: suggestions } = await supabase
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  const items = (suggestions ?? []) as Suggestion[]

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="animate-slide-up">
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ color: 'var(--gray-900)', letterSpacing: '-0.04em' }}
        >
          意見箱の確認
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
          部員から届いた匿名の意見・要望 （{items.length} 件）
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 animate-slide-up">
          <Inbox size={32} style={{ color: 'var(--gray-300)' }} />
          <p className="font-semibold" style={{ color: 'var(--gray-500)' }}>
            まだ意見が届いていません
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((s, i) => (
            <div
              key={s.id}
              className="card animate-slide-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: '#dcfce7', color: '#16a34a' }}
                >
                  <MessageSquarePlus size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: 'var(--gray-900)' }}>
                    {s.title}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--gray-500)' }}
                  >
                    {new Date(s.created_at).toLocaleString('ja-JP', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <p
                    className="text-sm mt-2 leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--gray-700)' }}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
