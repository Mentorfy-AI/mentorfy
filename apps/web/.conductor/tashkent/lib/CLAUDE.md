# CLAUDE.md - Library Directory

This file provides detailed documentation for the `lib/` directory, which contains utility functions, service clients, and core business logic for the Mentorfy frontend application.

## Directory Overview

The `lib/` directory contains essential services and utilities:

```
lib/
├── supabase.ts              # Browser-side Supabase client
├── supabase-server.ts       # Server-side Supabase client  
├── utils.ts                 # General utility functions
├── system-prompt-builder.ts # AI prompt construction and configuration
├── graphiti-client.ts       # Knowledge graph search client
└── google-drive-auth.ts     # Google Drive OAuth management
```

## Core Utilities

### utils.ts:4-6
**Tailwind CSS Class Merger**
```typescript
export function cn(...inputs: ClassValue[]): string
```
- **Purpose**: Intelligent CSS class name merging with conflict resolution
- **Implementation**: Combines `clsx` for conditional classes and `twMerge` for Tailwind CSS conflict resolution
- **Usage Pattern**: `cn("base-class", condition && "conditional-class", anotherClass)`
- **Architecture Role**: Ensures consistent styling without class conflicts across components

## Database Clients

### supabase.ts:3-8
**Browser-Side Supabase Client**
```typescript
export const createClient = () => createBrowserClient(...)
```
- **Purpose**: Creates Supabase client for client-side operations
- **Configuration**: Uses public environment variables for browser access
- **Security**: Only provides anonymous key access level
- **Usage**: Authentication, realtime subscriptions, client-side queries
- **Architecture Role**: Handles all browser-initiated database operations

### supabase-server.ts:4-29
**Server-Side Supabase Client**  
```typescript
export const createClient = () => createServerClient(...)
```
- **Purpose**: Creates Supabase client for server-side operations (API routes, SSR)
- **Cookie Management**: 
  - `getAll()`: Reads authentication cookies from Next.js cookie store
  - `setAll()`: Handles cookie updates with error resilience
- **Security**: Accesses server-side context for elevated permissions
- **Error Handling**: Graceful cookie operation failures for middleware compatibility
- **Architecture Role**: Enables secure server-side database operations with session context

## AI System Management

### system-prompt-builder.ts:1-128
**AI Prompt Engineering and Configuration System**

#### Core Interfaces (Simplified for Direct AI Parameter Control)
```typescript
interface BehaviorSettings {
  purpose: string
  customInstructions: string[]
  speakingStyle: string
  maxTokens: number        // Direct OpenAI parameter (100-4000)
  temperature: number      // Direct OpenAI parameter (0.0-2.0)
}

// ModelParameters interface removed - parameters now directly in BehaviorSettings
```

#### Key Functions

**buildSystemPrompt(behaviorSettings, contextString?): string**
- **Purpose**: Constructs comprehensive system prompts for OpenAI chat completions using bot-specific settings
- **Multi-Bot Support**: Settings can come from individual bot configurations or fallback defaults
- **Simplified Prompt Structure**:
  1. Context from knowledge base (if available)
  2. Primary purpose statement (bot-specific)
  3. Custom instructions (bulleted list, bot-specific)
  4. Communication style guidelines (bot-specific)
- **Context Integration**: Intelligently handles presence/absence of knowledge graph results
- **Architecture Role**: Bridges bot-specific preferences with AI model requirements
- **Removed Features**: No longer includes response length guidance text

**getModelParameters() function removed**
- **Reason**: Direct parameter control eliminates need for enum-to-parameter translation
- **Replacement**: maxTokens and temperature are now direct properties in BehaviorSettings
- **Migration**: OpenAI API calls now use `behaviorSettings.maxTokens` and `behaviorSettings.temperature` directly

**validateCharacterLimits(purpose, speakingStyle): ValidationResult**
- **Purpose**: Prevents prompt engineering issues from oversized inputs
- **Limits**: 
  - Purpose: 15,000 characters
  - Speaking Style: 5,000 characters
- **Error Reporting**: Detailed validation messages for UI feedback
- **Architecture Role**: Input validation layer for AI configuration
- **Note**: Only validates text fields; numeric parameters validated at API level

#### Direct AI Parameter Configuration (Simplified Architecture)
- **Max Tokens**: Direct numeric input (100-4000 range)
  - **Default**: 1000 tokens for balanced response length
  - **UI Control**: Number input with range validation
  - **Database**: INTEGER column with CHECK constraint
- **Temperature**: Direct numeric input (0.0-2.0 range)
  - **Default**: 0.7 for balanced creativity and consistency
  - **UI Control**: Number input with 0.1 step increment
  - **Database**: DECIMAL(3,2) column with CHECK constraint

#### Removed Enum-Based Configuration
- **Response Length Enum**: Removed in favor of direct maxTokens control
- **Creativity Level Enum**: Removed in favor of direct temperature control
- **Benefits**: Simplified UI, more precise control, reduced complexity
- **Migration Impact**: Existing bots receive default values (1000, 0.7)

## Knowledge Graph Integration

### graphiti-client.ts:24-93
**Graphiti Knowledge Graph Client**

#### Core Interface
```typescript
interface KnowledgeSearchResult {
  fact: string;
  confidence?: number;
  source?: string;
}
```

#### Key Functions

**searchKnowledgeGraph(query, limit = 5): Promise<KnowledgeSearchResult[]>**
- **Purpose**: Searches the Graphiti knowledge graph for contextually relevant information
- **API Integration**: Makes HTTP requests to FastAPI backend (`/api/search` endpoint)
- **Error Handling**: Comprehensive error categorization and logging
- **Response Processing**: Extracts and formats search results for AI consumption
- **Architecture Role**: Bridges document knowledge base with chat AI system

**checkGraphitiHealth(): Promise<boolean>**
- **Purpose**: Health check for knowledge graph connectivity
- **Implementation**: Simple HTTP GET to `/health` endpoint
- **Monitoring**: Enables system status verification
- **Architecture Role**: Provides monitoring capabilities for knowledge graph services

**closeGraphitiClient(): Promise<void>**
- **Purpose**: Connection cleanup (no-op for HTTP-based client)
- **Design**: Maintains interface compatibility with potential future connection pooling
- **Architecture Role**: Clean shutdown protocol for service management

#### Error Handling Strategy
- Network failures with detailed error messages
- API response validation and error extraction
- Graceful degradation when knowledge graph is unavailable
- Comprehensive logging for debugging and monitoring

## Google Drive Integration

### google-drive-auth.ts:15-482
**Comprehensive Google Drive OAuth Management**

#### Core Classes

**GoogleDriveAuthService**
- **Pattern**: Singleton service with user context management
- **Responsibility**: Handles complete OAuth lifecycle for Google Drive integration
- **State Management**: Tracks authentication status, token expiry, and refresh operations
- **Error Handling**: Comprehensive error categorization with specific error types

#### Key Methods

**getAuthenticatedClient(): Promise<GoogleDriveAuthResult>**
- **Purpose**: Primary method for obtaining authenticated Google Drive client
- **Authentication Flow**:
  1. Validates existing client if available
  2. Initializes OAuth2 client with environment credentials
  3. Retrieves tokens from database (user + organization scoped)
  4. Ensures token validity with automatic refresh
  5. Validates with test API call
- **Retry Logic**: Exponential backoff with max 3 attempts
- **Performance**: Returns cached client when valid
- **Architecture Role**: Single entry point for all Google Drive operations

**initializeClient(): Promise<void>**
- **Purpose**: Sets up OAuth2 client with database-stored tokens
- **Configuration Sources**:
  - Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  - Database: User/organization-specific token storage
- **Token Event Handling**: Automatic refresh token persistence
- **Security**: Organization-scoped token isolation
- **Architecture Role**: Initializes secure, organization-aware Google Drive client

**ensureValidToken(): Promise<void>**
- **Purpose**: Proactive token refresh with race condition prevention
- **Buffer Strategy**: 5-minute buffer before expiry to prevent edge cases
- **Concurrency**: Single refresh promise prevents parallel refresh attempts
- **Error Categorization**: Distinguishes between network, auth, and quota errors
- **Architecture Role**: Maintains seamless authentication without user intervention

**performTokenRefresh(): Promise<void>**
- **Purpose**: Executes actual OAuth token refresh operation
- **Error Types**:
  - `invalid_grant`: Refresh token expired, requires re-authentication
  - `429`: Rate limiting, suggests retry timing
  - Network errors: Connection issues, suggests connectivity problems
- **Database Persistence**: Automatic storage of refreshed tokens
- **Logging**: Comprehensive refresh operation tracking
- **Architecture Role**: Core OAuth refresh mechanism with comprehensive error handling

#### Authentication Status Management

**getAuthStatus(): Promise<AuthStatus>**
- **Purpose**: Provides comprehensive authentication status information
- **Return Data**:
  - `isAuthenticated`: Current validity status
  - `tokenExpiry`: Absolute expiration time
  - `lastRefresh`: Last successful refresh timestamp
  - `error`: Detailed error message if authentication failed
- **Use Cases**: UI status indicators, debugging, monitoring
- **Architecture Role**: Status reporting for authentication state

**resetAuth(): void**
- **Purpose**: Forces complete re-initialization of authentication state
- **Use Cases**: User context changes, authentication errors, manual reset
- **State Cleanup**: Clears cached clients, tokens, and refresh promises
- **Architecture Role**: Recovery mechanism for authentication issues

#### Database Integration

**getTokenFromDatabase(): Promise<TokenData>**
- **Purpose**: Retrieves organization-scoped OAuth tokens from Supabase
- **Query Strategy**: Composite key lookup (user_id + organization_id)
- **Error Handling**: Distinguishes between "not found" and actual database errors
- **Security**: Organization isolation ensures token access control
- **Architecture Role**: Secure token retrieval with multi-tenant support

**saveTokenToDatabase(tokens): Promise<void>**
- **Purpose**: Persists OAuth tokens with organization scope
- **Upsert Strategy**: Handles both initial token storage and refresh updates
- **Data Structure**:
  ```typescript
  {
    user_id: string,
    organization_id: string,
    access_token: string,
    refresh_token?: string,
    token_type: string,
    expiry_date: string,
    scope?: string
  }
  ```
- **Conflict Resolution**: Uses composite key conflicts for automatic updates
- **Architecture Role**: Persistent token storage with multi-tenant isolation

#### Error Handling Architecture

**GoogleDriveAuthError Class**
```typescript
class GoogleDriveAuthError extends Error {
  code: 'AUTHENTICATION_REQUIRED' | 'AUTH_SETUP_ERROR' | 'TOKEN_REFRESH_ERROR'
  retryAfter?: number
}
```

**Error Categories**:
- **AUTHENTICATION_REQUIRED**: User needs to re-authenticate via OAuth flow
- **AUTH_SETUP_ERROR**: Configuration or initialization problems
- **TOKEN_REFRESH_ERROR**: Refresh operation failed, may be retryable

**Retry Strategy**:
- Maximum 3 attempts with exponential backoff
- Different handling for different error types
- Comprehensive logging for debugging and monitoring

#### Factory Functions

**createGoogleDriveAuth(userId, organizationId): GoogleDriveAuthService**
- **Purpose**: Factory function for server-side usage with explicit context
- **Multi-tenancy**: Ensures proper user/organization isolation
- **Server Compatibility**: Designed for API route usage patterns
- **Architecture Role**: Provides context-aware authentication service instances

**googleDriveAuth (Legacy Export)**
- **Purpose**: Backward compatibility singleton instance
- **Limitation**: Requires manual context setting via `setUserContext()`
- **Usage**: Legacy code support, will eventually require user context
- **Architecture Role**: Maintains API compatibility during migration

## Service Integration Patterns

### Authentication Chain (Multi-Bot Architecture)
1. **Supabase Authentication**: User login and session management
2. **Organization Context**: Retrieve user's organization membership
3. **Bot Validation**: Ensure selected bot belongs to user's organization
4. **Google Drive OAuth**: Organization-scoped Google Drive access
5. **API Operations**: Bot-aware authenticated operations with proper scoping

### Error Propagation Strategy
- Service-level errors bubble up with context
- API routes translate service errors to HTTP responses
- Frontend components display user-friendly error messages
- Comprehensive logging at each layer for debugging

### Configuration Management
- Environment variables for secrets and endpoints
- Database storage for user/organization-specific settings
- Hardcoded defaults for development and testing
- Validation layers prevent misconfiguration

### Multi-tenancy Support (Enhanced for Multi-Bot)
- All services are organization-aware
- Bot operations validate organization membership
- Token storage includes organization scope  
- Error messages include tenant and bot context
- Database queries filter by organization_id
- Bot-specific document associations via bot_document table
- Conversation and message records linked to specific bots

This library directory provides the foundational services that enable the Mentorfy application's core functionality: multi-bot AI-powered chat with bot-specific behavior settings, knowledge graph integration, secure multi-tenant Google Drive access, and comprehensive database operations through Supabase. The multi-bot architecture allows organizations to maintain multiple AI mentors with distinct personalities, configurations, and document associations.