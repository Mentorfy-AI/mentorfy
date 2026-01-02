"use client"

import { useOrganization as useClerkOrganization } from '@clerk/nextjs'

/**
 * Hook to get current organization from Clerk
 * Replaces old Supabase-based organization lookup
 */
export function useOrganization() {
  const { organization, isLoaded } = useClerkOrganization()

  return {
    organizationId: organization?.id ?? null,
    loading: !isLoaded,
    error: null,
  }
}
