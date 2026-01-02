import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/auth/verify-magic-link
 *
 * Handles magic link clicks from email
 * Redirects to a client-side page that will:
 * 1. Use Clerk's signIn.create({ strategy: 'ticket', ticket: token })
 * 2. Complete the form flow with submissionId
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');
    const submissionId = searchParams.get('submissionId');
    const userId = searchParams.get('userId');

    if (!token) {
      return NextResponse.redirect(new URL('/sign-in?error=invalid_token', req.url));
    }

    if (!submissionId) {
      return NextResponse.redirect(new URL('/sign-in?error=missing_submission', req.url));
    }

    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in?error=missing_user_id', req.url));
    }

    // Redirect to client-side handler with all parameters
    const redirectUrl = `/auth/magic-link?token=${token}&submissionId=${submissionId}&userId=${userId}`;

    console.log('[MAGIC_LINK] Redirecting to client handler:', redirectUrl);

    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error: any) {
    console.error('[MAGIC_LINK] Verification failed:', error);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }
}
