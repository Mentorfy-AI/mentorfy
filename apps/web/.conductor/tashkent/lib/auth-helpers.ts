import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from './supabase-clerk-server'

/**
 * Gets the current authenticated user's context from Clerk
 * Returns userId, orgId, and orgRole
 */
export async function getCurrentUser() {
  const { userId, orgId, orgRole } = await auth()
  return { userId, orgId, orgRole }
}

/**
 * Checks if the current user is a super admin
 * Super admins have platform-wide access
 * Uses Supabase super_admin table as single source of truth
 */
export async function isSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return false

  // Check super_admin table (single source of truth)
  // Use service client to bypass RLS
  const { createServiceClient } = await import('./supabase-server')
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('super_admin')
    .select('clerk_user_id')
    .eq('clerk_user_id', userId)
    .single()

  return !!data
}

/**
 * Requires user to be authenticated
 * Throws error if not authenticated
 * Returns userId, orgId, and orgRole
 */
export async function requireAuth() {
  const { userId, orgId, orgRole } = await auth()
  if (!userId) {
    throw new Error('Unauthorized')
  }
  return { userId, orgId, orgRole }
}

/**
 * Requires user to have an active organization
 * Throws error if no active organization
 */
export async function requireOrg() {
  const { orgId, orgRole } = await auth()

  if (!orgId) {
    throw new Error('No active organization')
  }
  return { orgId, orgRole }
}

/**
 * Requires user to be an admin or team member in their organization
 * Throws error if user is a student or has no org access
 */
export async function requireOrgAdmin() {
  const { orgRole } = await requireOrg()
  if (orgRole !== 'org:admin' && orgRole !== 'org:team_member') {
    throw new Error('Admin or team member access required')
  }
}

/**
 * Checks if user has admin or team member role
 */
export async function isOrgAdmin() {
  const { orgRole } = await auth()
  return orgRole === 'org:admin' || orgRole === 'org:team_member'
}

/**
 * Checks if user has student role
 */
export async function isStudent() {
  const { orgRole } = await auth()
  return orgRole === 'org:student'
}
