import { NextResponse } from 'next/server'
import { db, Session } from '@/lib/db'
import { maybeQueueContactWebhook } from '@/lib/webhook'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/session/[id] - get session by ID
export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params

  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PATCH /api/session/[id] - update session (contact info + context)
export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json()

  // Get existing session
  const { data: existing, error: fetchError } = await db
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Deep merge context and answers
  const mergedContext = body.context
    ? {
        ...existing.context,
        ...body.context,
        // Deep merge known nested objects
        situation: { ...existing.context?.situation, ...body.context?.situation },
        phase2: { ...existing.context?.phase2, ...body.context?.phase2 },
        phase3: { ...existing.context?.phase3, ...body.context?.phase3 },
        phase4: { ...existing.context?.phase4, ...body.context?.phase4 },
        progress: { ...existing.context?.progress, ...body.context?.progress },
      }
    : existing.context
  const mergedAnswers = body.answers
    ? { ...existing.answers, ...body.answers }
    : existing.answers

  const updateData: Partial<Session> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email
  if (body.phone !== undefined) updateData.phone = body.phone
  if (body.status !== undefined) updateData.status = body.status
  if (body.flow_id !== undefined) updateData.flow_id = body.flow_id
  if (body.current_step_id !== undefined) updateData.current_step_id = body.current_step_id
  if (body.answers !== undefined) updateData.answers = mergedAnswers
  if (body.context !== undefined) updateData.context = mergedContext

  const { data, error } = await db
    .from('sessions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Session update error:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }

  // Queue webhook if contact info was added/updated (non-blocking)
  const contactInfoChanged =
    (body.email !== undefined && body.email !== existing.email) ||
    (body.phone !== undefined && body.phone !== existing.phone) ||
    (body.name !== undefined && body.name !== existing.name)

  if (contactInfoChanged) {
    maybeQueueContactWebhook(data as Session).catch((err) => {
      console.error('[webhook] Failed to queue contact webhook:', err)
    })
  }

  return NextResponse.json(data)
}
