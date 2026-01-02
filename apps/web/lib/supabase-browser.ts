'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useSession } from '@clerk/nextjs'
import { useMemo } from 'react'

/**
 * Hook to create a Supabase client with Clerk authentication
 * Uses Clerk session token for RLS policies
 *
 * IMPORTANT: This hook must only be called after Clerk session is loaded.
 * Check `isLoaded` from useAuth() before using this client.
 */
export function useSupabaseClient() {
  const { session, isLoaded } = useSession()

  // Use useMemo to cache client, but get fresh token on each request
  return useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            fetch: async (url, options = {}) => {
              // CRITICAL: Get fresh session from Clerk on EVERY request, don't use closure
              // This prevents stale JWT tokens when the client is created before Clerk loads
              const freshToken = await window.Clerk?.session?.getToken()

              const headers = new Headers(options?.headers)
              if (freshToken) {
                headers.set('Authorization', `Bearer ${freshToken}`)
              }

              return fetch(url, {
                ...options,
                headers,
              })
            },
          },
        }
      ),
    [] // Empty deps - create once, but get fresh token on each request
  )
}
