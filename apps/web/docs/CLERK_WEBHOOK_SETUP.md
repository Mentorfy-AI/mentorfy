# Clerk Webhook Configuration

This guide explains how to configure Clerk webhooks to automatically sync user and organization data to your Supabase database.

## Why Webhooks Are Needed

After the Phase 1-3 migration, the application uses a **Clerk-first data model**:
- User identity (names, emails) stored only in Clerk
- Supabase stores app-specific data only (summaries, metadata)
- `user_profile` records must be created when users join organizations

Webhooks ensure that `user_profile` and `organization` records stay in sync automatically.

## Webhook Endpoint

Your webhook endpoint is: `https://your-app.vercel.app/api/webhooks/clerk`

## Events to Subscribe

Configure your Clerk webhook to listen for these events:

### Required Events
1. **`organizationMembership.created`** - Creates `user_profile` when user joins org
2. **`organizationMembership.deleted`** - Removes `user_profile` when user leaves org
3. **`organization.created`** - Syncs new organization to database
4. **`organization.updated`** - Updates organization name/metadata

### Optional Events (recommended)
5. **`user.created`** - Logs user creation (no action taken until org membership)

## Configuration Steps

### 1. Access Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your application (currently: `magnetic-tetra-73`)
3. Navigate to **Webhooks** in the left sidebar

### 2. Create Webhook Endpoint

1. Click **+ Add Endpoint**
2. Enter your endpoint URL:
   - Development: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk`
   - Production: `https://mentorfy.app/api/webhooks/clerk`

3. Subscribe to events (check the boxes):
   - `organizationMembership.created`
   - `organizationMembership.deleted`
   - `organization.created`
   - `organization.updated`
   - `user.created` (optional)

4. Click **Create**

### 3. Copy Signing Secret

1. After creating the webhook, you'll see a **Signing Secret** (starts with `whsec_...`)
2. Copy this secret
3. Add it to your `.env.local` file:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

4. **Important**: Also add this to your production environment variables (Vercel, Railway, etc.)

### 4. Test the Webhook

1. In Clerk Dashboard, go to your webhook
2. Click **Testing** tab
3. Send test events:
   - `organization.created`
   - `organizationMembership.created`

4. Check the **Webhook Logs** to verify successful delivery (200 status)

### 5. Verify Database Sync

After configuring webhooks, test the sync:

```sql
-- Check organization synced from Clerk
SELECT * FROM organization WHERE clerk_org_id = 'org_33XsKTrZLKrSf7krKYqrKvO65my';

-- Check user profiles created
SELECT * FROM user_profile;
```

Expected results:
- 1 organization record
- 3 user_profile records (for eli, brady, and staff users)

## How Webhooks Work

### Organization Created/Updated
```
Clerk event → Webhook handler → Upsert to organization table
```

Data synced:
- `clerk_org_id` (from Clerk)
- `name` (from Clerk)
- `settings` (empty JSON by default)

### Organization Membership Created
```
User joins org in Clerk → Webhook handler → Insert user_profile
```

Creates record:
```sql
INSERT INTO user_profile (clerk_user_id, clerk_org_id, summary, metadata)
VALUES ('user_abc', 'org_xyz', NULL, '{}');
```

### Organization Membership Deleted
```
User leaves org in Clerk → Webhook handler → Delete user_profile
```

Removes record:
```sql
DELETE FROM user_profile
WHERE clerk_user_id = 'user_abc' AND clerk_org_id = 'org_xyz';
```

## Fallback Mechanism

If webhooks fail or are delayed, the **middleware** provides a fallback:

1. User signs in with org → Middleware runs
2. Check if `user_profile` exists for (user, org)
3. If missing → Create it automatically
4. Continue request

This ensures the app works even if webhooks are down.

## Webhook Security

The webhook handler verifies Clerk's signature using `svix` library:

```typescript
const wh = new Webhook(CLERK_WEBHOOK_SECRET)
const evt = wh.verify(body, headers) // Throws if invalid
```

**Never expose your webhook endpoint without signature verification.**

## Monitoring Webhooks

### Clerk Dashboard
- View webhook delivery logs
- See retry attempts
- Check error messages

### Application Logs
Look for these log messages:
```
[Webhook] Organization org_xyz synced
[Webhook] User profile created for user_abc in org org_xyz
[Webhook] User profile deleted for user_abc in org org_xyz
```

### Database Queries
```sql
-- Verify profiles exist for all org members
SELECT
  up.clerk_user_id,
  up.clerk_org_id,
  up.created_at
FROM user_profile up
WHERE up.clerk_org_id = 'org_33XsKTrZLKrSf7krKYqrKvO65my';
```

## Troubleshooting

### Webhook Not Firing

1. Check Clerk Dashboard → Webhooks → Logs
2. Verify endpoint URL is correct
3. Check webhook is enabled
4. Verify events are subscribed

### Webhook Failing (500 errors)

1. Check application logs for errors
2. Verify `CLERK_WEBHOOK_SECRET` is correct
3. Check Supabase connection (service role key)
4. Verify database schema is correct

### User Profile Not Created

If a user profile is missing:

1. **Immediate fix**: Middleware will create it on next request
2. **Manual fix**:
   ```sql
   INSERT INTO user_profile (clerk_user_id, clerk_org_id)
   VALUES ('user_abc', 'org_xyz');
   ```
3. **Root cause**: Check webhook logs in Clerk Dashboard

### Duplicate Key Errors

Safe to ignore - webhooks use idempotent upserts:
```sql
ON CONFLICT (clerk_user_id, clerk_org_id) DO UPDATE ...
```

## Local Development

For local testing with webhooks:

1. Install ngrok: `npm install -g ngrok`
2. Start your dev server: `pnpm run dev`
3. Expose localhost: `ngrok http 3000`
4. Copy ngrok URL to Clerk webhook: `https://abc123.ngrok.io/api/webhooks/clerk`
5. Test by creating users/orgs in Clerk Dashboard

## Production Deployment

Before deploying:

1. ✅ Set `CLERK_WEBHOOK_SECRET` in production environment
2. ✅ Update Clerk webhook URL to production domain
3. ✅ Test webhook delivery in production
4. ✅ Monitor logs for first few days

## Next Steps

After webhook configuration:

1. Invite new users to your Clerk organization
2. Verify `user_profile` records created automatically
3. Check `/users` page shows all organization members
4. Monitor webhook logs for any errors

## Support

- Clerk Webhooks Documentation: https://clerk.com/docs/integrations/webhooks
- Svix (webhook signature verification): https://docs.svix.com
- Mentorfy Support: File an issue in GitHub
