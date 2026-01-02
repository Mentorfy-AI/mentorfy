import { createServiceClient } from '@/lib/supabase-server'

/**
 * Ensures a user_profile exists for the given user and org.
 * This is a fallback mechanism in case webhooks fail or are delayed.
 *
 * Called by middleware on every authenticated request.
 * Uses efficient check-then-create pattern to minimize database writes.
 */
export async function ensureUserProfile(
  clerkUserId: string,
  clerkOrgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use service client to bypass RLS (we're creating system records)
    const supabase = createServiceClient()

    // Check if profile already exists
    const { data: existing, error: checkError } = await supabase
      .from('user_profile')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .eq('clerk_org_id', clerkOrgId)
      .maybeSingle()

    if (checkError) {
      console.error('[ensureUserProfile] Check failed:', checkError)
      return { success: false, error: checkError.message }
    }

    // Profile exists, nothing to do
    if (existing) {
      return { success: true }
    }

    // Profile doesn't exist, create it
    const { error: insertError } = await supabase.from('user_profile').insert({
      clerk_user_id: clerkUserId,
      clerk_org_id: clerkOrgId,
      summary: null,
      metadata: {},
    })

    if (insertError) {
      // Ignore unique constraint violations (race condition with webhook)
      if (insertError.code === '23505') {
        console.log('[ensureUserProfile] Profile created by webhook (race condition)')
        return { success: true }
      }

      console.error('[ensureUserProfile] Insert failed:', insertError)
      return { success: false, error: insertError.message }
    }

    console.log(`[ensureUserProfile] Created profile for user ${clerkUserId} in org ${clerkOrgId}`)
    return { success: true }
  } catch (error) {
    console.error('[ensureUserProfile] Unexpected error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Ensures an organization record exists in the database.
 * This is a fallback in case organization webhooks fail.
 *
 * Note: Organization name is not available from JWT, so we use a placeholder.
 * The webhook will update it with the real name when it fires.
 */
export async function ensureOrganization(
  clerkOrgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient()

    // Idempotent upsert - safe to run multiple times
    const { error } = await supabase.from('organization').upsert(
      {
        clerk_org_id: clerkOrgId,
        name: `Organization ${clerkOrgId}`, // Placeholder until webhook updates it
        settings: {},
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'clerk_org_id',
        ignoreDuplicates: true, // Don't overwrite existing name
      }
    )

    if (error) {
      console.error('[ensureOrganization] Upsert failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[ensureOrganization] Unexpected error:', error)
    return { success: false, error: String(error) }
  }
}
