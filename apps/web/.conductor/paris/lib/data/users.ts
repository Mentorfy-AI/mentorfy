import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'
import { getClerkUsers } from '@/lib/clerk-server'

export async function getUserProfiles() {
  const supabase = await createClerkSupabaseClient()

  const { data, error } = await supabase
    .from('user_metrics')
    .select('*')
    .order('last_active', { ascending: false, nullsFirst: false })

  if (error) throw error

  // Enrich with Clerk data (names, emails)
  const profiles = data || []
  if (profiles.length === 0) return profiles

  const clerkUserIds = profiles.map(p => p.clerk_user_id)
  const clerkUsers = await getClerkUsers(clerkUserIds)

  return profiles.map(profile => {
    const clerkUser = clerkUsers.get(profile.clerk_user_id)
    return {
      ...profile,
      first_name: clerkUser?.firstName || null,
      last_name: clerkUser?.lastName || null,
      email: clerkUser?.email || null,
      image_url: clerkUser?.imageUrl || null,
    }
  })
}

/**
 * Gets a user profile by Clerk user ID
 * @param clerkUserId - Clerk user ID (e.g., "user_2xyz...")
 * @returns User profile with metrics (conversation count, message count, etc.)
 */
export async function getUserProfile(clerkUserId: string) {
  const supabase = await createClerkSupabaseClient()

  const { data, error } = await supabase
    .from('user_metrics')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error) throw error

  // Enrich with Clerk data
  const clerkUsers = await getClerkUsers([clerkUserId])
  const clerkUser = clerkUsers.get(clerkUserId)

  return {
    ...data,
    first_name: clerkUser?.firstName || null,
    last_name: clerkUser?.lastName || null,
    email: clerkUser?.email || null,
    image_url: clerkUser?.imageUrl || null,
  }
}

/**
 * Updates a user profile by Clerk user ID
 * @param clerkUserId - Clerk user ID (e.g., "user_2xyz...")
 * @param updates - Fields to update (summary, metadata)
 * @returns Updated user profile
 */
export async function updateUserProfile(
  clerkUserId: string,
  updates: {
    summary?: string
    metadata?: any
  }
) {
  const supabase = await createClerkSupabaseClient()

  const { data, error } = await supabase
    .from('user_profile')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', clerkUserId)
    .select()
    .single()

  if (error) throw error
  return data
}
