import { createServiceClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/forms/submission/[submissionId]
 *
 * Fetches a form submission by ID
 * Used by magic link handler to complete authentication flow
 *
 * SECURITY: This is a public endpoint (no auth required) because:
 * 1. Called from magic link handler (user not yet authenticated)
 * 2. Submission ID is a UUID (unguessable)
 * 3. Only returns data the user already provided in the form
 * 4. Critical operations (sign-in, org assignment) happen server-side with validation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  try {
    const { submissionId } = params;

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: submission, error } = await supabase
      .from('form_submissions')
      .select('id, email, phone, answers, clerk_org_id, bot_id, form_id')
      .eq('id', submissionId)
      .single();

    if (error || !submission) {
      console.error('[SUBMISSION] Failed to fetch submission:', submissionId, error);
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(submission);
  } catch (error: any) {
    console.error('[SUBMISSION] Error fetching submission:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}
