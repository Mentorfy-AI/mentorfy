import { drive, auth } from '@googleapis/drive'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface GoogleDriveAuthConfig {
  userId?: string
  organizationId?: string
}

export interface GoogleDriveAuthResult {
  drive: any
  oauth2Client: any
}

export class GoogleDriveAuthService {
  private userId: string | null = null
  private organizationId: string | null = null
  private static instance: GoogleDriveAuthService
  private oauth2Client: any = null
  private drive: any = null
  private lastTokenRefresh: Date | null = null
  private refreshPromise: Promise<void> | null = null
  private retryCount: number = 0
  private maxRetries: number = 3
  private supabase: any = null

  constructor(config: GoogleDriveAuthConfig = {}) {
    this.userId = config.userId || null
    this.organizationId = config.organizationId || null
  }

  private getSupabaseClient() {
    if (!this.supabase && typeof window === 'undefined') {
      // Server-side - initialize only when needed in request context
      const cookieStore = cookies()
      this.supabase = createServerClient(
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
    }
    return this.supabase
  }

  static getInstance(config?: GoogleDriveAuthConfig): GoogleDriveAuthService {
    if (!this.instance) {
      this.instance = new GoogleDriveAuthService(config)
    }
    // Update user/org if provided
    if (config?.userId) this.instance.userId = config.userId
    if (config?.organizationId) this.instance.organizationId = config.organizationId
    return this.instance
  }

  async setUserContext(userId: string, organizationId: string) {
    this.userId = userId
    this.organizationId = organizationId
    // Reset auth state when user context changes
    this.resetAuth()
  }

  /**
   * Get authenticated Google Drive client with automatic token refresh and retry logic
   */
  async getAuthenticatedClient(): Promise<GoogleDriveAuthResult> {
    const startTime = Date.now()
    console.log('🔧 Starting Google Drive authentication...')
    
    try {
      // If we already have a valid client, validate it first
      if (this.oauth2Client && this.drive) {
        console.log('🔍 Checking existing authentication...')
        const isValid = await this.validateToken()
        if (isValid) {
          console.log('✅ Existing authentication is valid')
          this.retryCount = 0 // Reset retry count on success
          return { drive: this.drive, oauth2Client: this.oauth2Client }
        }
        console.log('⚠️ Existing authentication is invalid, re-initializing...')
      }

      // Initialize or re-initialize the client
      await this.initializeClient()
      
      // Ensure token is valid and refresh if needed
      await this.ensureValidToken()
      
      // Validate the token works with a test API call with retry
      await this.validateTokenWithApiCallRetry()

      const duration = Date.now() - startTime
      console.log(`✅ Google Drive authentication successful (${duration}ms)`)
      this.retryCount = 0 // Reset retry count on success
      
      return { drive: this.drive, oauth2Client: this.oauth2Client }

    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`❌ Google Drive authentication failed after ${duration}ms:`, {
        message: error.message,
        status: error.status,
        code: error.code,
        retryCount: this.retryCount
      })
      
      // Increment retry count
      this.retryCount++
      
      // Check if it's an authentication error
      if (error.status === 401 || error.status === 403 || error.message?.includes('authentication') || error.message?.includes('invalid_grant')) {
        throw new GoogleDriveAuthError('AUTHENTICATION_REQUIRED', `Google Drive access has expired. Please re-authenticate. (Attempt ${this.retryCount}/${this.maxRetries})`)
      }
      
      // Check for quota/rate limiting
      if (error.status === 429) {
        throw new GoogleDriveAuthError('TOKEN_REFRESH_ERROR', `Google Drive API quota exceeded. Please try again later. (Attempt ${this.retryCount}/${this.maxRetries})`)
      }
      
      throw new GoogleDriveAuthError('AUTH_SETUP_ERROR', `Google Drive authentication setup failed: ${error.message} (Attempt ${this.retryCount}/${this.maxRetries})`)
    }
  }

  /**
   * Initialize OAuth2 client with environment variables and database token
   */
  private async initializeClient(): Promise<void> {
    console.log('🔧 Initializing Google Drive authentication...')
    
    if (!this.userId || !this.organizationId) {
      throw new Error('User and organization context required for Google Drive authentication')
    }

    // Get OAuth credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google Drive OAuth credentials not configured in environment variables')
    }

    this.oauth2Client = new auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    // Get token from database
    const tokenData = await this.getTokenFromDatabase()
    if (!tokenData) {
      throw new GoogleDriveAuthError('AUTHENTICATION_REQUIRED', 'No Google Drive authentication found. Please authenticate first.')
    }

    this.oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: new Date(tokenData.expiry_date).getTime()
    })
    
    // Set up token refresh handler to save new tokens
    this.oauth2Client.on('tokens', async (tokens: any) => {
      await this.handleTokenRefresh(tokens)
    })

    this.drive = drive({ version: 'v3', auth: this.oauth2Client })
  }

  /**
   * Handle token refresh events and save to database
   */
  private async handleTokenRefresh(tokens: any): Promise<void> {
    console.log('🔄 Google OAuth token refresh event triggered')
    
    try {
      await this.saveTokenToDatabase(tokens)
      this.lastTokenRefresh = new Date()
      console.log('✅ Google OAuth token refreshed and saved to database')
    } catch (error) {
      console.error('❌ Failed to save refreshed token:', error)
    }
  }

  /**
   * Ensure token is valid and refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise
      return
    }

    const tokenData = await this.getTokenFromDatabase()
    if (!tokenData) {
      throw new GoogleDriveAuthError('AUTHENTICATION_REQUIRED', 'No authentication token found')
    }

    const now = new Date()
    const expiry = new Date(tokenData.expiry_date)
    
    // Add buffer time (5 minutes) to prevent race conditions
    const bufferTime = 5 * 60 * 1000 // 5 minutes in milliseconds
    const shouldRefresh = now.getTime() >= (expiry.getTime() - bufferTime)

    if (shouldRefresh) {
      console.log('🔄 Token expired or expiring soon, refreshing...')
      
      // Create a promise to prevent multiple concurrent refreshes
      this.refreshPromise = this.performTokenRefresh()
      
      try {
        await this.refreshPromise
      } finally {
        this.refreshPromise = null
      }
    }
  }

  /**
   * Perform the actual token refresh with comprehensive error handling
   */
  private async performTokenRefresh(): Promise<void> {
    const startTime = Date.now()
    console.log('🔄 Starting token refresh...')
    
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      this.oauth2Client.setCredentials(credentials)
      
      // Save refreshed token to database
      await this.saveTokenToDatabase(credentials)
      
      this.lastTokenRefresh = new Date()
      const duration = Date.now() - startTime
      console.log(`✅ Token refreshed successfully (${duration}ms)`)
      
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`❌ Failed to refresh token after ${duration}ms:`, {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.response?.data
      })
      
      // Categorize error types for better handling
      if (error.message?.includes('invalid_grant') || 
          error.code === 'invalid_grant' ||
          error.status === 400) {
        throw new GoogleDriveAuthError('AUTHENTICATION_REQUIRED', 'Refresh token is invalid or expired. Please re-authenticate.')
      }
      
      if (error.status === 429) {
        throw new GoogleDriveAuthError('TOKEN_REFRESH_ERROR', 'Google API quota exceeded during token refresh. Please try again later.')
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new GoogleDriveAuthError('TOKEN_REFRESH_ERROR', 'Network error during token refresh. Please check your internet connection.')
      }
      
      throw new GoogleDriveAuthError('TOKEN_REFRESH_ERROR', `Token refresh failed: ${error.message}`)
    }
  }

  /**
   * Validate that token is not expired
   */
  private async validateToken(): Promise<boolean> {
    try {
      const tokenData = await this.getTokenFromDatabase()
      if (!tokenData) return false
      
      const now = new Date()
      const expiry = new Date(tokenData.expiry_date)
      
      // Add small buffer to prevent edge cases
      const bufferTime = 60 * 1000 // 1 minute buffer
      return now.getTime() < (expiry.getTime() - bufferTime)
      
    } catch (error) {
      console.error('❌ Error validating token:', error)
      return false
    }
  }

  /**
   * Validate token works by making a test API call with retry logic
   */
  private async validateTokenWithApiCallRetry(): Promise<void> {
    console.log('🔐 Validating Google Drive authentication...')
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.drive.about.get({ fields: 'user' })
        console.log('✅ Google Drive authentication valid')
        return
      } catch (error: any) {
        console.error(`❌ Google Drive authentication test failed (attempt ${attempt}/${this.maxRetries}):`, {
          message: error.message,
          status: error.status,
          code: error.code
        })
        
        // If this is the last attempt, throw the error
        if (attempt === this.maxRetries) {
          throw error
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10 seconds
        console.log(`⏳ Retrying authentication validation in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Validate token works by making a test API call (single attempt)
   */
  private async validateTokenWithApiCall(): Promise<void> {
    console.log('🔐 Validating Google Drive authentication...')
    
    try {
      await this.drive.about.get({ fields: 'user' })
      console.log('✅ Google Drive authentication valid')
    } catch (error: any) {
      console.error('❌ Google Drive authentication test failed:', error)
      throw error
    }
  }

  /**
   * Get current authentication status
   */
  async getAuthStatus(): Promise<{
    isAuthenticated: boolean
    tokenExpiry?: Date
    lastRefresh?: Date
    error?: string
  }> {
    try {
      if (!this.userId || !this.organizationId) {
        return {
          isAuthenticated: false,
          error: 'User context not set'
        }
      }

      const tokenData = await this.getTokenFromDatabase()
      if (!tokenData) {
        return {
          isAuthenticated: false,
          error: 'No authentication token found'
        }
      }

      const expiry = new Date(tokenData.expiry_date)
      const isValid = await this.validateToken()
      
      return {
        isAuthenticated: isValid,
        tokenExpiry: expiry,
        lastRefresh: this.lastTokenRefresh || undefined,
      }
    } catch (error: any) {
      return {
        isAuthenticated: false,
        error: error.message
      }
    }
  }

  /**
   * Reset authentication state (force re-initialization)
   */
  resetAuth(): void {
    this.oauth2Client = null
    this.drive = null
    this.lastTokenRefresh = null
    this.refreshPromise = null
  }

  /**
   * Get token from database for current user/organization
   */
  private async getTokenFromDatabase(): Promise<any> {
    if (!this.userId || !this.organizationId) {
      return null
    }

    const supabase = this.getSupabaseClient()
    if (!supabase) {
      return null
    }

    const { data, error } = await supabase
      .from('google_drive_tokens')
      .select('*')
      .eq('user_id', this.userId)
      .eq('organization_id', this.organizationId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null
      }
      throw new Error(`Failed to get token from database: ${error.message}`)
    }

    return data
  }

  /**
   * Save token to database for current user/organization
   */
  private async saveTokenToDatabase(tokens: any): Promise<void> {
    if (!this.userId || !this.organizationId) {
      throw new Error('User context not available')
    }

    const supabase = this.getSupabaseClient()
    if (!supabase) {
      throw new Error('Database connection not available')
    }

    const tokenData = {
      user_id: this.userId,
      organization_id: this.organizationId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      token_type: tokens.token_type || 'Bearer',
      expiry_date: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(), // Default 1 hour if no expiry
      scope: tokens.scope || undefined
    }

    // Use upsert to handle both insert and update
    const { error } = await supabase
      .from('google_drive_tokens')
      .upsert(tokenData, {
        onConflict: 'user_id,organization_id'
      })

    if (error) {
      throw new Error(`Failed to save token to database: ${error.message}`)
    }
  }
}

export class GoogleDriveAuthError extends Error {
  constructor(
    public code: 'AUTHENTICATION_REQUIRED' | 'AUTH_SETUP_ERROR' | 'TOKEN_REFRESH_ERROR',
    message: string,
    public retryAfter?: number
  ) {
    super(message)
    this.name = 'GoogleDriveAuthError'
  }
}

// Export factory function instead of singleton for server-side usage
export const createGoogleDriveAuth = (userId: string, organizationId: string) => {
  return GoogleDriveAuthService.getInstance({ userId, organizationId })
}

// Legacy export for backward compatibility (will need user context set)
export const googleDriveAuth = GoogleDriveAuthService.getInstance()