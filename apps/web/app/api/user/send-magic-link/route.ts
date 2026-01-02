import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/user/send-magic-link
 *
 * Sends a magic sign-in link to a user's email
 * Used when existing user (email only, no phone) needs to claim account via form
 *
 * The magic link will redirect to /api/auth/verify-magic-link with:
 * - Clerk sign-in token
 * - submissionId (to complete form flow after sign-in)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, submissionId, redirectUrl } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    // SECURITY: Validate that submissionId exists and matches the userId
    // This prevents attackers from generating sign-in tokens for arbitrary users
    const supabase = createServiceClient();

    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .select('id, email, answers')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      console.error('[SECURITY] Invalid submission ID:', submissionId, submissionError);
      return NextResponse.json(
        { error: 'Invalid submission' },
        { status: 400 }
      );
    }

    // Extract email from submission (could be in email field or answers array)
    console.log('[DEBUG] Submission data:', {
      email: submission.email,
      answers: submission.answers,
      answersType: typeof submission.answers,
      isArray: Array.isArray(submission.answers),
    });

    const submissionEmail = submission.email ||
      submission.answers?.find((a: any) => a.questionId === 'q-email')?.value;

    console.log('[DEBUG] Extracted email:', submissionEmail);

    if (!submissionEmail) {
      console.error('[SECURITY] No email found in submission:', submissionId);
      return NextResponse.json(
        { error: 'Invalid submission - no email' },
        { status: 400 }
      );
    }

    // Verify the userId matches the email in the submission
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    const userEmail = user.emailAddresses.find(e => e.emailAddress === submissionEmail);
    if (!userEmail) {
      console.error('[SECURITY] User email does not match submission:', {
        userId,
        submissionId,
        submissionEmail,
      });
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 403 }
      );
    }

    // CRITICAL: Ensure email is verified before creating sign-in token
    // Sign-in tokens require a verified identifier to work
    if (userEmail.verification?.status !== 'verified') {
      console.log('[MAGIC_LINK] Email not verified, marking as verified:', {
        userId,
        email: submissionEmail,
        emailAddressId: userEmail.id,
        currentStatus: userEmail.verification?.status,
      });

      // Mark email as verified so the sign-in token will work
      await client.emailAddresses.updateEmailAddress(userEmail.id, {
        verified: true,
      });
    }

    // Create a sign-in token for this user
    console.log('[MAGIC_LINK] Creating sign-in token for user:', userId);

    const signInToken = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 3600, // 1 hour
    });

    console.log('[MAGIC_LINK] Token created:', {
      tokenLength: signInToken.token.length,
      tokenPreview: signInToken.token.substring(0, 20) + '...',
      userId: signInToken.userId,
      status: signInToken.status,
    });

    // Build the magic link URL
    // Include userId in the URL so the client knows which user is being signed in
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/api/auth/verify-magic-link?token=${signInToken.token}&submissionId=${submissionId}&userId=${userId}`;

    console.log('[MAGIC_LINK] Magic link URL:', magicLinkUrl);

    // Send email via Resend
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: submissionEmail,
        subject: 'Complete your account setup',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Mentorfy!</h2>
            <p>Click the button below to complete your account setup and start chatting with your AI mentor:</p>
            <div style="margin: 30px 0;">
              <a href="${magicLinkUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Complete Setup
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${magicLinkUrl}" style="color: #4F46E5;">${magicLinkUrl}</a>
            </p>
          </div>
        `,
      });

      console.log('[MAGIC_LINK] Email sent to:', submissionEmail);

      return NextResponse.json({
        success: true,
        magicLinkUrl, // Include for dev debugging
        message: 'Magic link sent to your email',
      });
    } catch (emailError: any) {
      console.error('[MAGIC_LINK] Failed to send email:', emailError);

      // Still return the magic link URL for dev/debugging
      return NextResponse.json({
        success: true,
        magicLinkUrl, // Fallback for dev if email fails
        message: 'Failed to send email, but here is your magic link',
        emailError: emailError.message,
      });
    }
  } catch (error: any) {
    console.error('[MAGIC_LINK] Failed to create sign-in token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send magic link' },
      { status: 500 }
    );
  }
}
