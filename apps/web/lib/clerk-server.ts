/**
 * Clerk Server Utilities
 *
 * Server-side helpers for fetching user data from Clerk API.
 * Use these functions to get user details (name, email, etc.) that are NOT stored in Supabase.
 *
 * Design Principle: Clerk owns identity, Supabase owns app data.
 */

import { clerkClient } from '@clerk/nextjs/server'

export interface ClerkUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  imageUrl: string | null
}

/**
 * Fetch user details from Clerk by user ID
 * @param clerkUserId - Clerk user ID (e.g., "user_2xyz...")
 * @returns User details from Clerk, or null if user not found (deleted/orphaned)
 */
export async function getClerkUser(clerkUserId: string): Promise<ClerkUser | null> {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(clerkUserId)

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.emailAddresses[0]?.emailAddress || null,
      imageUrl: user.imageUrl,
    }
  } catch (error: any) {
    // Gracefully handle deleted users (404) - common in multi-tenant apps
    if (error?.status === 404) {
      console.warn(`User ${clerkUserId} not found in Clerk (likely deleted) - skipping enrichment`)
      return null
    }
    console.error(`Failed to fetch Clerk user ${clerkUserId}:`, error)
    return null
  }
}

/**
 * Fetch multiple users from Clerk by user IDs
 * @param clerkUserIds - Array of Clerk user IDs
 * @returns Map of user ID to user details
 */
export async function getClerkUsers(clerkUserIds: string[]): Promise<Map<string, ClerkUser>> {
  const userMap = new Map<string, ClerkUser>()

  // Fetch users in parallel
  const userPromises = clerkUserIds.map(id => getClerkUser(id))
  const users = await Promise.all(userPromises)

  users.forEach((user, index) => {
    if (user) {
      userMap.set(clerkUserIds[index], user)
    }
  })

  return userMap
}

/**
 * Get all members of a Clerk organization
 * @param clerkOrgId - Clerk organization ID
 * @returns Array of organization members with user details
 */
export async function getOrgMembers(clerkOrgId: string) {
  try {
    const client = await clerkClient()
    const allMembers: Array<{
      userId: string
      firstName: string | null
      lastName: string | null
      email: string | null
      imageUrl: string | null
      role: string
    }> = []

    const limit = 500 // Max allowed by Clerk
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const response = await client.organizations.getOrganizationMembershipList({
        organizationId: clerkOrgId,
        limit,
        offset,
      })

      const members = response.data.map(membership => ({
        userId: membership.publicUserData?.userId || '',
        firstName: membership.publicUserData?.firstName || null,
        lastName: membership.publicUserData?.lastName || null,
        email: membership.publicUserData?.identifier || null,
        imageUrl: membership.publicUserData?.imageUrl || null,
        role: membership.role,
      }))

      allMembers.push(...members)

      // Check if there are more pages
      if (response.data.length < limit) {
        hasMore = false
      } else {
        offset += limit
      }
    }

    return allMembers
  } catch (error) {
    console.error(`Failed to fetch org members for ${clerkOrgId}:`, error)
    return []
  }
}
