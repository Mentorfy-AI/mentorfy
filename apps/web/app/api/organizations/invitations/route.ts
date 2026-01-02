import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InviteRequest {
  emails: string[];
  role?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId, orgId, orgRole } = await auth();

    // Check authentication
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to invite (admin or team member)
    if (orgRole !== 'org:admin' && orgRole !== 'org:team_member') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to invite users' },
        { status: 403 }
      );
    }

    const body: InviteRequest = await request.json();
    const { emails, role = 'org:student' } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No emails provided' },
        { status: 400 }
      );
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email addresses',
          invalidEmails,
        },
        { status: 400 }
      );
    }

    // Send invitations using Clerk backend API
    console.log('[API] Sending invitations:', { orgId, userId, emails, role });

    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          const client = await clerkClient();

          // Redirect invitation to our app's sign-up page
          // With Clerk Restricted mode enabled, the SignUp component only works with valid invitations
          // This ensures invite-only access while keeping the flow in our app (works in dev mode)
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const redirectUrl = `${baseUrl}/sign-up`;

          const invitation = await client.organizations.createOrganizationInvitation({
            organizationId: orgId,
            inviterUserId: userId, // REQUIRED: The user creating the invitation
            emailAddress: email,
            role,
            redirectUrl, // Send users to our sign-up page with invitation context
          });
          console.log('[API] Invitation created for:', email, invitation.id);
          return invitation;
        } catch (error) {
          console.error('[API] Failed to invite:', email, error);
          throw error;
        }
      })
    );

    // Categorize results
    const successful: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(emails[index]);
      } else {
        const error = result.reason;
        let errorMessage = 'Unknown error';

        // Extract Clerk error details
        if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
          const clerkError = error.errors[0];
          errorMessage = clerkError.longMessage || clerkError.message || errorMessage;
        } else if (error?.message) {
          errorMessage = error.message;
        }

        console.error('[API] Invitation failed for', emails[index], ':', errorMessage);
        failed.push({
          email: emails[index],
          error: errorMessage,
        });
      }
    });

    console.log('[API] Invitation results:', {
      totalSent: successful.length,
      totalFailed: failed.length,
      successful,
      failed,
    });

    return NextResponse.json({
      success: true,
      results: {
        successful,
        failed,
        totalSent: successful.length,
        totalFailed: failed.length,
      },
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invitations',
      },
      { status: 500 }
    );
  }
}
