'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSignIn, useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

/**
 * Magic Link Handler Page
 *
 * Handles magic link sign-in for email-only users claiming their account
 * Flow:
 * 1. User clicks magic link from email
 * 2. This page uses Clerk's ticket strategy to sign them in
 * 3. Fetches submission data from database
 * 4. Adds phone from submission to their account
 * 5. Completes form flow (link submission, assign org)
 * 6. Redirects to chat
 */
function MagicLinkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { userId: authUserId } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    // Only run once and when Clerk is loaded
    if (!hasRun && isLoaded && signIn && setActive) {
      setHasRun(true);
      handleMagicLink();
    }
  }, [isLoaded, signIn, setActive, hasRun]);

  async function handleMagicLink() {
    const token = searchParams.get('token');
    const submissionId = searchParams.get('submissionId');
    const userId = searchParams.get('userId');

    console.log('[MAGIC_LINK] Starting - token:', token?.substring(0, 20) + '...', 'submissionId:', submissionId, 'userId:', userId);

    if (!token || !submissionId || !userId) {
      setError('Invalid magic link - missing parameters');
      return;
    }

    if (!signIn || !setActive) {
      setError('Clerk not initialized');
      return;
    }

    try {
      console.log('[MAGIC_LINK] Calling signIn.create with ticket strategy');

      // Sign in with the magic link token
      const result = await signIn.create({
        strategy: 'ticket',
        ticket: token,
      });

      console.log('[MAGIC_LINK] Clerk response - Status:', result?.status);
      console.log('[MAGIC_LINK] Created session ID:', result?.createdSessionId);
      console.log('[MAGIC_LINK] Created user ID:', result?.createdUserId);
      console.log('[MAGIC_LINK] All result keys:', Object.keys(result || {}));
      console.log('[MAGIC_LINK] Result.identifier:', result?.identifier);

      if (result?.status === 'complete') {
        console.log('[MAGIC_LINK] Sign-in successful');

        // Activate the session
        await setActive({ session: result.createdSessionId });

        console.log('[MAGIC_LINK] Using userId from URL:', userId);

        // Get submission data to extract phone and org
        const submissionResponse = await fetch(`/api/forms/submission/${submissionId}`);
        if (!submissionResponse.ok) {
          throw new Error('Failed to fetch submission');
        }

        const submission = await submissionResponse.json();
        const { answers, clerk_org_id } = submission;

        // Extract phone from answers array
        const phoneAnswer = answers?.find((a: any) => a.questionId === 'q-phone');

        if (!phoneAnswer) {
          throw new Error('No phone number found in submission');
        }

        const phone = phoneAnswer.value;

        console.log('[MAGIC_LINK] Adding phone to account:', phone);

        // Extract other profile fields from answers array
        const firstName = answers?.find((a: any) => a.questionId === 'q-first-name')?.value;
        const lastName = answers?.find((a: any) => a.questionId === 'q-last-name')?.value;
        const email = answers?.find((a: any) => a.questionId === 'q-email')?.value;

        // Add phone to the user's account
        await fetch('/api/user/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            profile: {
              phone,
              firstName,
              lastName,
              email,
            },
          }),
        });

        // Link submission to user
        await fetch('/api/forms/submission/link-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            userId,
          }),
        });

        // Assign to org
        await fetch('/api/forms/submission/assign-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            userId,
          }),
        });

        // Complete form flow
        const completeResponse = await fetch('/api/forms/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            orgId: clerk_org_id,
          }),
        });

        const { conversationId } = await completeResponse.json();

        console.log('[MAGIC_LINK] Flow complete, redirecting to chat');

        // Redirect to chat
        router.push(`/chat/${conversationId}`);
      } else {
        // Log detailed status for debugging
        console.error('[MAGIC_LINK] Sign-in incomplete. Full result:', result);
        console.error('[MAGIC_LINK] Status received:', result?.status);
        console.error('[MAGIC_LINK] Expected: "complete", Got:', typeof result?.status, result?.status);

        throw new Error(`Sign-in status: ${result?.status || 'unknown'}. Expected: complete`);
      }
    } catch (err: any) {
      console.error('[MAGIC_LINK] Error caught:', err);
      console.error('[MAGIC_LINK] Error type:', err.constructor?.name);
      console.error('[MAGIC_LINK] Error message:', err.message);
      console.error('[MAGIC_LINK] Clerk errors array:', err.errors);

      // Extract Clerk-specific error message
      const clerkError = err.errors?.[0]?.longMessage || err.errors?.[0]?.message;
      const errorMessage = clerkError || err.message || 'Failed to sign in with magic link';

      setError(errorMessage);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
            <p className="font-semibold mb-2">Sign-in Failed</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => router.push('/sign-in')}
            className="mt-4 text-sm text-brand-600 hover:underline"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Signing you in...
        </h1>
        <p className="text-slate-600">
          Please wait while we set up your account
        </p>
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 p-4">
          <div className="w-full max-w-md text-center">
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Loading...
            </h1>
          </div>
        </div>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}
