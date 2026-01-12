import { db, Session } from './db'
import { getFlow } from '@/data/flows'

export type WebhookEventType = 'lead.contact-captured'

export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  session: {
    id: string
    flowId: string
    email: string | null
    phone: string | null
    name: string | null
    answers: Record<string, any>
    createdAt: string
  }
}

interface QueueWebhookParams {
  sessionId: string
  flowId: string
  eventType: WebhookEventType
  webhookUrl: string
  payload: WebhookPayload
}

/**
 * Queue a webhook for delivery. The webhook will be processed by the retry
 * Edge Function with automatic retries on failure.
 */
export async function queueWebhook(params: QueueWebhookParams): Promise<void> {
  const { sessionId, flowId, eventType, webhookUrl, payload } = params

  const { error } = await db.from('webhook_queue').insert({
    session_id: sessionId,
    flow_id: flowId,
    event_type: eventType,
    webhook_url: webhookUrl,
    payload,
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[webhook] Failed to queue webhook:', error)
    throw new Error(`Failed to queue webhook: ${error.message}`)
  }
}

/**
 * Build the webhook payload for a lead contact capture event.
 */
export function buildContactCapturedPayload(session: Session): WebhookPayload {
  return {
    event: 'lead.contact-captured',
    timestamp: new Date().toISOString(),
    session: {
      id: session.id,
      flowId: session.flow_id || '',
      email: session.email,
      phone: session.phone,
      name: session.name,
      answers: session.answers || {},
      createdAt: session.created_at,
    },
  }
}

/**
 * Queue a webhook for contact info capture if the flow has a webhookUrl configured.
 * This is a no-op if the flow doesn't have webhooks enabled.
 */
export async function maybeQueueContactWebhook(session: Session): Promise<void> {
  if (!session.flow_id) {
    return
  }

  // Check if we have contact info to send
  if (!session.email && !session.phone && !session.name) {
    return
  }

  let flow
  try {
    flow = getFlow(session.flow_id)
  } catch {
    // Flow not found, skip webhook
    return
  }

  if (!flow.webhookUrl) {
    return
  }

  const payload = buildContactCapturedPayload(session)

  await queueWebhook({
    sessionId: session.id,
    flowId: session.flow_id,
    eventType: 'lead.contact-captured',
    webhookUrl: flow.webhookUrl,
    payload,
  })
}

/**
 * Attempt to deliver a webhook. Returns true if successful, false otherwise.
 * Used by the retry Edge Function.
 */
export async function deliverWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mentorfy-Webhook/1.0',
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      return { success: true, statusCode: response.status }
    }

    const errorText = await response.text().catch(() => 'Unknown error')
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      statusCode: response.status,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error',
    }
  }
}

/**
 * Calculate the next retry time using exponential backoff.
 * Retries: 1min, 5min, 15min, 30min, 60min
 */
export function calculateNextRetryTime(attempts: number): Date {
  const backoffMinutes = [1, 5, 15, 30, 60]
  const minutes = backoffMinutes[Math.min(attempts, backoffMinutes.length - 1)]
  return new Date(Date.now() + minutes * 60 * 1000)
}
