import { db, Session } from './db'
import { getFlow } from '@/data/flows'

export type WebhookEventType = 'lead.contact-captured'
export type WebhookFormat = 'json' | 'slack'

/**
 * Webhook payload sent when a lead submits contact information.
 *
 * Delivered via POST with headers:
 * - Content-Type: application/json
 * - User-Agent: Mentorfy-Webhook/1.0
 *
 * Delivery includes automatic retries with exponential backoff:
 * 1min, 5min, 15min, 30min, 60min (max 5 attempts)
 *
 * @example
 * ```json
 * {
 *   "event": "lead.contact-captured",
 *   "timestamp": "2026-01-12T05:16:10.065Z",
 *   "session": {
 *     "id": "ea8d268a-753d-47cd-a447-8b443a8a3446",
 *     "flowId": "blackbox",
 *     "email": "user@example.com",
 *     "phone": "555-123-4567",
 *     "name": "John Doe",
 *     "answers": {
 *       "assessment.q1": "option-a",
 *       "assessment.q2": "option-b"
 *     },
 *     "createdAt": "2026-01-12T05:10:00.000Z"
 *   }
 * }
 * ```
 */
export interface WebhookPayload {
  /** Event type identifier */
  event: WebhookEventType
  /** ISO 8601 timestamp when the webhook was created */
  timestamp: string
  session: {
    /** Unique session identifier (UUID) */
    id: string
    /** Flow that captured the lead (e.g., "blackbox", "growthoperator") */
    flowId: string
    /** Lead's email address, if provided */
    email: string | null
    /** Lead's phone number, if provided */
    phone: string | null
    /** Lead's name, if provided */
    name: string | null
    /** Assessment answers keyed by question identifier */
    answers: Record<string, any>
    /** ISO 8601 timestamp when the session started */
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
 * Format a webhook payload for the target service.
 * - 'json': Raw structured payload (default, works with Zapier, n8n, custom endpoints)
 * - 'slack': Slack Block Kit format with rich formatting
 */
// Question order for growthoperator flow (Q1-Q17)
const GROWTHOPERATOR_QUESTION_ORDER = [
  'modelTried',        // Q1
  'modelsCount',       // Q2
  'originalMotivation',// Q3
  'bestResult',        // Q4
  'whatHappened',      // Q5
  'duration',          // Q6
  'moneyInvested',     // Q7
  'deeperCost',        // Q8
  'educationSource',   // Q9
  'teacherMoney',      // Q10
  'beliefWhyFailed',   // Q11
  'emotionalState',    // Q12
  'shame',             // Q13
  'whyKeepGoing',      // Q14
  'whatWouldChange',   // Q15
  'urgency',           // Q16
  'biggestFear',       // Q17
]

/**
 * Order answers by question sequence for readable output.
 */
function orderAnswers(answers: Record<string, any>, flowId: string): Record<string, any> {
  const assessment = answers?.assessment
  if (!assessment || flowId !== 'growthoperator') {
    return answers
  }

  const ordered: Record<string, any> = {}
  for (const key of GROWTHOPERATOR_QUESTION_ORDER) {
    if (key in assessment) {
      ordered[key] = assessment[key]
    }
  }
  // Include any extra keys not in the order list
  for (const key of Object.keys(assessment)) {
    if (!(key in ordered)) {
      ordered[key] = assessment[key]
    }
  }
  return { assessment: ordered }
}

export function formatPayloadForDelivery(
  payload: WebhookPayload,
  format: WebhookFormat = 'json'
): Record<string, any> {
  if (format === 'slack') {
    const s = payload.session
    const orderedAnswers = orderAnswers(s.answers, s.flowId)
    const answersJson = JSON.stringify(orderedAnswers, null, 2)
    return {
      text: `New lead: ${s.name || 'Unknown'} (${s.email || 'no email'})`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🎯 New Lead Captured', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Name:*\n${s.name || '_not provided_'}` },
            { type: 'mrkdwn', text: `*Email:*\n${s.email || '_not provided_'}` },
            { type: 'mrkdwn', text: `*Phone:*\n${s.phone || '_not provided_'}` },
            { type: 'mrkdwn', text: `*Flow:*\n${s.flowId}` },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📋 Assessment Answers*\n\`\`\`${answersJson}\`\`\``,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Session: \`${s.id}\` | ${new Date(payload.timestamp).toLocaleString()}` },
          ],
        },
      ],
    }
  }
  return payload
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

  const rawPayload = buildContactCapturedPayload(session)
  const formattedPayload = formatPayloadForDelivery(rawPayload, flow.webhookFormat || 'json')

  await queueWebhook({
    sessionId: session.id,
    flowId: session.flow_id,
    eventType: 'lead.contact-captured',
    webhookUrl: flow.webhookUrl,
    payload: formattedPayload as any,
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
