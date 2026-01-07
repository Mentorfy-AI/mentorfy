import { NextResponse } from 'next/server'
import { db, Session } from '@/lib/db'
import { getContainerId } from '@/lib/supermemory'

// POST /api/session - create a new session (for authenticated users)
export async function POST(req: Request) {
  try {
    const { clerk_org_id, clerk_user_id, context, flow_id } = await req.json()

    if (!clerk_org_id) {
      return NextResponse.json({ error: 'clerk_org_id required' }, { status: 400 })
    }

    if (!flow_id) {
      return NextResponse.json({ error: 'flow_id required' }, { status: 400 })
    }

    const sessionId = crypto.randomUUID()
    const supermemoryContainer = getContainerId(clerk_org_id, sessionId)

    const { data, error } = await db
      .from('sessions')
      .insert({
        id: sessionId,
        clerk_org_id,
        clerk_user_id: clerk_user_id || null,
        flow_id,
        supermemory_container: supermemoryContainer,
        status: 'active',
        context: context || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Session create error:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ sessionId: data.id, supermemoryContainer })
  } catch (err) {
    console.error('Session POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
