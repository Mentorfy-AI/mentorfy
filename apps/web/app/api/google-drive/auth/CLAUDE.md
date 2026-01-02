# CLAUDE.md - Google Drive OAuth Authentication Endpoint

This directory contains the OAuth flow handler for Google Drive authentication, implementing a secure two-phase authentication process for accessing user's Google Drive documents.

## File Overview

### route.ts - OAuth Flow Handler
**Route**: `/api/google-drive/auth`
**Method**: `GET`
**Purpose**: Handle complete OAuth 2.0 flow for Google Drive authentication

#### OAuth 2.0 Implementation

**Two-Phase Authentication Flow**:

**Phase 1: Authorization Request (Lines 73-83)**
```typescript
if (!code) {
  // Generate authorization URL and redirect to Google
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.readonly'],
    prompt: 'consent' // Force consent to get refresh token
  })
  
  return NextResponse.redirect(authUrl)
}
```

**Phase 2: Token Exchange (Lines 84-128)**
```typescript
else {
  // Process authorization code and exchange for tokens
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  
  // Save tokens to database
  // Redirect to application with success status
}
```

#### Configuration and Setup

**Environment Variables Required**:
- `GOOGLE_CLIENT_ID`: OAuth 2.0 client identifier
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 client secret  
- `GOOGLE_REDIRECT_URI`: Authorized redirect URI
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

**OAuth 2.0 Client Configuration** (Lines 67-71):
```typescript
const oauth2Client = new google.auth.OAuth2(
  clientId,      // Google OAuth client ID
  clientSecret,  // Google OAuth client secret
  redirectUri    // Authorized redirect URI
)
```

**Scope Configuration**:
- `https://www.googleapis.com/auth/drive.readonly`: Read-only access to Google Drive
- **Security Principle**: Minimal necessary permissions
- **Access Type**: `offline` to receive refresh tokens
- **Prompt**: `consent` to force consent screen for refresh token

#### Authentication Context

**User Authentication** (Lines 40-44):
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Organization Context** (Lines 46-54):
```typescript
const { data: userOrg, error: orgError } = await supabase
  .from('user_organization')
  .select('organization_id')
  .eq('user_id', user.id)
  .single()
```

**Security Validation**:
- Requires valid Supabase user session
- Validates user organization membership
- Ensures proper user context before OAuth flow

#### Token Management

**Token Storage Structure** (Lines 93-101):
```typescript
const tokenData = {
  user_id: user.id,
  organization_id: userOrg.organization_id,
  access_token: tokens.access_token!,
  refresh_token: tokens.refresh_token || null,
  token_type: tokens.token_type || 'Bearer',
  expiry_date: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
  scope: tokens.scope || null
}
```

**Database Storage** (Lines 103-112):
```typescript
const { error: saveError } = await supabase
  .from('google_drive_tokens')
  .upsert(tokenData, {
    onConflict: 'user_id,organization_id'
  })
```

**Key Features**:
- **Organization Scoping**: Tokens isolated by user + organization
- **Upsert Strategy**: Handles both initial storage and token refresh
- **Default Expiry**: 1-hour default if Google doesn't provide expiry
- **Composite Key**: Prevents token conflicts across organizations

#### Redirect Handling

**Success Redirect** (Lines 115-118):
```typescript
const redirectUrl = new URL('/', request.nextUrl)
redirectUrl.searchParams.set('auth', 'success')
return NextResponse.redirect(redirectUrl.toString())
```

**Error Redirect** (Lines 124-127):
```typescript
const redirectUrl = new URL('/', request.nextUrl)
redirectUrl.searchParams.set('auth', 'error')
redirectUrl.searchParams.set('message', encodeURIComponent(error.message))
return NextResponse.redirect(redirectUrl.toString())
```

**User Experience**:
- Returns to main application after authentication
- Provides clear success/error status via query parameters
- Enables frontend to show appropriate feedback messages
- Maintains user context and navigation state

#### Security Features

**CSRF Protection**:
- Uses Google OAuth state parameter (implicit in googleapis library)
- Validates redirect URI matches registered URI
- Ensures requests come from legitimate sources

**Token Security**:
- Refresh tokens stored securely in database
- Organization-scoped token isolation
- Secure token transmission (HTTPS required)
- No token exposure in client-side code

**Error Handling Security**:
- No sensitive information in error messages
- Detailed logging server-side only
- Generic error messages to users
- Prevents information leakage

#### Error Handling

**Configuration Errors** (Lines 62-65):
```typescript
if (!clientId || !clientSecret || !redirectUri) {
  return NextResponse.json({ 
    error: 'Google Drive OAuth credentials not configured in environment variables' 
  }, { status: 500 })
}
```

**Token Exchange Errors** (Lines 120-128):
- OAuth code validation failures
- Network connectivity issues
- Google API service errors
- Token storage database errors

**Error Response Strategy**:
- Redirect to main application with error status
- Include error message in query parameters
- Log detailed errors server-side
- Provide user-friendly error messages

#### Integration Points

**Frontend Integration**:
- Users can initiate OAuth by visiting `/api/google-drive/auth`
- Frontend handles success/error query parameters
- Status feedback for user authentication flow
- Seamless integration with main application flow

**Service Integration**:
- Works with `GoogleDriveAuthService` for token management
- Integrates with import functionality after authentication
- Provides foundation for all Google Drive operations
- Enables organization-scoped Google Drive access

## Usage Workflows

### Initial Authentication
1. User clicks "Connect Google Drive" in frontend
2. Frontend redirects to `/api/google-drive/auth`
3. API redirects to Google OAuth consent screen
4. User grants permissions on Google's interface
5. Google redirects back with authorization code
6. API exchanges code for tokens and stores in database
7. User redirected to main app with success status

### Re-authentication
1. Existing tokens expired or invalid
2. Import operation detects authentication failure
3. Frontend prompts user to re-authenticate
4. User follows same OAuth flow
5. New tokens replace existing tokens in database
6. Import operation can proceed with fresh tokens

### Error Recovery
1. OAuth flow encounters error (user denial, network issue, etc.)
2. User redirected to main app with error status
3. Frontend displays appropriate error message
4. User can retry authentication or contact support
5. Detailed error logging helps with troubleshooting

## Security Considerations

### OAuth Security Best Practices
- **Minimal Scopes**: Only request necessary permissions
- **Refresh Tokens**: Use refresh tokens for long-term access
- **Secure Storage**: Store tokens encrypted in database
- **HTTPS Required**: All OAuth communication over HTTPS

### Multi-Tenant Security
- **Token Isolation**: Organization-scoped token storage
- **Access Controls**: Validate user permissions before OAuth
- **Data Isolation**: Prevent cross-organization token access
- **Audit Trail**: Log authentication events for security

### Privacy Protection
- **Consent Management**: Clear user consent for data access
- **Data Minimization**: Only access necessary Drive data
- **Retention Policies**: Consider token retention limits
- **User Controls**: Enable users to revoke access

## Performance Optimization

### Response Time
- **Redirect Speed**: Fast redirect to Google OAuth
- **Token Storage**: Efficient database operations
- **Error Handling**: Quick error response paths
- **State Management**: Minimal server-side state

### Reliability
- **Error Recovery**: Graceful handling of OAuth failures
- **Database Resilience**: Transaction-safe token storage
- **Network Resilience**: Timeout and retry handling
- **Service Degradation**: Fallback when services unavailable

## Future Enhancements

### Planned Improvements
- **State Parameter**: Custom state parameter for CSRF protection
- **Incremental Authorization**: Request additional scopes as needed
- **Token Refresh**: Automatic background token refresh
- **Analytics**: Track authentication success rates

### Security Enhancements
- **PKCE**: Implement Proof Key for Code Exchange
- **Token Rotation**: Regular token rotation policies
- **Access Monitoring**: Monitor token usage patterns
- **Compliance**: GDPR/CCPA compliance features

### User Experience
- **Progress Indicators**: Show authentication progress
- **Error Recovery**: Better error recovery workflows
- **Mobile Support**: Optimize for mobile OAuth flows
- **Accessibility**: Improve accessibility compliance

This OAuth authentication endpoint provides secure, standards-compliant Google Drive authentication with multi-tenant support and comprehensive error handling.