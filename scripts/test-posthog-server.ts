/**
 * Test script to verify PostHog server-side events work correctly.
 * Run with: bun scripts/test-posthog-server.ts
 */
import { PostHog } from 'posthog-node'

async function main() {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!apiKey) {
    console.error('NEXT_PUBLIC_POSTHOG_KEY is not set')
    process.exit(1)
  }

  console.log('Creating PostHog client...')
  const posthog = new PostHog(apiKey, {
    host,
    flushAt: 1,
    flushInterval: 0,
  })

  const testSessionId = `test-session-${Date.now()}`

  console.log(`Firing test booking_confirmed event with session_id: ${testSessionId}`)

  posthog.capture({
    distinctId: testSessionId,
    event: 'booking_confirmed_test',
    properties: {
      session_id: testSessionId,
      flow_id: 'test',
      booking_time: new Date().toISOString(),
      booking_type: 'Test Booking',
      email: 'test@example.com',
      test: true,
    },
  })

  console.log('Flushing events...')
  await posthog.flush()

  console.log('Shutting down...')
  await posthog.shutdown()

  console.log('Done! Check PostHog for event: booking_confirmed_test')
  console.log(`Look for session_id: ${testSessionId}`)
}

main().catch(console.error)
