import { NextRequest, NextResponse } from 'next/server'
import { auth as googleAuth } from '@googleapis/drive'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'

// Force dynamic rendering for OAuth callback
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Google OAuth request received:', request.nextUrl.toString())
    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')
    console.log('🔍 OAuth code present:', !!code)
    
    // Initialize Supabase client
    const cookieStore = cookies()
    const supabase = createServerClient(
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
              // Ignore cookie errors
            }
          },
        },
      }
    )

    // Check Clerk authentication
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 })
    }

    // Get Supabase user for database operations
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Supabase authentication failed' }, { status: 401 })
    }
    
    // Get OAuth credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ 
        error: 'Google Drive OAuth credentials not configured in environment variables' 
      }, { status: 500 })
    }

    const oauth2Client = new googleAuth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    if (!code) {
      // Step 1: Redirect to Google OAuth
      console.log('🔐 Initiating Google Drive OAuth flow')
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        prompt: 'consent' // Force consent to get refresh token
      })

      return NextResponse.redirect(authUrl)
    } else {
      // Step 2: Handle OAuth callback and save tokens
      console.log('🔄 Processing OAuth callback')
      
      try {
        const { tokens } = await oauth2Client.getToken(code)
        oauth2Client.setCredentials(tokens)

        // Save tokens to database
        const tokenData = {
          user_id: user.id,
          clerk_org_id: orgId,
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token || null,
          token_type: tokens.token_type || 'Bearer',
          expiry_date: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
          scope: tokens.scope || null
        }

        const { error: saveError } = await supabase
          .from('google_drive_tokens')
          .upsert(tokenData, {
            onConflict: 'user_id,clerk_org_id'
          })

        if (saveError) {
          throw new Error(`Failed to save tokens: ${saveError.message}`)
        }

        console.log('✅ Google Drive authentication successful, tokens saved to database')

        // Redirect back to main app with success message
        const redirectUrl = new URL('/', request.nextUrl)
        redirectUrl.searchParams.set('auth', 'success')
        return NextResponse.redirect(redirectUrl.toString())
        
      } catch (error: any) {
        console.error('❌ OAuth token exchange failed:', error)
        
        // Redirect back with error
        const redirectUrl = new URL('/', request.nextUrl)
        redirectUrl.searchParams.set('auth', 'error')
        redirectUrl.searchParams.set('message', encodeURIComponent(error.message || 'Authentication failed'))
        return NextResponse.redirect(redirectUrl.toString())
      }
    }

  } catch (error: any) {
    console.error('❌ Google Drive auth error:', error)
    
    // Redirect back with error
    const redirectUrl = new URL('/', request.nextUrl)
    redirectUrl.searchParams.set('auth', 'error')
    redirectUrl.searchParams.set('message', encodeURIComponent(error.message || 'Authentication failed'))
    return NextResponse.redirect(redirectUrl.toString())
  }
}