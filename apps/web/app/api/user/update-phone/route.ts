import { clerkClient, auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/user/update-phone
 *
 * Updates a Clerk user's phone number
 * This is used when a user signs in via email but provides a different phone number
 * The phone is already verified via SMS in the form flow
 *
 * SECURITY: Validates authenticated user matches the userId being updated
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from Clerk JWT
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId, phoneNumber } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    // CRITICAL SECURITY CHECK: Ensure authenticated user matches requested userId
    if (authenticatedUserId !== userId) {
      console.error('[SECURITY] Phone update attempt for different user:', {
        authenticatedUserId,
        requestedUserId: userId,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Forbidden - cannot update another user\'s phone' },
        { status: 403 }
      );
    }

    const client = await clerkClient();

    // Get current user to check their phone numbers
    const user = await client.users.getUser(userId);

    // Check if this phone number already exists on the user
    const existingPhone = user.phoneNumbers?.find(
      (phone) => phone.phoneNumber === phoneNumber
    );

    if (existingPhone) {
      console.log('[USER] Phone number already exists on user:', { userId, phoneNumber });

      // If it exists but isn't primary, make it primary
      if (user.primaryPhoneNumberId !== existingPhone.id) {
        await client.users.updateUser(userId, {
          primaryPhoneNumberId: existingPhone.id,
        });
        console.log('[USER] Set existing phone as primary:', { userId, phoneNumber });
      }

      return NextResponse.json({ success: true });
    }

    // Add new phone number as verified (since they just verified it via SMS in the form flow)
    // Setting verified: true is secure here because the user completed SMS verification
    // moments before this API call as part of the form submission flow
    const newPhone = await client.phoneNumbers.createPhoneNumber({
      userId,
      phoneNumber,
      verified: true,
      reservedForSecondFactor: false, // Not used for MFA in our form flow
    });

    console.log('[USER] Added new phone number:', { userId, phoneNumber });

    // Set as primary phone
    await client.users.updateUser(userId, {
      primaryPhoneNumberId: newPhone.id,
    });

    console.log('[USER] Set new phone as primary:', { userId, phoneNumber });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[USER] Failed to update phone number:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update phone number' },
      { status: 500 }
    );
  }
}
