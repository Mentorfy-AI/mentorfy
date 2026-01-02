'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useSession } from '@clerk/nextjs'
import { useMemo } from 'react'

/**
 * Hook to create a Supabase client with Clerk authentication
 * Uses Clerk session token for RLS policies
 */
export function useSupabaseClient() {
  const { session } = useSession()

  return useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            fetch: async (url, options = {}) => {
              // Get Clerk session token - Clerk automatically includes org claims in default JWT
              const clerkToken = await session?.getToken()

              const headers = new Headers(options?.headers)
              if (clerkToken) {
                headers.set('Authorization', `Bearer ${clerkToken}`)
              }

              return fetch(url, {
                ...options,
                headers,
              })
            },
          },
        }
      ),
    [session]
  )
}
