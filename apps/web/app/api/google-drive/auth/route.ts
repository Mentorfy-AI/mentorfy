import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Force dynamic rendering for OAuth callback
export const dynamic = 'force-dynamic'

/**
 * Google Drive OAuth Callback Handler
 *
 * This route acts as a thin proxy to the FastAPI backend for Google Drive OAuth.
 * All OAuth logic has been moved to FastAPI to centralize auth handling.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Google OAuth request received:', request.nextUrl.toString())

    // Get Clerk authentication context
    const { userId, orgId } = await auth()

    if (!userId || !orgId) {
      throw new Error('User authentication required')
    }

    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const popup = searchParams.get('popup')

    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000'

    if (!code) {
      // Phase 1: Redirect to FastAPI to get OAuth URL
      console.log('🔐 Requesting OAuth URL from FastAPI')
      const authUrl = new URL(`${backendUrl}/api/google-drive/auth`)
      authUrl.searchParams.set('user_id', userId)
      authUrl.searchParams.set('org_id', orgId)

      const response = await fetch(authUrl.toString())
      const data = await response.json()

      if (!data.auth_url) {
        throw new Error('Failed to get OAuth URL from backend')
      }

      // Encode popup flag in state parameter that Google will return to us
      // Google officially preserves the state parameter through the OAuth flow
      const googleAuthUrl = new URL(data.auth_url)
      if (popup === 'true' && data.state) {
        // Encode popup flag in state: original_state|popup=true
        googleAuthUrl.searchParams.set('state', `${data.state}|popup=true`)
      }

      console.log('✅ Redirecting to Google OAuth')
      return NextResponse.redirect(googleAuthUrl.toString())
    } else {
      // Phase 2: Exchange code with FastAPI backend
      console.log('🔄 Exchanging code with FastAPI backend')

      // Extract popup flag from state if encoded
      let isPopup = false
      let cleanState = state
      if (state && state.includes('|popup=true')) {
        isPopup = true
        cleanState = state.split('|popup=true')[0]
        console.log('📌 Detected popup mode from state parameter')
      }

      try {
        const callbackUrl = new URL(`${backendUrl}/api/google-drive/auth`)
        callbackUrl.searchParams.set('code', code)
        if (cleanState) callbackUrl.searchParams.set('state', cleanState)
        callbackUrl.searchParams.set('user_id', userId)
        callbackUrl.searchParams.set('org_id', orgId)

        const response = await fetch(callbackUrl.toString())
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'OAuth exchange failed')
        }

        console.log('✅ OAuth successful, tokens stored on backend')

        // If this is a popup request, return success page that closes popup
        if (isPopup) {
          return new NextResponse(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <title>Authentication Successful</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
                  .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                  h1 { margin: 0 0 16px 0; color: #22c55e; font-size: 24px; }
                  p { margin: 0; color: #666; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>✅ Authentication Successful</h1>
                  <p>You can now import documents from Google Drive.</p>
                  <p style="color: #999; font-size: 12px; margin-top: 16px;">This window will close automatically...</p>
                </div>
                <script>
                  // Notify parent window of success
                  if (window.opener) {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*')
                  }
                  // Close popup after 1.5 seconds
                  setTimeout(() => window.close(), 1500)
                </script>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' },
          })
        }

        // Regular redirect back to app with success
        const redirectUrl = new URL('/', request.nextUrl)
        redirectUrl.searchParams.set('auth', 'success')
        return NextResponse.redirect(redirectUrl.toString())

      } catch (error: any) {
        console.error('❌ OAuth exchange error:', error.message)

        // If this is a popup request, return error page that closes popup
        if (isPopup) {
          return new NextResponse(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <title>Authentication Failed</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
                  .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                  h1 { margin: 0 0 16px 0; color: #ef4444; font-size: 24px; }
                  p { margin: 0; color: #666; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>❌ Authentication Failed</h1>
                  <p>${error.message || 'Failed to authenticate with Google Drive'}</p>
                  <p style="color: #999; font-size: 12px; margin-top: 16px;">This window will close automatically...</p>
                </div>
                <script>
                  // Notify parent window of error
                  if (window.opener) {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${error.message}' }, '*')
                  }
                  // Close popup after 3 seconds
                  setTimeout(() => window.close(), 3000)
                </script>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' },
          })
        }

        const redirectUrl = new URL('/', request.nextUrl)
        redirectUrl.searchParams.set('auth', 'error')
        redirectUrl.searchParams.set('message', encodeURIComponent(error.message || 'Authentication failed'))
        return NextResponse.redirect(redirectUrl.toString())
      }
    }

  } catch (error: any) {
    console.error('❌ Google Drive auth error:', error.message)

    const redirectUrl = new URL('/', request.nextUrl)
    redirectUrl.searchParams.set('auth', 'error')
    redirectUrl.searchParams.set('message', encodeURIComponent(error.message || 'Authentication failed'))
    return NextResponse.redirect(redirectUrl.toString())
  }
}