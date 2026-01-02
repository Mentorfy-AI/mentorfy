import { createServerClient } from '@supabase/ssr'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side operations with Clerk authentication.
 *
 * **USE THIS FOR:** 99% of authenticated operations
 * - API routes that handle user requests
 * - Server Components that need user data
 * - Any operation that should respect Row Level Security (RLS)
 *
 * **HOW IT WORKS:**
 * 1. Gets Clerk session via auth()
 * 2. Extracts JWT token with user/org claims
 * 3. Passes token to Supabase in Authorization header
 * 4. Supabase RLS reads JWT claims (clerk_user_id, clerk_org_id)
 * 5. Automatically filters data by user's organization
 *
 * **IMPORTANT:**
 * - This client respects RLS policies - users only see their org's data
 * - Don't use createServiceClient() for user requests (bypasses RLS)
 * - See docs/CLERK_INTEGRATION.md for full integration guide
 *
 * @example
 * ```typescript
 * // In an API route
 * export async function GET() {
 *   const supabase = await createClerkSupabaseClient()
 *   const { data } = await supabase.from('mentor_bot').select('*')
 *   // RLS automatically filters by user's clerk_org_id
 *   return Response.json(data)
 * }
 * ```
 */
export async function createClerkSupabaseClient() {
  const { getToken } = await auth()
  const token = await getToken()
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: {
        headers: {
          // Native Clerk integration - Supabase validates via Clerk's JWKS
          Authorization: token ? `Bearer ${token}` : '',
        },
      },
    }
  )
}
