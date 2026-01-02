# Mentorfy Data Model

## Overview

Mentorfy uses a **Clerk-first** authentication architecture where Clerk is the single source of truth for user identity and organization membership. Supabase stores only app-specific data and references Clerk IDs.

## Authentication & Identity

### Source of Truth: Clerk

- **Users**: Managed entirely in Clerk, authenticated via JWT tokens
- **Organizations**: Multi-tenant scoping managed in Clerk
- **Roles**: Defined in Clerk with three levels:
  - `org:admin` - Organization administrators (full access)
  - `org:team_member` - Mentors/teachers (content management)
  - `org:student` - Students (chat access only)

### Supabase Role

- **Stores app-specific data only** - No duplication of auth data
- **Uses Clerk IDs as references** - `clerk_user_id`, `clerk_org_id` (not internal UUIDs)
- **RLS policies read from Clerk JWT** - Database enforces multi-tenancy via `auth.jwt()`

## Core Principles

### 1. Clerk Owns Identity

**Never** store user identity data in Supabase:
- ❌ Don't store: first_name, last_name, email, password
- ✅ Do store: clerk_user_id (reference only)
- 🔍 Fetch on demand: Use Clerk API to get user details when displaying

### 2. clerk_org_id is the Scope

All data is scoped to Clerk organizations:
- Every table with org-specific data has `clerk_org_id TEXT NOT NULL`
- RLS policies enforce: `clerk_org_id = requesting_owner_id()`
- No cross-org data access possible

### 3. No Internal UUIDs for Identity

- ❌ Old way: `user_id UUID REFERENCES users(id)`
- ✅ New way: `clerk_user_id TEXT NOT NULL` (direct Clerk reference)
- Why: Eliminates sync issues, Clerk is always up-to-date

### 4. RLS Enforces Multi-Tenancy

Row Level Security is enabled on all tables:
- Reads filtered by `clerk_org_id` from JWT
- Writes validated against JWT claims
- Database-level security (can't be bypassed in code)

## Table Schemas

### user_profile

**Purpose:** App-specific user metadata for learning profiles

```sql
CREATE TABLE user_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Clerk identity (source of truth)
  clerk_user_id TEXT NOT NULL,
  clerk_org_id TEXT NOT NULL,

  -- App-specific data ONLY
  summary TEXT,           -- Student learning profile/context
  metadata JSONB DEFAULT '{}',  -- Custom app data

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(clerk_user_id, clerk_org_id)  -- One profile per user per org
);
```

**DO store:**
- `summary` - Student learning profile (AI context about the user)
- `metadata` - App-specific settings, preferences, custom fields

**DON'T store:**
- Names, emails (fetch from `clerkClient.users.getUser()`)
- Auth data (Clerk handles this)
- Organization membership (Clerk manages this)

**Unique constraint:** One profile per `(clerk_user_id, clerk_org_id)` pair

**Sync strategy:**
- Created automatically via webhook when user joins org
- Fallback: Middleware creates if webhook fails
- Deleted automatically when user leaves org

### organization

**Purpose:** Org-specific settings cache (Clerk is source of truth)

```sql
CREATE TABLE organization (
  clerk_org_id TEXT PRIMARY KEY,  -- Clerk org ID is the PK
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**DO store:**
- `settings` - Org-level configuration (feature flags, defaults)
- `name` - Cached from Clerk (updated via webhook)

**DON'T store:**
- Member lists (Clerk manages this - query via Clerk API)
- Billing info (Stripe/Clerk handles this)
- Permissions (Clerk roles handle this)

**Note:** This is primarily a cache. Authoritative org data lives in Clerk.

### conversation

**Purpose:** Chat history between users and mentor bots

```sql
CREATE TABLE conversation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User identity
  clerk_user_id TEXT NOT NULL,  -- Who is chatting
  clerk_org_id TEXT NOT NULL,   -- Which org context

  -- Bot reference
  mentor_bot_id UUID NOT NULL REFERENCES mentor_bot(id) ON DELETE CASCADE,

  -- Conversation metadata
  title TEXT,
  platform TEXT,               -- 'web', 'slack', etc.
  platform_thread_id TEXT,     -- Slack thread ID, etc.
  zep_session_id TEXT,         -- Zep memory session

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**References:**
- `clerk_user_id` - Direct reference to Clerk user
- `clerk_org_id` - Org scope for multi-tenancy
- `mentor_bot_id` - Which AI bot the user is talking to

**RLS:** Users can only see their own conversations (filtered by `clerk_user_id`)

### message

**Purpose:** Individual chat messages

```sql
CREATE TABLE message (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  role TEXT NOT NULL,          -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** No direct `clerk_user_id` needed - inherited via `conversation` FK

### mentor_bot

**Purpose:** AI mentor configurations (one org can have multiple bots)

```sql
CREATE TABLE mentor_bot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT NOT NULL,  -- Org ownership

  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,

  -- Behavior settings
  response_length TEXT DEFAULT 'Intelligent',  -- 'Concise', 'Intelligent', 'Explanatory'
  creativity_level TEXT DEFAULT 'Adaptive',    -- 'Strict', 'Adaptive', 'Creative'
  system_prompt TEXT,
  additional_instructions TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Scoped by:** `clerk_org_id` - Each org has independent bots

**No FK to organization table:** Clerk is source of truth, no need for FK

**RLS:** Users can only access bots in their org

### document

**Purpose:** Uploaded files for knowledge base

```sql
CREATE TABLE document (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT NOT NULL,  -- Org ownership

  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,

  -- Processing status
  processing_status TEXT DEFAULT 'pending_upload',
  sync_status TEXT DEFAULT 'never_synced',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Processing statuses:**
- `pending_upload` → `uploaded` → `processing` → `available_to_ai`
- `failed` → `retrying` (with exponential backoff)

**Scoped by:** `clerk_org_id`

### bot_document

**Purpose:** Many-to-many relationship between bots and documents

```sql
CREATE TABLE bot_document (
  bot_id UUID NOT NULL REFERENCES mentor_bot(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bot_id, document_id)
);
```

**Note:** No `clerk_org_id` needed - inherited via FKs

### document_chunk

**Purpose:** Text chunks with vector embeddings for RAG

```sql
CREATE TABLE document_chunk (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,

  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 embeddings

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** Org scoping inherited via `document` FK

### processing_job

**Purpose:** Background job tracking for async operations

```sql
CREATE TABLE processing_job (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT NOT NULL,

  job_type TEXT NOT NULL,  -- 'document_process', 'document_sync', 'embedding_generation'
  status TEXT DEFAULT 'pending',
  resource_id UUID,        -- Reference to document/bot/etc

  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Job types:**
- `document_process` - Extract text from uploaded file
- `document_sync` - Sync to knowledge graph
- `embedding_generation` - Generate vector embeddings

### bot_slack_workspace

**Purpose:** Slack integration configuration

```sql
CREATE TABLE bot_slack_workspace (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT NOT NULL,
  mentor_bot_id UUID NOT NULL REFERENCES mentor_bot(id) ON DELETE CASCADE,

  slack_team_id TEXT NOT NULL,
  slack_bot_token TEXT NOT NULL,
  slack_app_id TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(slack_team_id, mentor_bot_id)
);
```

**Scoped by:** `clerk_org_id`

### google_drive_tokens

**Purpose:** OAuth tokens for Google Drive integration

```sql
CREATE TABLE google_drive_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT NOT NULL,

  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(clerk_org_id)  -- One token set per org
);
```

**Security:** RLS ensures users only see their org's tokens

### super_admin

**Purpose:** Platform-level admin users (rare)

```sql
CREATE TABLE super_admin (
  clerk_user_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** This bypasses org-level permissions for platform administration

## Key Design Patterns

### 1. UUID Primary Keys

All tables use `UUID` PKs (except `organization` which uses `clerk_org_id`)
- Prevents ID enumeration attacks
- Globally unique across environments
- Safe for distributed systems

### 2. Multi-Tenant RLS

Every org-scoped table has:
```sql
CREATE POLICY "org_isolation"
ON table_name FOR SELECT
TO authenticated
USING (clerk_org_id = requesting_owner_id());
```

Helper function:
```sql
CREATE OR REPLACE FUNCTION requesting_owner_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'o' ->> 'id',
    ''
  );
$$ LANGUAGE SQL STABLE;
```

### 3. JSONB for Flexibility

`metadata` and `settings` columns use JSONB:
- Allows schema evolution without migrations
- Indexed with GIN for fast queries
- Type-safe with Zod validation in app code

### 4. Soft Deletes vs Hard Deletes

Currently using **hard deletes** with `ON DELETE CASCADE`:
- Simpler data model
- Complies with GDPR "right to be forgotten"
- Consider soft deletes (is_deleted flag) if audit trail needed

### 5. Timestamps

All tables have:
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

Updated via triggers or app code.

### 6. Idempotent Operations

Database operations designed to be safely retried:
- `ON CONFLICT` clauses for upserts
- Check-then-create patterns
- Unique constraints prevent duplicates

## Data Flow

### User Joins Organization

1. Admin invites user in Clerk Dashboard
2. User accepts invite → Clerk webhook fires
3. `organizationMembership.created` → Creates `user_profile`
4. Middleware ensures profile exists on first request (fallback)
5. User can immediately access app ✅

### User Uploads Document

1. Frontend uploads file to storage
2. API creates `document` record with `clerk_org_id`
3. Backend job processes file → extracts chunks
4. Chunks embedded → stored in `document_chunk`
5. Document synced to knowledge graph
6. Status updated to `available_to_ai` ✅

### User Chats with Bot

1. Frontend creates `conversation` with `clerk_user_id`, `clerk_org_id`, `mentor_bot_id`
2. User sends message → stored in `message`
3. Backend retrieves bot config + relevant documents via `bot_document`
4. Searches `document_chunk` embeddings for context
5. Generates AI response with bot's behavior settings
6. Stores assistant message in `message` ✅

## Migration History

### Phase 1-2: Clean Data Model Migration

**Before:**
- `user_id UUID` (internal Supabase users)
- `organization_id UUID` (internal org table)
- Duplicated Clerk data (first_name, last_name, email)
- Complex sync logic

**After:**
- `clerk_user_id TEXT` (direct Clerk reference)
- `clerk_org_id TEXT` (direct Clerk reference)
- Zero duplicated data
- Simple webhook sync

**Benefits:**
- Single source of truth (Clerk)
- No sync drift issues
- Easier to reason about
- Better GDPR compliance

## Querying Best Practices

### ✅ DO: Use Clerk-authenticated Supabase client

```typescript
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

const supabase = await createClerkSupabaseClient()
const { data } = await supabase
  .from('mentor_bot')
  .select('*')
// RLS automatically filters by user's clerk_org_id
```

### ❌ DON'T: Bypass RLS unless necessary

```typescript
// Only use for webhooks/admin operations
import { createServiceClient } from '@/lib/supabase-server'
const supabase = createServiceClient() // Bypasses RLS!
```

### ✅ DO: Fetch user details from Clerk

```typescript
import { clerkClient } from '@clerk/nextjs/server'

const user = await clerkClient.users.getUser(clerkUserId)
console.log(user.firstName, user.emailAddresses[0].emailAddress)
```

### ❌ DON'T: Store user details in Supabase

```typescript
// Bad - will get out of sync
await supabase.from('user_profile').update({
  email: 'new@example.com' // Don't do this!
})
```

## Testing Data Model

### Unit Tests

Use Supabase client with mocked auth:
```typescript
// Set JWT claims in test
process.env.JWT_CLAIMS = JSON.stringify({
  sub: 'user_123',
  o: { id: 'org_456' }
})
```

### Integration Tests

Use Clerk test tokens:
```typescript
import { createClerkClient } from '@clerk/backend'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const token = await clerk.sessions.getToken(sessionId, 'supabase')
```

### RLS Tests

Verify policies work:
```sql
-- Should return only org's data
SET request.jwt.claims = '{"sub": "user_123", "o": {"id": "org_456"}}';
SELECT * FROM mentor_bot; -- Should filter by org_456

-- Should return nothing
SET request.jwt.claims = '{"sub": "user_123", "o": {"id": "org_999"}}';
SELECT * FROM mentor_bot; -- Should be empty
```

## Monitoring & Maintenance

### Check for orphaned records

```sql
-- User profiles without Clerk users (check via Clerk API)
SELECT clerk_user_id, COUNT(*) FROM user_profile GROUP BY clerk_user_id;

-- Documents with no bot associations
SELECT d.id, d.file_name
FROM document d
LEFT JOIN bot_document bd ON bd.document_id = d.id
WHERE bd.document_id IS NULL;
```

### Performance optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM conversation WHERE clerk_user_id = 'user_123';

-- Ensure indexes exist
CREATE INDEX CONCURRENTLY idx_conversation_clerk_user_id
ON conversation(clerk_user_id);
```

### Data retention

Consider archiving old data:
```sql
-- Archive conversations older than 1 year
INSERT INTO conversation_archive
SELECT * FROM conversation WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM conversation WHERE created_at < NOW() - INTERVAL '1 year';
```

## Related Documentation

- [CLERK_INTEGRATION.md](./CLERK_INTEGRATION.md) - Clerk integration details
- [CLERK_WEBHOOK_SETUP.md](./CLERK_WEBHOOK_SETUP.md) - Webhook configuration
- [PHASE_3_COMPLETION_REPORT.md](./PHASE_3_COMPLETION_REPORT.md) - Migration report
