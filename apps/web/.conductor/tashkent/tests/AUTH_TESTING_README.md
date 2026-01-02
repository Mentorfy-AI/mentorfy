# Auth Integration Testing System

Automated authentication and authorization testing using AI agents and Playwright.

## Overview

This system uses a Claude Code subagent to automatically test auth boundaries across 4 user tiers:
1. **no_org_user** - User without organization (blocked from all features)
2. **org_member** - Organization team member (full org access)
3. **org_admin** - Organization admin (same as member currently)
4. **mentorfy_staff** - Platform super admin (agent console access)

## Test Credentials

Test users are pre-created in Clerk with credentials stored in `.auth-test-credentials.json` (gitignored).

### Test Users:
- `noorg@test.mentorfy.com` - No org user
- `member@test.mentorfy.com` - Org member (org_33WqphCb3M2plNHar6ETQ4mtVue)
- `admin@test.mentorfy.com` - Org admin (org_33WqphCb3M2plNHar6ETQ4mtVue)
- `staff@mentorfy.com` - Super admin (org_33UFSqLVk0EvBjkVlh6E7ZaiCqL)

All passwords: `TestPassword123!`

## Test Scenarios

Scenarios are defined in `tests/auth-scenarios.json` and include:

1. **No Org User Blocking** - Verify redirect to `/no-organization`
2. **Org Feature Access** - Member/admin can access dashboard, students, bot settings
3. **Agent Console Access** - Only staff can access `/agent-console`
4. **Cross-Tenant Isolation** - Users cannot access other orgs' bots/documents
5. **Upload Permissions** - Verify upload functionality availability

## How to Run Tests

### Via Claude Code Chat:

Simply ask Claude Code to run the auth integration tests:

```
Run the auth-tester agent to validate all authentication boundaries
```

Or be more specific:

```
Use the auth-tester agent to test the agent console access for all user tiers
```

### What the Agent Does:

1. Reads credentials from `.auth-test-credentials.json`
2. Reads scenarios from `tests/auth-scenarios.json`
3. For each user tier:
   - Signs in via Clerk UI
   - Executes all test scenarios
   - Verifies expected vs actual behavior
   - Properly signs out and cleans state
4. Reports findings with evidence

## Expected Test Results

### ✅ Should Pass:
- no_org_user redirected from all protected routes
- org_member/admin can access all org features
- Only mentorfy_staff can access `/agent-console`
- Cross-org data isolation enforced

### ❌ Should Fail (Auth Violation):
- If no_org_user can access dashboard
- If org_member can access other org's bots
- If org_member can access agent console
- If mentorfy_staff cannot access agent console

## Agent Configuration

The test agent is configured in `.claud/agents/auth-tester.md` with:
- Detailed testing protocol
- Session cleanup instructions (Clerk-specific)
- Technical context about auth implementation
- Reporting format requirements

## Test Data

### Organizations:
- **Auth Test Organization** (`org_33WqphCb3M2plNHar6ETQ4mtVue`) - For member/admin testing
- **Mentorfy Internal** (`org_33UFSqLVk0EvBjkVlh6E7ZaiCqL`) - For staff testing

### Test Bots (in existing Test Organization):
- Specialist Bot (`7b18f35c-9197-4d85-aedc-4e3a69500c5b`)
- Elise Pham Bot (`1a10f4de-456b-48d0-8237-4161c1711096`)

## Maintenance

### Adding New Test Scenarios:

Edit `tests/auth-scenarios.json`:

```json
{
  "name": "New Test Scenario",
  "allowedRoles": ["org_admin"],
  "deniedRoles": ["no_org_user", "org_member"],
  "test": {
    "navigate": "/new-route",
    "expectForAllowed": "page loads",
    "expectForDenied": "403 or redirect"
  }
}
```

### Updating User Tiers:

If role permissions change, update:
1. `.claud/agents/auth-tester.md` - Update expected access levels
2. `tests/auth-scenarios.json` - Update allowedRoles/deniedRoles

### Resetting Test Users:

If credentials are compromised or need reset, use Clerk dashboard to:
1. Delete existing test users
2. Recreate with same emails
3. Update `.auth-test-credentials.json` with new passwords/IDs

## Troubleshooting

**Issue**: Agent can't sign in
- Check if dev server is running (`npm run dev`)
- Verify Clerk configuration in `.env.local`
- Check test user credentials are correct

**Issue**: Session bleed between users
- Verify agent is properly executing cleanup sequence
- Check Clerk sign-out is working in UI

**Issue**: RLS violations not detected
- Agent tests UI-level access, not database-level RLS
- Consider adding explicit API endpoint tests

## Security Notes

⚠️ **Important**:
- `.auth-test-credentials.json` is gitignored (contains passwords)
- Test users are marked with `@test.mentorfy.com` domain
- These are for **testing only** - not production accounts
- Super admin table entry for staff user is test data only
