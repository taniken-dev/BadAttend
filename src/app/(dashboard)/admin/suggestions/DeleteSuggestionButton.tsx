'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// 意見箱の投稿を削除する（admin のみ。権限は RLS の suggestions_delete_admin でも守る）
export default function DeleteSuggestionButton({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [refreshing, startTransition] = useTransition()
  const busy = deleting || refreshing

  async function handleDelete() {
    if (!window.confirm(`「${title}」を削除しますか？\n削除すると元に戻せません。`)) return
    setDeleting(true)
    // RLS で拒否された場合はエラーにならず 0 件になるため、削除した行を返させて確かめる
    const { data, error } = await createClient()
      .from('suggestions')
      .delete()
      .eq('id', id)
      .select('id')
    setDeleting(false)
    if (error || !data || data.length === 0) {
      alert('削除できませんでした。権限がないか、すでに削除されています。')
      return
    }
    // 一覧と件数をサーバーから取り直す
    startTransition(() => router.refresh())
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      title="削除"
      aria-label="この投稿を削除"
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:opacity-70"
      style={{ color: 'var(--gray-400)', opacity: busy ? 0.5 : 1 }}
    >
      {busy
        ? <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--gray-200)', borderTopColor: 'var(--gray-500)' }} />
        : <Trash2 size={15} />}
    </button>
  )
}
