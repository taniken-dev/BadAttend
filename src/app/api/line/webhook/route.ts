import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const events: { source?: { type?: string; groupId?: string } }[] = body.events ?? []
  for (const event of events) {
    if (event.source?.type === 'group') {
      console.log('LINE GROUP ID:', event.source.groupId)
    }
  }
  return NextResponse.json({ ok: true })
}
