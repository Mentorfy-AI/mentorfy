import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'
import { getClerkUsers, getOrgMembers } from '@/lib/clerk-server'
import { auth } from '@clerk/nextjs/server'

export interface SupermemoryProfile {
  static: string[]
  dynamic: string[]
}

export async function getUserProfiles() {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No organization context')

  const supabase = await createClerkSupabaseClient()

  // Fetch all org members from Clerk (source of truth for membership)
  const orgMembers = await getOrgMembers(orgId)

  if (orgMembers.length === 0) return []

  // Fetch metrics from Supabase for users who have activity
  const clerkUserIds = orgMembers.map(m => m.userId)
  const { data: metrics, error } = await supabase
    .from('user_metrics')
    .select('*')
    .in('clerk_user_id', clerkUserIds)

  if (error) throw error

  // Create a map of metrics by clerk_user_id
  const metricsMap = new Map(
    (metrics || []).map(m => [m.clerk_user_id, m])
  )

  // Combine Clerk members with Supabase metrics
  return orgMembers.map(member => {
    const userMetrics = metricsMap.get(member.userId)
    return {
      // Clerk data (always available)
      clerk_user_id: member.userId,
      clerk_org_id: orgId,
      first_name: member.firstName,
      last_name: member.lastName,
      email: member.email,
      image_url: member.imageUrl,
      role: member.role,
      // Supabase metrics (may be null if user has no activity)
      id: userMetrics?.id || null,
      summary: userMetrics?.summary || null,
      metadata: userMetrics?.metadata || null,
      conversation_count: userMetrics?.conversation_count || 0,
      message_count: userMetrics?.message_count || 0,
      last_active: userMetrics?.last_active || null,
      created_at: userMetrics?.created_at || null,
      updated_at: userMetrics?.updated_at || null,
    }
  }).sort((a, b) => {
    // Sort by last_active (most recent first), nulls last
    if (!a.last_active && !b.last_active) return 0
    if (!a.last_active) return 1
    if (!b.last_active) return -1
    return new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
  })
}

/**
 * Gets a user profile by Clerk user ID
 * @param clerkUserId - Clerk user ID (e.g., "user_2xyz...")
 * @returns User profile with metrics (conversation count, message count, etc.)
 */
export async function getUserProfile(clerkUserId: string) {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No organization context')

  const supabase = await createClerkSupabaseClient()

  // Fetch Clerk user data first (source of truth)
  const clerkUsers = await getClerkUsers([clerkUserId])
  const clerkUser = clerkUsers.get(clerkUserId)

  if (!clerkUser) {
    throw new Error('User not found')
  }

  // Try to fetch metrics from Supabase (may not exist if user has no activity)
  const { data: metrics } = await supabase
    .from('user_metrics')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()

  return {
    // Clerk data (always available)
    clerk_user_id: clerkUserId,
    clerk_org_id: orgId,
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
    email: clerkUser.email,
    image_url: clerkUser.imageUrl,
    // Supabase metrics (may be null if user has no activity)
    id: metrics?.id || null,
    summary: metrics?.summary || null,
    metadata: metrics?.metadata || null,
    conversation_count: metrics?.conversation_count || 0,
    message_count: metrics?.message_count || 0,
    last_active: metrics?.last_active || null,
    created_at: metrics?.created_at || null,
    updated_at: metrics?.updated_at || null,
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

/**
 * Deletes a user profile by Clerk user ID
 * Note: This only deletes the user_profile record. Related data (conversations, messages)
 * will be handled by database cascade rules or should be manually cleaned up.
 * Clerk user deletion should be handled separately through Clerk API if needed.
 * @param clerkUserId - Clerk user ID (e.g., "user_2xyz...")
 * @returns Deleted user profile
 */
export async function deleteUserProfile(clerkUserId: string) {
  const supabase = await createClerkSupabaseClient()

  const { data, error } = await supabase
    .from('user_profile')
    .delete()
    .eq('clerk_user_id', clerkUserId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Gets a user's Supermemory profile (for mentor viewing)
 * @param clerkUserId - Target user's Clerk user ID
 * @returns Supermemory profile with static and dynamic memories, or null if unavailable
 */
export async function getSupermemoryProfile(clerkUserId: string): Promise<SupermemoryProfile | null> {
  const { orgId } = await auth()
  if (!orgId) {
    throw new Error('Unauthorized: No organization context')
  }

  const apiKey = process.env.SUPERMEMORY_API_KEY
  if (!apiKey) {
    console.error('SUPERMEMORY_API_KEY not configured')
    return null
  }

  const containerTag = `${orgId}-${clerkUserId}`

  try {
    const response = await fetch('https://api.supermemory.ai/v4/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ containerTag }),
    })

    if (!response.ok) {
      console.error('Supermemory API error:', response.status)
      return null
    }

    const data = await response.json()
    const profile = data.profile || data

    return {
      static: profile.static || [],
      dynamic: profile.dynamic || [],
    }
  } catch (error) {
    console.error('Error fetching Supermemory profile:', error)
    return null
  }
}
