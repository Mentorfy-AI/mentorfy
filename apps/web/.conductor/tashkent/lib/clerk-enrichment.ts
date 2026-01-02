/**
 * Clerk User Enrichment Utilities
 *
 * These functions fetch user details from Clerk API to enrich Supabase data.
 * Use this when displaying user names/emails - never store Clerk data in Supabase.
 *
 * @see docs/DATA_MODEL.md for principles
 * @see docs/CLERK_INTEGRATION.md for integration guide
 */

import { clerkClient } from '@clerk/nextjs/server'

export interface ClerkUserDetails {
  clerk_user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  full_name: string
  initials: string
}

/**
 * Fetches user details from Clerk API
 *
 * @param clerkUserId - Clerk user ID (e.g., "user_2xyz...")
 * @returns User details or null if not found
 */
export async function getClerkUserDetails(
  clerkUserId: string
): Promise<ClerkUserDetails | null> {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(clerkUserId)

    const firstName = user.firstName || null
    const lastName = user.lastName || null
    const email = user.emailAddresses[0]?.emailAddress || null

    // Generate full name
    let fullName = 'Unknown User'
    if (firstName && lastName) {
      fullName = `${firstName} ${lastName}`
    } else if (firstName) {
      fullName = firstName
    } else if (lastName) {
      fullName = lastName
    }

    // Generate initials
    let initials = '??'
    if (firstName && lastName) {
      initials = `${firstName[0]}${lastName[0]}`.toUpperCase()
    } else if (firstName) {
      initials = firstName.substring(0, 2).toUpperCase()
    } else if (lastName) {
      initials = lastName.substring(0, 2).toUpperCase()
    }

    return {
      clerk_user_id: clerkUserId,
      first_name: firstName,
      last_name: lastName,
      email,
      full_name: fullName,
      initials,
    }
  } catch (error) {
    console.error(`Failed to fetch Clerk user ${clerkUserId}:`, error)
    return null
  }
}

/**
 * Fetches multiple users from Clerk API in parallel
 *
 * @param clerkUserIds - Array of Clerk user IDs
 * @returns Map of userId -> user details
 */
export async function getClerkUserDetailsMap(
  clerkUserIds: string[]
): Promise<Map<string, ClerkUserDetails>> {
  // Remove duplicates
  const uniqueIds = [...new Set(clerkUserIds)]

  // Fetch all users in parallel
  const userDetailsPromises = uniqueIds.map((id) => getClerkUserDetails(id))
  const userDetailsArray = await Promise.all(userDetailsPromises)

  // Build map
  const userMap = new Map<string, ClerkUserDetails>()
  userDetailsArray.forEach((details) => {
    if (details) {
      userMap.set(details.clerk_user_id, details)
    }
  })

  return userMap
}

/**
 * Enriches a record with Clerk user details
 *
 * @param record - Record with clerk_user_id field
 * @param userDetails - User details from Clerk
 * @returns Record with user details added
 */
export function enrichWithClerkUser<T extends { clerk_user_id: string }>(
  record: T,
  userDetails: ClerkUserDetails | null | undefined
): T & Partial<ClerkUserDetails> {
  if (!userDetails) {
    return {
      ...record,
      first_name: null,
      last_name: null,
      email: null,
      full_name: 'Unknown User',
      initials: '??',
    }
  }

  return {
    ...record,
    first_name: userDetails.first_name,
    last_name: userDetails.last_name,
    email: userDetails.email,
    full_name: userDetails.full_name,
    initials: userDetails.initials,
  }
}

/**
 * Enriches multiple records with Clerk user details
 *
 * @param records - Array of records with clerk_user_id
 * @param userMap - Map of userId -> user details
 * @returns Array of enriched records
 */
export function enrichManyWithClerkUsers<T extends { clerk_user_id: string }>(
  records: T[],
  userMap: Map<string, ClerkUserDetails>
): Array<T & Partial<ClerkUserDetails>> {
  return records.map((record) => {
    const userDetails = userMap.get(record.clerk_user_id)
    return enrichWithClerkUser(record, userDetails)
  })
}
