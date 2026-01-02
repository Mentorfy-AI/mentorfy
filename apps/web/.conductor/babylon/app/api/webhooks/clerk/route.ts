import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { WebhookEvent } from '@clerk/nextjs/server'

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET')
  }

  // Verify webhook signature
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new Response('Error: Verification failed', { status: 400 })
  }

  const eventType = evt.type

  try {
    // Organization created/updated - sync to organization table
    if (eventType === 'organization.created' || eventType === 'organization.updated') {
      const { error } = await supabase.from('organization').upsert(
        {
          clerk_org_id: evt.data.id,
          name: evt.data.name,
          settings: {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'clerk_org_id',
        }
      )

      if (error) {
        console.error('Failed to upsert organization:', error)
        throw error
      }

      console.log(`[Webhook] Organization ${evt.data.id} synced`)
    }

    // Organization deleted - clean up organization record
    if (eventType === 'organization.deleted') {
      const { error } = await supabase
        .from('organization')
        .delete()
        .eq('clerk_org_id', evt.data.id)

      if (error) {
        console.error('Failed to delete organization:', error)
        throw error
      }

      console.log(`[Webhook] Organization ${evt.data.id} deleted`)
    }

    // User created - prepare for profile creation when they join an org
    if (eventType === 'user.created') {
      // No action needed - user_profile will be created when they join an org
      console.log(`[Webhook] User ${evt.data.id} created (waiting for org membership)`)
    }

    // Organization membership created - create user_profile
    if (eventType === 'organizationMembership.created') {
      const clerkUserId = evt.data.public_user_data?.user_id
      const clerkOrgId = evt.data.organization.id

      if (!clerkUserId || !clerkOrgId) {
        console.error('Missing user_id or org_id in membership webhook:', evt.data)
        return new Response('Error: Missing required fields', { status: 400 })
      }

      // Idempotent upsert - safe to run multiple times
      const { error } = await supabase.from('user_profile').upsert(
        {
          clerk_user_id: clerkUserId,
          clerk_org_id: clerkOrgId,
          summary: null,
          metadata: {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'clerk_user_id,clerk_org_id',
          ignoreDuplicates: false,
        }
      )

      if (error) {
        console.error('Failed to create user_profile:', error)
        throw error
      }

      console.log(`[Webhook] User profile created for ${clerkUserId} in org ${clerkOrgId}`)
    }

    // Organization membership deleted - remove user_profile
    if (eventType === 'organizationMembership.deleted') {
      const clerkUserId = evt.data.public_user_data?.user_id
      const clerkOrgId = evt.data.organization.id

      if (!clerkUserId || !clerkOrgId) {
        console.error('Missing user_id or org_id in membership deletion webhook:', evt.data)
        return new Response('Error: Missing required fields', { status: 400 })
      }

      const { error } = await supabase
        .from('user_profile')
        .delete()
        .eq('clerk_user_id', clerkUserId)
        .eq('clerk_org_id', clerkOrgId)

      if (error) {
        console.error('Failed to delete user_profile:', error)
        throw error
      }

      console.log(`[Webhook] User profile deleted for ${clerkUserId} in org ${clerkOrgId}`)
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (error) {
    console.error('Webhook processing failed:', error)
    // Return 500 so Clerk retries
    return new Response('Error: Processing failed', { status: 500 })
  }
}
