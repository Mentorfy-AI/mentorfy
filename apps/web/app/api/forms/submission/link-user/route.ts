import { clerkClient } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { formatPhoneE164 } from '@/lib/auth/check-account-logic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Link an anonymous form submission to an authenticated Clerk user
 * Called after successful SMS verification
 *
 * NOTE: This endpoint does NOT use Clerk auth() because:
 * 1. It's called immediately after setActive() which has a race condition
 * 2. For new users: userId is passed directly from signUp result
 * 3. For existing users: phone is passed and we look up the user
 *
 * Optional: authenticatedEmail - if provided and different from form email,
 * stores mismatch info in metadata for the submissions dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const { submissionId, userId, phone, authenticatedEmail } = await req.json();

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID required' },
        { status: 400 }
      );
    }

    // Either userId or phone must be provided
    let resolvedUserId = userId;

    if (!resolvedUserId && phone) {
      // Look up user by phone number for existing users
      // Phone should already be E.164 format, but formatPhoneE164 handles legacy 10-digit numbers
      const client = await clerkClient();
      const users = await client.users.getUserList({
        phoneNumber: [formatPhoneE164(phone)],
      });

      if (users.data.length === 0) {
        return NextResponse.json(
          { error: 'User not found for phone number' },
          { status: 404 }
        );
      }

      resolvedUserId = users.data[0].id;
    }

    if (!resolvedUserId) {
      return NextResponse.json(
        { error: 'Either userId or phone required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient(); // Bypass RLS

    // First, get the submission to check for email mismatch
    const { data: submission, error: fetchError } = await supabase
      .from('form_submissions')
      .select('email, metadata')
      .eq('id', submissionId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch submission:', fetchError);
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      clerk_user_id: resolvedUserId,
      last_updated_at: new Date().toISOString(),
    };

    // Check for email mismatch
    const formEmail = submission.email;
    if (authenticatedEmail && formEmail && authenticatedEmail !== formEmail) {
      // Store mismatch info in metadata for dashboard visibility
      const existingMetadata = submission.metadata || {};
      updatePayload.metadata = {
        ...existingMetadata,
        authenticated_email: authenticatedEmail,
        email_mismatch: true,
        mismatch_detected_at: new Date().toISOString(),
      };

      console.log('[FORMS] Email mismatch detected:', {
        submissionId,
        formEmail,
        authenticatedEmail,
      });
    }

    // Update submission with authenticated user ID (and metadata if mismatch)
    const { error } = await supabase
      .from('form_submissions')
      .update(updatePayload)
      .eq('id', submissionId);

    if (error) {
      console.error('Failed to link submission:', error);
      return NextResponse.json(
        { error: 'Failed to link submission' },
        { status: 500 }
      );
    }

    console.log('[FORMS] Linked submission to user:', {
      submissionId,
      userId: resolvedUserId,
      emailMismatch: !!updatePayload.metadata?.email_mismatch,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error linking submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
