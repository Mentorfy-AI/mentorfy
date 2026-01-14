import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getPostHogServer } from '@/lib/posthog-server'

// Calendly webhook event types we handle
type CalendlyEventType = 'invitee.created' | 'invitee.canceled'

interface CalendlyWebhookPayload {
  event: CalendlyEventType
  created_at: string
  payload: {
    event_type: {
      uuid: string
      name: string
    }
    event: {
      uuid: string
      start_time: string
      end_time: string
    }
    invitee: {
      uuid: string
      email: string
      name: string
      cancel_url: string
      reschedule_url: string
    }
    tracking: {
      utm_source?: string
      utm_medium?: string
      utm_campaign?: string
      utm_content?: string
      utm_term?: string
      // Our custom parameter
      session_id?: string
    }
    cancellation?: {
      canceled_by: string
      reason: string
    }
  }
}

function verifyCalendlySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Calendly uses HMAC SHA256 for webhook signatures
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // Signature header format: "v1,<timestamp>,<signature>"
  const parts = signature.split(',')
  if (parts.length !== 3) return false

  const receivedSignature = parts[2]
  return timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature || '')
  )
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CALENDLY_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Get the raw body for signature verification
  const rawBody = await request.text()
  const signature = request.headers.get('calendly-webhook-signature')

  if (!signature) {
    console.error('Missing Calendly webhook signature')
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  // Verify signature
  if (!verifyCalendlySignature(rawBody, signature, webhookSecret)) {
    console.error('Invalid Calendly webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: CalendlyWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error('Invalid JSON in webhook payload')
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { event, payload: data } = payload
  const sessionId = data.tracking?.session_id
  const email = data.invitee?.email

  // Use session_id as distinct_id if available, otherwise fall back to email
  const distinctId = sessionId || email || 'anonymous'

  const posthog = getPostHogServer()

  try {
    if (event === 'invitee.created') {
      posthog.capture({
        distinctId,
        event: 'booking_confirmed',
        properties: {
          session_id: sessionId,
          flow_id: 'growthoperator', // TODO: pass flow_id through tracking params
          booking_time: data.event.start_time,
          booking_type: data.event_type.name,
          email: email,
          event_uuid: data.event.uuid,
          invitee_uuid: data.invitee.uuid,
        },
      })
      console.log(`[Calendly Webhook] booking_confirmed for session: ${sessionId}`)
    } else if (event === 'invitee.canceled') {
      posthog.capture({
        distinctId,
        event: 'booking_canceled',
        properties: {
          session_id: sessionId,
          flow_id: 'growthoperator',
          original_booking_time: data.event.start_time,
          cancellation_reason: data.cancellation?.reason,
          canceled_by: data.cancellation?.canceled_by,
          email: email,
          event_uuid: data.event.uuid,
        },
      })
      console.log(`[Calendly Webhook] booking_canceled for session: ${sessionId}`)
    }

    // Flush immediately to ensure events are sent
    await posthog.flush()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing Calendly webhook:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
