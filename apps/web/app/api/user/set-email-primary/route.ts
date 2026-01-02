import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/user/set-email-primary
 *
 * Sets user's email as primary identification method.
 * This ensures magic links work even if phone is later removed.
 *
 * Since users sign up via phone (SMS), their email is initially unverified.
 * We use updateEmailAddress to mark it as verified and primary in one call.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Find user by email
    const users = await client.users.getUserList({
      emailAddress: [email],
    });

    if (users.data.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users.data[0];

    // Find the email address ID
    const emailAddress = user.emailAddresses.find(
      (e) => e.emailAddress === email
    );

    if (!emailAddress) {
      return NextResponse.json(
        { error: 'Email address not found on user' },
        { status: 404 }
      );
    }

    // If email is already verified and primary, nothing to do
    if (emailAddress.id === user.primaryEmailAddressId) {
      console.log('[USER] Email already primary:', {
        userId: user.id,
        email: email,
      });
      return NextResponse.json({ success: true, alreadyPrimary: true });
    }

    // Step 1: Mark email as verified (required before it can be primary)
    if (emailAddress.verification?.status !== 'verified') {
      await client.emailAddresses.updateEmailAddress(emailAddress.id, {
        verified: true,
      });
      console.log('[USER] Marked email as verified:', {
        userId: user.id,
        email: email,
        emailAddressId: emailAddress.id,
      });
    }

    // Step 2: Set as primary via updateUser (more reliable than updateEmailAddress)
    await client.users.updateUser(user.id, {
      primaryEmailAddressID: emailAddress.id,
    });

    console.log('[USER] Set email as primary:', {
      userId: user.id,
      email: email,
      emailAddressId: emailAddress.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[USER] Failed to set email as primary:', {
      error: error.message,
      code: error.errors?.[0]?.code,
      clerkMessage: error.errors?.[0]?.message,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to set email as primary' },
      { status: 500 }
    );
  }
}
