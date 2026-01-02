# Auth Flow Manual Testing Guide

This document provides step-by-step instructions for manually testing all auth flow branches on production.

## Prerequisites

- [ ] Prod is deployed and running
- [ ] Clerk Dashboard open (prod instance)
- [ ] Vercel logs open (filter for `[AUTH]`)
- [ ] Incognito browser ready
- [ ] Your real phone number
- [ ] 3-4 email addresses you can **receive mail at** (use `+` aliases like `you+test1@gmail.com`)

## Monitoring Logs

### Vercel Logs (Server-side)

```bash
vercel logs --follow
```

Or use Vercel Dashboard → Project → Logs

**Key prefixes to watch:**
- `[AUTH_CHECK]` - strategy determination
- `[AUTH_ASSIGN_ORG]` - org membership assignment
- `[FORMS]` - submission linking, completion
- `[MAGIC_LINK]` - magic link flow

### Browser Console (Client-side)

Open DevTools (F12) → Console tab, filter for `[AUTH]`

### Example Log Flows

#### NEW_SIGNUP (no whitelist)

```
# Server
[AUTH_CHECK] Clerk lookup results: { submissionId: "xxx", email: "test@...", emailExists: false, phoneExists: false }
[AUTH_CHECK] Strategy determined: { submissionId: "xxx", strategy: "NEW_SIGNUP" }

# Client (browser)
[AUTH] Pre-flight check result: { strategy: "NEW_SIGNUP" }
[AUTH] Creating new user: { email: "...", phone: "+1..." }
[AUTH] SMS sent to new user
[AUTH] New user created: user_xxx
[AUTH] Submission linked to user

# Server
[AUTH_ASSIGN_ORG] Request received: { submissionId: "xxx", userId: "user_xxx" }
[FORMS] Assigned user to organization: { ... }
[FORMS] Form completion successful: { conversationId: "xxx" }
```

#### NEW_SIGNUP_WITH_EMAIL_VERIFICATION (whitelist enabled)

```
# Server
[AUTH_CHECK] Clerk lookup results: { submissionId: "xxx", email: "allowed@...", emailExists: false, phoneExists: false }
[AUTH_CHECK] Strategy determined: { submissionId: "xxx", strategy: "NEW_SIGNUP_WITH_EMAIL_VERIFICATION" }

# Client (browser)
[AUTH] Pre-flight check result: { strategy: "NEW_SIGNUP_WITH_EMAIL_VERIFICATION" }
[AUTH] Creating new user (email verification): { email: "...", phone: "+1..." }
[AUTH] Email verification sent to new user
[AUTH] New user created: user_xxx
[AUTH] Submission linked to user
```

#### WHITELIST_BLOCKED

```
# Server
[AUTH_CHECK] Email blocked by whitelist: blocked@example.com

# Client (browser)
[AUTH] Pre-flight check result: { strategy: "WHITELIST_BLOCKED", blockedMessage: "..." }
```

---

## Test 1: NEW_SIGNUP

**Goal:** Brand new user, no Clerk record exists, **no whitelist on org**

### Clerk Setup

1. Search Clerk for your phone number - delete any user that has it
2. Search for your test email - delete if exists

### Database Setup

Ensure the org does NOT have a whitelist:

```sql
-- Check org settings
SELECT clerk_org_id, settings FROM organization WHERE clerk_org_id = 'org_xxx';

-- Remove whitelist if present
UPDATE organization
SET settings = settings - 'email_whitelist'
WHERE clerk_org_id = 'org_xxx';
```

### Steps

1. Open incognito → go to `/f/{form-slug}`
2. Fill form with `you+new@gmail.com` + your phone
3. Submit → should see "Check your phone"
4. Enter SMS code
5. Should redirect to chat with greeting

### Verify

- [ ] Logs show `NEW_SIGNUP` strategy
- [ ] New user in Clerk with email + phone
- [ ] User assigned to correct org
- [ ] Conversation created in Supabase
- [ ] No errors in logs

### Cleanup

Leave this user - you'll use them for Test 2

---

## Test 2: PHONE_SIGNIN

**Goal:** Existing user signs in via phone

### Clerk Setup

None - use the user from Test 1

### Steps

1. Open NEW incognito window (or clear cookies)
2. Go to `/f/{form-slug}`
3. Fill form with SAME email + phone from Test 1
4. Submit → should see "Check your phone"
5. Enter SMS code
6. Should redirect to chat

### Verify

- [ ] No new user created in Clerk
- [ ] Same user signed in
- [ ] Logs show `PHONE_SIGNIN` strategy

### Cleanup

None yet

---

## Test 3: MAGIC_LINK

**Goal:** User has email in Clerk but NO phone number

### Clerk Setup

1. Go to the user from Test 1 in Clerk Dashboard
2. **Remove their phone number** (edit user → delete phone)
3. Confirm user only has email

### Steps

1. Open NEW incognito window
2. Go to `/f/{form-slug}`
3. Fill form with SAME email (`you+new@gmail.com`) + your phone
4. Submit → should see "Check your email" (magic link)
5. Check email, click magic link
6. Should prompt to add/verify phone
7. Complete phone verification
8. Should redirect to chat

### Verify

- [ ] Logs show `MAGIC_LINK` strategy
- [ ] User now has phone number in Clerk
- [ ] Redirect works after phone added

### Cleanup

Delete this user entirely from Clerk (need clean slate for Test 4)

---

## Test 4: PHONE_CONFLICT

**Goal:** Phone exists on User A, but someone submits form with User B's email

### Clerk Setup

1. Create User A manually in Clerk:
   - Email: `you+usera@gmail.com`
   - Phone: your real phone number
2. Confirm no user exists with email `you+userb@gmail.com`

### Steps

1. Open incognito → go to `/f/{form-slug}`
2. Fill form with `you+userb@gmail.com` (NEW email) + your phone (EXISTING)
3. Submit → should see "Phone Already Registered" screen
4. UI should hint that phone belongs to different account
5. Enter `you+usera@gmail.com` (the correct email)
6. Should send SMS to your phone
7. Enter code → should redirect to chat

### Verify

- [ ] Logs show `PHONE_CONFLICT` strategy
- [ ] Signed in as User A (not User B)
- [ ] Check `form_submissions` table - `metadata.email_mismatch` should be `true`

### Cleanup

Delete User A from Clerk

---

## Test 5: WHITELIST_BLOCKED

**Goal:** Org has whitelist, user's email is NOT on it

### Clerk Setup

Ensure your test email is NOT in Clerk

### Database Setup

```sql
-- Find your test org's clerk_org_id first
SELECT id, name, clerk_org_id, settings FROM organization;

-- Enable whitelist with a dummy email (replace org_xxx)
UPDATE organization
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{email_whitelist}',
  '["allowed@example.com"]'::jsonb
)
WHERE clerk_org_id = 'org_xxx';
```

### Steps

1. Open incognito → go to `/f/{form-slug}`
2. Fill form with `you+blocked@gmail.com` + your phone
3. Submit → should see "Access Restricted" screen
4. Should NOT receive SMS or email

### Verify

- [ ] Logs show `WHITELIST_BLOCKED` strategy
- [ ] No user created in Clerk
- [ ] No SMS or email sent
- [ ] User sees blocked message

### Cleanup

**Do NOT remove the whitelist yet** - continue to Test 6

---

## Test 6: NEW_SIGNUP_WITH_EMAIL_VERIFICATION

**Goal:** Org has whitelist, user's email IS on it, but user doesn't exist in Clerk yet

This tests the security flow that prevents attackers from claiming whitelisted emails they don't own.

### Clerk Setup

1. Ensure the test email (`you+allowed@gmail.com`) is NOT in Clerk
2. Ensure the test phone is NOT in Clerk

### Database Setup

Use the whitelist from Test 5, but add your test email to it:

```sql
-- Add your test email to the whitelist (replace org_xxx)
UPDATE organization
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{email_whitelist}',
  '["allowed@example.com", "you+allowed@gmail.com"]'::jsonb
)
WHERE clerk_org_id = 'org_xxx';
```

### Steps

1. Open incognito → go to `/f/{form-slug}`
2. Fill form with `you+allowed@gmail.com` (ON whitelist) + your phone
3. Submit → should see **"Check your email"** (NOT "Check your phone")
4. Check your email for a 6-digit verification code
5. Enter the code
6. Should redirect to chat with greeting

### Verify

- [ ] Logs show `NEW_SIGNUP_WITH_EMAIL_VERIFICATION` strategy
- [ ] UI shows email icon and "Check your email" (not phone)
- [ ] Verification code sent to email (not SMS)
- [ ] New user created in Clerk with email + phone
- [ ] User assigned to correct org
- [ ] Conversation created in Supabase

### Why This Matters

This flow prevents a security issue where an attacker could:
1. Know a victim's whitelisted email
2. Enter victim's email + attacker's phone
3. Receive SMS and create account with victim's email

By requiring email verification, only the actual email owner can complete signup.

### Cleanup

```sql
-- Remove whitelist
UPDATE organization
SET settings = settings - 'email_whitelist'
WHERE clerk_org_id = 'org_xxx';
```

Delete the test user from Clerk.

---

## Test 7: Already Authenticated

**Goal:** Logged-in user completes form without re-auth

### Setup

1. Log into prod normally (not via form)
2. Note which user you're logged in as

### Steps

1. While logged in, navigate to `/f/{form-slug}`
2. Fill and submit form
3. Should auto-redirect to chat (NO SMS, no email)

### Verify

- [ ] No auth prompts
- [ ] Form submission linked to current user
- [ ] Redirect to chat works

---

## Quick Reference: Clerk Cleanup Between Tests

| After Test | Action |
|------------|--------|
| Test 1 | Keep user |
| Test 2 | Keep user |
| Test 3 | Delete user |
| Test 4 | Delete User A |
| Test 5 | Keep whitelist, no user created |
| Test 6 | Remove whitelist, delete user |
| Test 7 | Optional |

---

## Auth Strategy Matrix

| Whitelist Configured? | Email on Whitelist? | Email in Clerk? | Phone in Clerk? | Same Account? | Strategy |
|-----------------------|---------------------|-----------------|-----------------|---------------|----------|
| Yes | No | - | - | - | `WHITELIST_BLOCKED` |
| Yes | Yes | No | No | - | `NEW_SIGNUP_WITH_EMAIL_VERIFICATION` |
| No | - | No | No | - | `NEW_SIGNUP` |
| - | - | Yes | Yes | Yes | `PHONE_SIGNIN` |
| - | - | Yes | No | - | `MAGIC_LINK` |
| - | - | No | Yes | - | `PHONE_CONFLICT` |

**Reading the matrix:**
- `-` means "doesn't matter for this row"
- Whitelist check happens FIRST, before any Clerk lookups
- If whitelist blocks, no Clerk operations occur

---

## Troubleshooting

### "Request not reaching backend"

1. Check if the API route has `export const dynamic = 'force-dynamic'`
2. Hard refresh browser (Cmd+Shift+R)
3. Restart Next.js dev server

### Clerk errors in logs

Look for these fields in error logs:
- `code` - Clerk error code
- `clerkMessage` - Human-readable message
- `longMessage` - Detailed explanation

### Common Clerk error codes

- `form_identifier_exists` - Email or phone already registered
- `form_password_incorrect` - Wrong verification code
- `verification_expired` - Code expired, need to resend

### Wrong verification UI showing

If you see "Check your phone" when you expected "Check your email" (or vice versa):
1. Check the logs for which strategy was returned
2. Verify whitelist configuration in database
3. Verify user doesn't already exist in Clerk
