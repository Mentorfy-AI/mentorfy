import { clerkClient, auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { formatPhoneE164 } from '@/lib/auth/check-account-logic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/user/update-profile
 *
 * Updates a Clerk user's profile with any missing fields from form submission
 * This allows existing users to have their profile enriched with form data
 *
 * SECURITY: Validates authenticated user matches the userId being updated
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from Clerk JWT
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, profile } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'profile is required' },
        { status: 400 }
      );
    }

    // CRITICAL SECURITY CHECK: Ensure authenticated user matches requested userId
    if (authenticatedUserId !== userId) {
      console.error('[UPDATE_PROFILE] Security: attempt to update different user:', {
        authenticatedUserId,
        requestedUserId: userId,
      });
      return NextResponse.json(
        { error: "Forbidden - cannot update another user's profile" },
        { status: 403 }
      );
    }

    const client = await clerkClient();

    // Get current user to check what fields are missing
    const user = await client.users.getUser(userId);

    console.log('[UPDATE_PROFILE] Current user state:', {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      primaryEmailAddressId: user.primaryEmailAddressId,
      primaryPhoneNumberId: user.primaryPhoneNumberId,
      emailCount: user.emailAddresses.length,
      phoneCount: user.phoneNumbers.length,
    });

    // Build update payload for missing fields
    const updates: any = {};

    if (!user.firstName && profile.firstName) {
      updates.firstName = profile.firstName;
    }

    if (!user.lastName && profile.lastName) {
      updates.lastName = profile.lastName;
    }

    // Handle email: either set existing as primary, or add new one
    // Two-step process: 1) verify email, 2) set as primary via updateUser
    if (!user.primaryEmailAddressId && profile.email) {
      // Check if email already exists on user
      const existingEmail = user.emailAddresses.find(
        (e) => e.emailAddress === profile.email
      );

      if (existingEmail) {
        // Email exists but isn't primary
        // Step 1: Mark as verified if needed
        if (existingEmail.verification?.status !== 'verified') {
          await client.emailAddresses.updateEmailAddress(existingEmail.id, {
            verified: true,
          });
          console.log('[UPDATE_PROFILE] Marked email as verified:', {
            userId,
            email: profile.email,
            emailAddressId: existingEmail.id,
          });
        }
        // Step 2: Set as primary via updateUser
        updates.primaryEmailAddressID = existingEmail.id;
        console.log('[UPDATE_PROFILE] Will set email as primary:', {
          userId,
          email: profile.email,
          emailAddressId: existingEmail.id,
        });
      } else {
        // Email doesn't exist - create it as verified
        try {
          const newEmail = await client.emailAddresses.createEmailAddress({
            userId,
            emailAddress: profile.email,
            verified: true,
          });
          // Set as primary via updateUser
          updates.primaryEmailAddressID = newEmail.id;
          console.log('[UPDATE_PROFILE] Added new verified email, will set as primary:', {
            userId,
            email: profile.email,
            emailAddressId: newEmail.id,
          });
        } catch (clerkEmailError: any) {
          // If email already exists (race condition), log and continue
          if (clerkEmailError.errors?.[0]?.code === 'form_identifier_exists') {
            console.log('[UPDATE_PROFILE] Email already exists, skipping:', profile.email);
          } else {
            throw clerkEmailError;
          }
        }
      }
    }

    // Handle phone: either set existing as primary, or add new one
    // Phone should already be E.164 format, but formatPhoneE164 handles legacy 10-digit numbers
    if (!user.primaryPhoneNumberId && profile.phone) {
      const phoneE164 = formatPhoneE164(profile.phone);
      const existingPhone = user.phoneNumbers.find(
        (p) => p.phoneNumber === phoneE164
      );

      if (existingPhone) {
        // Phone exists but isn't primary - set it as primary
        updates.primaryPhoneNumberID = existingPhone.id;
        console.log('[UPDATE_PROFILE] Setting existing phone as primary:', {
          userId,
          phone: phoneE164,
          phoneNumberId: existingPhone.id,
        });
      } else {
        // Phone doesn't exist - create it (verified since they just used SMS)
        try {
          const newPhone = await client.phoneNumbers.createPhoneNumber({
            userId,
            phoneNumber: phoneE164,
            verified: true,
            reservedForSecondFactor: false,
          });
          updates.primaryPhoneNumberID = newPhone.id;
          console.log('[UPDATE_PROFILE] Added new phone to user:', {
            userId,
            phone: phoneE164,
            phoneNumberId: newPhone.id,
          });
        } catch (clerkPhoneError: any) {
          if (clerkPhoneError.errors?.[0]?.code === 'form_identifier_exists') {
            console.log('[UPDATE_PROFILE] Phone already exists, skipping:', phoneE164);
          } else {
            throw clerkPhoneError;
          }
        }
      }
    }

    // Apply all updates in one call
    if (Object.keys(updates).length > 0) {
      await client.users.updateUser(userId, updates);
      console.log('[UPDATE_PROFILE] Updated user:', { userId, updates });
    } else {
      console.log('[UPDATE_PROFILE] No updates needed for user:', userId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[UPDATE_PROFILE] Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
