# Clerk Integration Guide

## Overview

Mentorfy uses **Clerk** for authentication and **Supabase** for app data storage. This guide explains how these systems work together to provide secure, multi-tenant access to data.

## Architecture

### The Flow

```
User → Clerk (Auth) → JWT Token → Supabase (Data) → RLS Policies
```

1. User authenticates with Clerk
2. Clerk generates JWT with user/org claims
3. Next.js middleware validates JWT
4. Supabase client passes JWT in Authorization header
5. Supabase RLS reads JWT claims to filter data
6. User sees only their org's data ✅

### Key Principle

**Clerk is the source of truth for identity. Supabase is the source of truth for app data.**

## Clerk JWT Structure

### What's in the Token

```json
{
  "sub": "user_2xyz...",           // Clerk user ID
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "o": {                           // Organization (if user is in org context)
    "id": "org_abc123",            // Clerk org ID
    "name": "Acme School",
    "role": "org:admin"            // User's role in this org
  },
  "iat": 1234567890,
  "exp": 1234571490
}
```

### How Supabase Reads It

Supabase has a helper function to extract claims:

```sql
CREATE OR REPLACE FUNCTION requesting_owner_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'o' ->> 'id',  -- Extract org ID from JWT
    ''
  );
$$ LANGUAGE SQL STABLE;
```

Used in RLS policies:

```sql
CREATE POLICY "Users see only their org's bots"
ON mentor_bot FOR SELECT
TO authenticated
USING (clerk_org_id = requesting_owner_id());
```

## Supabase Client Types

### 1. createClerkSupabaseClient() - Standard Client

**Use for:** 99% of authenticated operations

```typescript
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export async function GET() {
  const supabase = await createClerkSupabaseClient()

  // RLS automatically filters by user's org
  const { data } = await supabase
    .from('mentor_bot')
    .select('*')

  return Response.json(data)
}
```

**How it works:**
1. Calls `auth()` from Clerk to get session
2. Gets Clerk JWT token via `getToken()`
3. Passes token in `Authorization: Bearer <token>` header
4. Supabase RLS reads JWT claims
5. Filters data by `clerk_org_id`

**Important:** This client respects RLS - users can only see their org's data.

### 2. createClient() - Anonymous/Basic Client

**Use for:** Rare cases without Clerk context

```typescript
import { createClient } from '@/lib/supabase-server'

const supabase = createClient()
```

**When to use:**
- Public data access (no auth required)
- Server Components where Clerk context not available
- Legacy code (prefer `createClerkSupabaseClient()`)

**Note:** This still respects RLS, but without Clerk JWT claims, most policies will deny access.

### 3. createServiceClient() - Admin Client

**Use for:** System operations that bypass RLS

```typescript
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

// ⚠️ This bypasses RLS - be careful!
const { data } = await supabase
  .from('user_profile')
  .insert({ clerk_user_id: userId, clerk_org_id: orgId })
```

**When to use:**
- **Webhooks** - Creating/deleting user profiles
- **Middleware fallback** - Ensuring profiles exist
- **Admin operations** - Cross-org reporting
- **Migrations** - Bulk data operations

**⚠️ Warning:** This bypasses all RLS policies. Only use when necessary.

## When to Use Which Client

| Scenario | Client | Reason |
|----------|--------|--------|
| API route for users | `createClerkSupabaseClient()` | RLS filters by user's org |
| Server component | `createClerkSupabaseClient()` | Same as above |
| Clerk webhook handler | `createServiceClient()` | System creating profiles |
| Middleware profile check | `createServiceClient()` | System ensuring profiles exist |
| Admin dashboard | `createClerkSupabaseClient()` | Let RLS handle access control |
| Data migration script | `createServiceClient()` | Need full database access |
| Public landing page | `createClient()` | No auth needed |

## Webhook Sync Strategy

### Events We Handle

Clerk sends webhooks for these events (configured at https://dashboard.clerk.com):

| Event | Action | Why |
|-------|--------|-----|
| `organizationMembership.created` | Create `user_profile` | User joined org |
| `organizationMembership.deleted` | Delete `user_profile` | User left org |
| `organization.created` | Create `organization` | New org created |
| `organization.updated` | Update `organization` | Org name changed |
| `user.created` | Log event | Profile created when joining org |

### Webhook Handler

**File:** `app/api/webhooks/clerk/route.ts`

**Key features:**
- **Idempotent** - Safe to retry (uses `ON CONFLICT`)
- **Fast** - Returns 200 quickly, processes in background if needed
- **Secure** - Verifies webhook signature using `CLERK_WEBHOOK_SECRET`

**Example:**

```typescript
case 'organizationMembership.created': {
  const { organization, user } = evt.data

  // Idempotent insert - safe to run multiple times
  const { error } = await supabase.from('user_profile').insert({
    clerk_user_id: user.id,
    clerk_org_id: organization.id,
    summary: null,
    metadata: {},
  })

  // Ignore duplicate errors (race condition)
  if (error && error.code !== '23505') {
    console.error('Failed to create user profile:', error)
  }

  break
}
```

**Webhook URL:** `https://your-domain.com/api/webhooks/clerk`

**Security:** Webhooks are verified using SVIX signatures (Clerk's webhook provider).

## Middleware Fallback Strategy

### Why We Need It

Webhooks can fail for several reasons:
- Network issues
- Webhook endpoint down during deployment
- Clerk webhook delivery delays
- Race conditions

**Solution:** Middleware creates missing profiles automatically.

### How It Works

**File:** `middleware.ts`

On every authenticated request:
1. Check if user has active org (`orgId` from Clerk)
2. Call `ensureOrganization(orgId)` → Upserts org record
3. Call `ensureUserProfile(userId, orgId)` → Creates profile if missing
4. Continue to route (non-blocking)

**File:** `lib/ensure-user-profile.ts`

```typescript
export async function ensureUserProfile(
  clerkUserId: string,
  clerkOrgId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient() // Bypass RLS

  // Check if exists
  const { data: existing } = await supabase
    .from('user_profile')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .eq('clerk_org_id', clerkOrgId)
    .maybeSingle()

  if (existing) return { success: true } // Already exists

  // Create if missing
  const { error } = await supabase.from('user_profile').insert({
    clerk_user_id: clerkUserId,
    clerk_org_id: clerkOrgId,
    summary: null,
    metadata: {},
  })

  // Ignore duplicate errors (webhook created it)
  if (error?.code === '23505') {
    return { success: true }
  }

  return { success: !error, error: error?.message }
}
```

**Performance:**
- Fast check (SELECT with index)
- Only writes if missing (~1% of requests)
- Non-blocking (won't break requests if it fails)

### Fallback Guarantees

**Primary:** Webhooks create profiles within seconds of user joining org

**Fallback:** Middleware creates profile on user's first request (if webhook failed)

**Result:** User can always access app immediately after joining org ✅

## Testing Authentication Flows

### 1. Test User Signup Flow

```typescript
// Create test user in Clerk Dashboard
// Invite to organization
// User accepts → webhook fires

// Verify profile created
const { data } = await supabase
  .from('user_profile')
  .select('*')
  .eq('clerk_user_id', 'user_xyz')
  .single()

console.log(data) // Should exist
```

### 2. Test RLS Policies

```sql
-- Connect to Supabase SQL editor
-- Simulate user with org context

SET request.jwt.claims = '{
  "sub": "user_123",
  "o": {"id": "org_456"}
}';

-- Should return only org_456 data
SELECT * FROM mentor_bot;

-- Change org
SET request.jwt.claims = '{
  "sub": "user_123",
  "o": {"id": "org_999"}
}';

-- Should return different data (or nothing if no bots in org_999)
SELECT * FROM mentor_bot;
```

### 3. Test Webhook Delivery

**Clerk Dashboard → Webhooks → Testing**

1. Send test `organizationMembership.created` event
2. Check webhook logs for 200 response
3. Verify profile created in Supabase

**Check logs:**

```bash
# Next.js logs
tail -f .next/trace

# Supabase logs (if enabled)
# Check in Supabase Dashboard → Database → Logs
```

### 4. Test Middleware Fallback

```typescript
// Delete a user profile manually
await supabase
  .from('user_profile')
  .delete()
  .eq('clerk_user_id', 'user_xyz')

// Make authenticated request as that user
// Middleware should recreate profile automatically

// Verify profile exists again
const { data } = await supabase
  .from('user_profile')
  .select('*')
  .eq('clerk_user_id', 'user_xyz')
  .single()

console.log(data) // Should exist (created by middleware)
```

## Common Integration Patterns

### Pattern 1: Fetch User Details for Display

```typescript
import { clerkClient } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export async function GET() {
  const supabase = await createClerkSupabaseClient()

  // Get user profiles (app data)
  const { data: profiles } = await supabase
    .from('user_profile')
    .select('clerk_user_id, summary')

  // Enrich with Clerk data
  const enriched = await Promise.all(
    profiles.map(async (profile) => {
      const user = await clerkClient.users.getUser(profile.clerk_user_id)
      return {
        ...profile,
        name: `${user.firstName} ${user.lastName}`,
        email: user.emailAddresses[0]?.emailAddress,
      }
    })
  )

  return Response.json(enriched)
}
```

**Why:** Never store names/emails in Supabase - always fetch from Clerk.

### Pattern 2: Validate Org Access

```typescript
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export async function DELETE(
  req: Request,
  { params }: { params: { botId: string } }
) {
  const { orgId } = await auth()
  if (!orgId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = await createClerkSupabaseClient()

  // RLS will automatically check clerk_org_id matches
  const { error } = await supabase
    .from('mentor_bot')
    .delete()
    .eq('id', params.botId)

  if (error) {
    return new Response('Not found or unauthorized', { status: 404 })
  }

  return new Response('Deleted', { status: 200 })
}
```

**Why:** RLS handles org validation automatically - no manual checks needed.

### Pattern 3: Create Org-Scoped Resource

```typescript
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export async function POST(req: Request) {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const supabase = await createClerkSupabaseClient()

  // Always include clerk_org_id when creating resources
  const { data, error } = await supabase
    .from('mentor_bot')
    .insert({
      clerk_org_id: orgId,  // ⬅️ Critical!
      name: body.name,
      description: body.description,
    })
    .select()
    .single()

  return Response.json(data)
}
```

**Why:** Always set `clerk_org_id` to ensure proper scoping.

### Pattern 4: Handle Organization Switching

```typescript
// User switches org in Clerk org picker
// Next request automatically has new orgId in JWT

import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { orgId } = await auth()

  // This orgId reflects current org selection
  // RLS automatically filters data by this org

  const supabase = await createClerkSupabaseClient()
  const { data } = await supabase.from('mentor_bot').select('*')

  // Returns only current org's bots
  return Response.json(data)
}
```

**Why:** Org switching is automatic - JWT updates, RLS filters change.

## Troubleshooting

### Issue: User can't see any data

**Symptoms:**
- Queries return empty arrays
- No error messages

**Diagnosis:**
```typescript
const { orgId } = await auth()
console.log('Current org:', orgId)

const { data, error } = await supabase
  .from('mentor_bot')
  .select('*')

console.log('Data:', data, 'Error:', error)
```

**Possible causes:**
1. User not in an organization → `orgId` is null
2. RLS policy too restrictive
3. Using wrong Supabase client (not passing JWT)

**Fix:**
- Ensure user is in org (check Clerk Dashboard)
- Verify RLS policies allow access
- Use `createClerkSupabaseClient()` not `createServiceClient()`

### Issue: Webhook not creating profiles

**Symptoms:**
- User joins org in Clerk
- Profile not created in Supabase
- Middleware creates profile on first request (delayed)

**Diagnosis:**
1. Check Clerk webhook logs (Dashboard → Webhooks)
2. Check Next.js server logs for webhook handler
3. Verify webhook secret matches

**Possible causes:**
1. Webhook endpoint not accessible (firewall/deployment)
2. Wrong webhook secret in env vars
3. Webhook handler crashing

**Fix:**
- Check webhook endpoint is publicly accessible
- Verify `CLERK_WEBHOOK_SECRET` in environment
- Review webhook handler error logs

### Issue: RLS policies denying access

**Symptoms:**
- Error: "new row violates row-level security policy"
- Insertions failing even for own org

**Diagnosis:**
```sql
-- Check current JWT claims
SELECT auth.jwt();

-- Check what requesting_owner_id() returns
SELECT requesting_owner_id();

-- Manually test policy
SELECT * FROM mentor_bot WHERE clerk_org_id = requesting_owner_id();
```

**Possible causes:**
1. JWT not being passed (using wrong client)
2. Org ID in JWT doesn't match database
3. RLS policy has typo

**Fix:**
- Use `createClerkSupabaseClient()` for authenticated requests
- Verify `clerk_org_id` values match Clerk
- Review RLS policy syntax

### Issue: Cross-org data leaking

**Symptoms:**
- User seeing other orgs' data
- Security violation

**Diagnosis:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check policies exist
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public';
```

**Possible causes:**
1. RLS not enabled on table
2. Policy missing or incorrect
3. Using service client when shouldn't

**Fix:**
- Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Add missing policies
- Never use `createServiceClient()` for user requests

## Security Best Practices

### 1. Always Use RLS

Never rely on application code alone for access control:

```typescript
// ❌ Bad - can be bypassed
if (data.clerk_org_id !== userOrgId) {
  return new Response('Forbidden', { status: 403 })
}

// ✅ Good - database enforces it
const { data } = await supabase
  .from('mentor_bot')
  .select('*')
  .eq('id', botId)
// RLS automatically filters by clerk_org_id
```

### 2. Validate Clerk Webhooks

Always verify webhook signatures:

```typescript
import { Webhook } from 'svix'

const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
const evt = wh.verify(bodyString, headers)
// Throws error if signature invalid
```

### 3. Never Store Sensitive Clerk Data

```typescript
// ❌ Don't store in Supabase
await supabase.from('user_profile').insert({
  email: user.email,          // NO!
  password_hash: user.hash,   // DEFINITELY NO!
})

// ✅ Only store app-specific data
await supabase.from('user_profile').insert({
  clerk_user_id: user.id,     // Reference only
  summary: 'Student profile', // App data
})
```

### 4. Use Service Client Sparingly

```typescript
// ✅ OK for webhooks
const supabase = createServiceClient()
await supabase.from('user_profile').insert(...)

// ❌ Never for user requests
export async function GET() {
  const supabase = createServiceClient() // NO! Bypasses RLS
  return Response.json(await supabase.from('mentor_bot').select('*'))
}
```

### 5. Log Security Events

```typescript
console.log('[SECURITY] User access:', {
  userId,
  orgId,
  resource: 'mentor_bot',
  action: 'delete',
  timestamp: new Date().toISOString(),
})
```

## Environment Variables

Required for Clerk + Supabase integration:

```bash
# Clerk (from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase (from Supabase Dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Client-side
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Server-side (NEVER expose to client!)
```

**Security notes:**
- `NEXT_PUBLIC_*` vars are exposed to browser - safe for these keys
- `CLERK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must stay server-side
- Rotate webhook secret if compromised

## Related Documentation

- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema reference
- [CLERK_WEBHOOK_SETUP.md](./CLERK_WEBHOOK_SETUP.md) - Webhook configuration guide
- [Clerk Docs](https://clerk.com/docs) - Official Clerk documentation
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security) - RLS deep dive
