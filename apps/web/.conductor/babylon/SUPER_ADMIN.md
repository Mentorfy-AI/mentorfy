# Super Admin Access Guide

This guide explains how Mentorfy staff can access customer accounts and internal tools.

## Customer Support & Debugging

### Using Clerk Impersonation

To access a customer's account and see exactly what they see:

1. **Log in to Clerk Dashboard**
   - Go to https://dashboard.clerk.com
   - Navigate to your Mentorfy application

2. **Find the User**
   - Go to "Users" section
   - Search for the user by email or name

3. **Impersonate the User**
   - Click on the user's profile
   - Click the "Impersonate" button
   - You'll be logged in as that user in a new tab

4. **Access Their Organization**
   - You'll automatically have access to their organization(s)
   - You'll inherit their role (admin, team member, or student)
   - You can switch between their organizations using the org switcher

5. **Exit Impersonation**
   - Look for the impersonation banner at the top of the page
   - Click "Stop impersonation" to return to your own account

### What You Can Do While Impersonating

- ✅ View their dashboard and data
- ✅ Upload documents on their behalf
- ✅ Test chat functionality
- ✅ Modify bot settings
- ✅ Access all features they have access to
- ✅ Troubleshoot issues in their exact context

### Audit Trail

- All impersonation sessions are logged in Clerk
- You can see who impersonated whom and when
- This provides accountability and security

## Internal Tools Access

### Agent Console

The `/agent-console` route is an internal Mentorfy tool accessible only to super admins.

**How to Access:**

1. Your Clerk user ID must be added to the `super_admin` table in Supabase
2. Navigate to `/agent-console` when logged into the app
3. The middleware will check the `super_admin` table and grant access

**Adding a New Super Admin:**

```sql
-- In Supabase SQL Editor
INSERT INTO super_admin (clerk_user_id)
VALUES ('user_xxxxxxxxxxxxx');
```

Get your Clerk user ID from:
- Clerk Dashboard → Users → Your Profile
- Or from the Clerk `<UserButton />` component when logged in

## Security Architecture

### Two-Level Access Control

1. **Customer Data Access** → Clerk Impersonation
   - Built-in audit trail
   - Session-based, temporary access
   - Clerk handles all security
   - No custom cross-org logic needed

2. **Internal Tools Access** → Super Admin Table
   - Supabase `super_admin` table verification
   - Middleware-level protection
   - Only for internal Mentorfy features
   - Does NOT bypass org-scoped data access

### Why This Approach?

- **Simple**: No complex cross-org access logic
- **Secure**: Uses Clerk's battle-tested impersonation
- **Auditable**: Complete trail of who accessed what
- **Maintainable**: Less custom code to maintain
- **Fast**: Quick to implement and use

## Best Practices

1. **Always use impersonation for customer support** - Don't create custom super admin bypass logic
2. **Document why you impersonated** - Leave a note in your support ticket
3. **Limit super admin table entries** - Only add Mentorfy staff
4. **Exit impersonation when done** - Don't stay impersonated longer than needed
5. **Test in impersonation mode** - Reproduce customer issues in their exact context

## Troubleshooting

**Can't access agent-console?**
- Verify your `clerk_user_id` is in the `super_admin` table
- Check that you're logged in to the correct account
- Look at browser console for security logs

**Impersonation not working?**
- Make sure you have proper permissions in Clerk dashboard
- Check that the user exists and is active
- Verify you're on a paid Clerk plan (impersonation requires it)

**Need to add a new super admin?**
- Get their Clerk user ID from Clerk dashboard
- Add to `super_admin` table in Supabase
- They'll have immediate access after page refresh
