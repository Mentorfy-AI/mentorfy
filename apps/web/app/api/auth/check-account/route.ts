import { clerkClient } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import {
  determineAuthStrategy,
  formatPhoneE164,
  checkWhitelist,
  type CheckAccountResponse,
  type AuthStrategy,
  type BotWhitelistSettings,
  type StrategyContext,
} from '@/lib/auth/check-account-logic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Re-export types for consumers
export type { AuthStrategy, CheckAccountResponse };

/**
 * POST /api/auth/check-account
 *
 * Pre-flight check to determine the best authentication strategy
 * based on whether email/phone exist in Clerk.
 *
 * Strategies:
 * - NEW_SIGNUP: Neither email nor phone exist → create new account via SMS
 * - PHONE_SIGNIN: Email exists with phone → send SMS to existing phone
 * - MAGIC_LINK: Email exists without phone → send magic link to email
 * - PHONE_CONFLICT: Phone exists but email doesn't → user must sign in with their real email
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, phone, submissionId } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    // Validate submission exists and get bot for whitelist check
    const supabase = createServiceClient();
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .select('id, clerk_org_id, bot_id')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      console.error('[AUTH_CHECK] Invalid submission:', submissionId);
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
    }

    // Get whitelist from bot settings (whitelists now live on bots, not orgs)
    let whitelistSettings: BotWhitelistSettings | null = null;
    let strategyContext: StrategyContext = {};

    if (submission.bot_id) {
      const { data: bot } = await supabase
        .from('mentor_bot')
        .select('settings')
        .eq('id', submission.bot_id)
        .single();

      whitelistSettings = bot?.settings as BotWhitelistSettings | null;
    }

    // Fetch org settings for API keys (e.g., whop_api_key)
    // Some whitelist strategies require org-level credentials
    if (submission.clerk_org_id) {
      const { data: org } = await supabase
        .from('organization')
        .select('settings')
        .eq('clerk_org_id', submission.clerk_org_id)
        .single();

      const orgSettings = org?.settings as { whop_api_key?: string } | null;
      if (orgSettings?.whop_api_key) {
        strategyContext.whopApiKey = orgSettings.whop_api_key;
      }
    }

    // Check whitelist BEFORE doing any Clerk lookups
    // Async because some strategies (e.g., whop_customer) require API calls
    const whitelistResult = await checkWhitelist(email, whitelistSettings, strategyContext);
    if (whitelistResult && !whitelistResult.allowed) {
      console.log('[AUTH_CHECK] Email blocked by whitelist:', email);
      return NextResponse.json({
        strategy: 'WHITELIST_BLOCKED',
        blockedMessage: whitelistResult.blockedMessage,
      } satisfies CheckAccountResponse);
    }

    const client = await clerkClient();

    // Check if email exists
    const emailUsers = await client.users.getUserList({
      emailAddress: [email],
    });
    const clerkEmailUser = emailUsers.data[0];

    // Check if phone exists (format to E.164)
    const phoneE164 = formatPhoneE164(phone);
    const phoneUsers = await client.users.getUserList({
      phoneNumber: [phoneE164],
    });
    const clerkPhoneUser = phoneUsers.data[0];

    console.log('[AUTH_CHECK] Clerk lookup results:', {
      submissionId,
      email,
      phone: phoneE164,
      emailExists: !!clerkEmailUser,
      emailUserId: clerkEmailUser?.id || null,
      emailUserHasPhone: !!clerkEmailUser?.primaryPhoneNumberId,
      phoneExists: !!clerkPhoneUser,
      phoneUserId: clerkPhoneUser?.id || null,
      sameAccount:
        clerkEmailUser && clerkPhoneUser
          ? clerkEmailUser.id === clerkPhoneUser.id
          : null,
    });

    // Convert Clerk user objects to our simplified interface
    const emailUser = clerkEmailUser
      ? {
          id: clerkEmailUser.id,
          hasPhone: !!clerkEmailUser.primaryPhoneNumberId,
          phoneNumber: clerkEmailUser.phoneNumbers.find(
            (p) => p.id === clerkEmailUser.primaryPhoneNumberId
          )?.phoneNumber,
          emailAddress: clerkEmailUser.emailAddresses.find(
            (e) => e.id === clerkEmailUser.primaryEmailAddressId
          )?.emailAddress,
        }
      : null;

    const phoneUser = clerkPhoneUser
      ? {
          id: clerkPhoneUser.id,
          hasPhone: !!clerkPhoneUser.primaryPhoneNumberId,
          phoneNumber: clerkPhoneUser.phoneNumbers.find(
            (p) => p.id === clerkPhoneUser.primaryPhoneNumberId
          )?.phoneNumber,
          emailAddress: clerkPhoneUser.emailAddresses.find(
            (e) => e.id === clerkPhoneUser.primaryEmailAddressId
          )?.emailAddress,
        }
      : null;

    // Determine strategy using pure logic function
    // whitelistResult is non-null when org has a whitelist configured
    const result = determineAuthStrategy({
      emailUser,
      phoneUser,
      orgHasWhitelist: whitelistResult !== null,
    });

    console.log('[AUTH_CHECK] Strategy determined:', {
      submissionId,
      strategy: result.strategy,
      userId: result.userId || null,
      maskedPhone: result.maskedPhone || null,
      maskedEmail: result.maskedEmail || null,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AUTH_CHECK] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check account' },
      { status: 500 }
    );
  }
}
