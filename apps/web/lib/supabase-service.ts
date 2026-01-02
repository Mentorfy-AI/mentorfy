import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role key for server-side operations
 * This bypasses RLS and should only be used in secure server contexts (API routes)
 * Use this when you need elevated permissions and have already verified auth/org context
 */
export function createServiceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
