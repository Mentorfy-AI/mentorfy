import { createServiceClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

/**
 * POST /api/forms/complete
 *
 * Proxy to FastAPI backend to complete form submission flow.
 * Creates conversation with greeting flag after SMS verification.
 *
 * NOTE: This endpoint does NOT require Clerk auth because:
 * 1. SMS verification already happened via Clerk before this is called
 * 2. We validate the submission exists and has a linked clerk_user_id
 * 3. The submission was linked to the user in a previous auth-gated call
 * 4. We're only creating a conversation - not exposing sensitive data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId, orgId } = body;

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      );
    }

    // Validate submission exists and get the linked user
    const supabase = createServiceClient();
    const { data: submission, error: fetchError } = await supabase
      .from('form_submissions')
      .select('clerk_user_id, clerk_org_id')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      console.error('[FORMS] Submission not found:', submissionId);
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Verify submission has a linked user (set during SMS verification)
    if (!submission.clerk_user_id) {
      console.error('[FORMS] Submission not linked to user:', submissionId);
      return NextResponse.json(
        { error: 'Submission not linked to a user. Please verify your phone first.' },
        { status: 400 }
      );
    }

    // Verify org matches
    if (submission.clerk_org_id !== orgId) {
      console.error('[FORMS] Org mismatch:', { expected: submission.clerk_org_id, got: orgId });
      return NextResponse.json(
        { error: 'Organization mismatch' },
        { status: 403 }
      );
    }

    // Call FastAPI backend with validated data
    const response = await fetch(`${BACKEND_URL}/api/forms/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submission_id: submissionId,
        clerk_user_id: submission.clerk_user_id,
        org_id: orgId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[FORMS] Backend error:', response.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to complete form' },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[FORMS] Form completion successful:', {
      submissionId,
      userId: submission.clerk_user_id,
      conversationId: data.conversation_id,
    });

    return NextResponse.json({
      conversationId: data.conversation_id,
    });
  } catch (error) {
    console.error('[FORMS] Error completing form:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
