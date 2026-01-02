import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Creates a basic Supabase client without Clerk authentication.
 *
 * **DEPRECATED:** Prefer createClerkSupabaseClient() from '@/lib/supabase-clerk-server'
 *
 * **USE THIS FOR:**
 * - Legacy code (migrate to createClerkSupabaseClient)
 * - Public data access (no auth required)
 * - Server Components without Clerk context (rare)
 *
 * **DON'T USE FOR:**
 * - Authenticated user requests (use createClerkSupabaseClient)
 * - Admin operations (use createServiceClient)
 *
 * **NOTE:** This client still respects RLS, but without Clerk JWT claims,
 * most policies will deny access. For authenticated operations, use
 * createClerkSupabaseClient() which passes the Clerk JWT.
 *
 * @deprecated Use createClerkSupabaseClient() for authenticated operations
 */
export const createClient = () => {
  const cookieStore = cookies()

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
    }
  )
}

/**
 * Creates a Supabase client with service role permissions.
 *
 * ⚠️ **WARNING: BYPASSES ALL ROW LEVEL SECURITY (RLS) POLICIES** ⚠️
 *
 * This client has full database access and ignores all RLS restrictions.
 * Use with extreme caution and ONLY for system-level operations.
 *
 * **USE THIS FOR:**
 * - Webhook handlers (creating/deleting user_profile records)
 * - Middleware fallback (ensuring profiles exist)
 * - Admin operations requiring cross-org access
 * - Database migrations and maintenance scripts
 * - Background jobs that need full access
 *
 * **NEVER USE FOR:**
 * - Regular user API requests (use createClerkSupabaseClient)
 * - Client-facing operations (will leak data across orgs!)
 * - Any operation where auth context exists
 *
 * **SECURITY IMPLICATIONS:**
 * - Can read/write ANY data in ANY organization
 * - Bypasses clerk_org_id filtering
 * - No audit trail of which user made changes
 * - If exposed to client, catastrophic security breach
 *
 * **BEST PRACTICES:**
 * - Always validate input data yourself (RLS won't protect you)
 * - Log all service client operations for audit
 * - Never pass service client to untrusted code
 * - Use createClerkSupabaseClient() whenever possible
 *
 * @example
 * ```typescript
 * // ✅ Good: Webhook creating user profile (system operation)
 * export async function POST(req: Request) {
 *   const evt = verifyClerkWebhook(req) // Verify it's actually from Clerk
 *   const supabase = createServiceClient()
 *   await supabase.from('user_profile').insert({
 *     clerk_user_id: evt.data.user.id,
 *     clerk_org_id: evt.data.organization.id
 *   })
 * }
 *
 * // ❌ Bad: User request handler (leaks data!)
 * export async function GET() {
 *   const supabase = createServiceClient()
 *   const { data } = await supabase.from('mentor_bot').select('*')
 *   return Response.json(data) // Returns ALL orgs' bots!
 * }
 * ```
 *
 * @see docs/CLERK_INTEGRATION.md for client usage guide
 */
export const createServiceClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * Validates that a resource belongs to the specified organization
 * Returns the resource if authorized, null otherwise
 *
 * @param table - The database table name
 * @param resourceId - The resource ID to validate
 * @param orgId - The Clerk organization ID to validate against
 * @param orgColumnName - The organization column name (default: 'clerk_org_id')
 * @returns The resource if authorized, null otherwise
 */
export async function requireOrgResource<T = any>(
  table: string,
  resourceId: string,
  orgId: string,
  orgColumnName: string = 'clerk_org_id'
): Promise<T | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', resourceId)
    .eq(orgColumnName, orgId)
    .single()

  if (error || !data) {
    return null
  }

  return data as T
}

/**
 * Validates that a resource belongs to the specified user
 * Returns the resource if authorized, null otherwise
 *
 * @param table - The database table name
 * @param resourceId - The resource ID to validate
 * @param userId - The Clerk user ID to validate against
 * @returns The resource if authorized, null otherwise
 */
export async function requireUserResource<T = any>(
  table: string,
  resourceId: string,
  userId: string
): Promise<T | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', resourceId)
    .eq('clerk_user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data as T
}