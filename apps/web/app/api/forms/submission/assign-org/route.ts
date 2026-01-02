import { clerkClient } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Assign newly signed-up user to the organization from their form submission
 * Called after successful SMS verification for new users
 *
 * NOTE: This endpoint does NOT use Clerk auth() because:
 * 1. It's called immediately after setActive() which has a race condition
 * 2. The userId is passed from the client after successful verification
 * 3. We use clerkClient to assign membership server-side
 */
export async function POST(req: NextRequest) {
  try {
    const { submissionId, userId } = await req.json();

    console.log('[AUTH_ASSIGN_ORG] Request received:', { submissionId, userId });

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient(); // Bypass RLS

    // Get submission to find organization
    const { data: submission, error } = await supabase
      .from('form_submissions')
      .select('clerk_org_id')
      .eq('id', submissionId)
      .single();

    if (error || !submission) {
      console.error('Submission not found:', error);
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    try {
      // Add user to organization with student role
      const client = await clerkClient();
      await client.organizations.createOrganizationMembership({
        organizationId: submission.clerk_org_id,
        userId: userId,
        role: 'org:student',
      });

      console.log('[FORMS] Assigned user to organization:', {
        submissionId,
        userId,
        orgId: submission.clerk_org_id,
        role: 'org:student',
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({ success: true });
    } catch (clerkError: any) {
      // Check if user is already a member
      const errorCode = clerkError.errors?.[0]?.code;
      if (
        clerkError.status === 422 ||
        errorCode === 'duplicate_record' ||
        errorCode === 'already_a_member_in_organization'
      ) {
        console.log('[FORMS] User already member of organization (skipping):', {
          userId,
          orgId: submission.clerk_org_id,
          errorCode,
        });
        return NextResponse.json({ success: true, alreadyMember: true });
      }

      console.error('Failed to assign user to org:', clerkError);
      return NextResponse.json(
        { error: 'Failed to assign to organization' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error assigning to organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
