'use client';

import { useState, useEffect, useRef } from 'react';
import { useSignIn, useSignUp, useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  MessageSquare,
  Shield,
  Phone,
  Mail,
  XCircle,
} from 'lucide-react';
import { UserProfile } from '@/lib/forms/utils';
import { useFormTheme } from '@/lib/forms/theme';
import { CheckAccountResponse } from '@/app/api/auth/check-account/route';

interface CompletionScreenProps {
  profile: UserProfile;
  submissionId: string;
  botId: string;
  orgId: string;
}

// Explicit state machine for auth flow
type AuthState =
  | { status: 'checking' }
  | { status: 'already_authenticated' }
  | { status: 'new_signup'; sendingSms: boolean }
  | {
      status: 'phone_signin';
      sendingSms: boolean;
      maskedPhone: string;
      userId: string;
    }
  | { status: 'magic_link_sent'; userId: string }
  | {
      status: 'phone_conflict';
      maskedEmail: string;
      userId: string;
      emailInput: string;
    }
  | {
      status: 'verify_code';
      isNewUser: boolean;
      verificationType: 'phone' | 'email';
      userId?: string;
      authenticatedEmail?: string;
    }
  | { status: 'completing' }
  | { status: 'whitelist_blocked'; blockedMessage?: string }
  | { status: 'error'; message: string };

export function CompletionScreen({
  profile,
  submissionId,
  botId,
  orgId,
}: CompletionScreenProps) {
  const theme = useFormTheme();
  const router = useRouter();

  // Clerk hooks
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn, userId: authUserId } = useAuth();
  const clerk = useClerk();

  // State machine
  const [authState, setAuthState] = useState<AuthState>({ status: 'checking' });

  // Shared form state
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  // Track if initial auth check has run (prevents re-running when user becomes signed in during verification)
  const hasInitializedRef = useRef(false);

  // Initialize auth flow (runs once on mount)
  useEffect(() => {
    if (!isSignInLoaded || !isSignUpLoaded) return;
    if (hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    // Already signed in - complete immediately
    if (isSignedIn && authUserId) {
      setAuthState({ status: 'already_authenticated' });
      handleAlreadyAuthenticated(authUserId);
      return;
    }

    // Run pre-flight check
    checkAccountAndRoute();
  }, [isSignInLoaded, isSignUpLoaded, isSignedIn, authUserId]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(
        () => setResendCountdown(resendCountdown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // ============================================================================
  // Pre-flight check - determines auth strategy
  // ============================================================================

  async function checkAccountAndRoute() {
    try {
      const response = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          phone: profile.phone,
          submissionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check account');
      }

      const data: CheckAccountResponse = await response.json();
      console.log('[AUTH] Pre-flight check result:', {
        strategy: data.strategy,
        userId: data.userId,
        maskedPhone: data.maskedPhone,
        maskedEmail: data.maskedEmail,
        blockedMessage: data.blockedMessage,
      });

      switch (data.strategy) {
        case 'NEW_SIGNUP':
          await startNewSignup();
          break;
        case 'PHONE_SIGNIN':
          await startPhoneSignin(data.userId!, data.maskedPhone!);
          break;
        case 'MAGIC_LINK':
          await sendMagicLink(data.userId!);
          break;
        case 'PHONE_CONFLICT':
          setAuthState({
            status: 'phone_conflict',
            maskedEmail: data.maskedEmail!,
            userId: data.userId!,
            emailInput: '',
          });
          break;
        case 'WHITELIST_BLOCKED':
          setAuthState({
            status: 'whitelist_blocked',
            blockedMessage: data.blockedMessage,
          });
          break;
        case 'NEW_SIGNUP_WITH_EMAIL_VERIFICATION':
          await startEmailVerificationSignup();
          break;
      }
    } catch (err: any) {
      console.error('[AUTH] Pre-flight check failed:', err);
      setAuthState({
        status: 'error',
        message: err.message || 'Failed to initialize',
      });
    }
  }

  // ============================================================================
  // Auth flow handlers
  // ============================================================================

  async function handleAlreadyAuthenticated(userId: string) {
    console.log('[AUTH] User already authenticated, completing form');
    try {
      await updateUserProfile(userId, profile);
      await linkSubmission(submissionId, { userId });
      await assignToOrg(submissionId, userId);
      await completeFormAndRedirect();
    } catch (err: any) {
      console.error(
        '[AUTH] Failed to complete form for authenticated user:',
        err
      );
      setAuthState({
        status: 'error',
        message: 'Failed to continue. Please try again.',
      });
    }
  }

  async function startNewSignup() {
    setAuthState({ status: 'new_signup', sendingSms: true });
    setResendCountdown(8);

    try {
      // Phone is already in E.164 format from form input (e.g., +14155551234, +447700900123)
      const phoneE164 = profile.phone;

      // Check if we already have an active signup session (resend case)
      if (signUp?.status) {
        console.log('[AUTH] Resending SMS to existing signup session');
        await signUp.preparePhoneNumberVerification();
      } else {
        // Fresh signup - create the session first
        console.log('[AUTH] Creating new user:', {
          email: profile.email,
          phone: phoneE164,
        });

        await signUp!.create({
          firstName: profile.firstName,
          lastName: profile.lastName,
          emailAddress: profile.email,
          phoneNumber: phoneE164,
        });

        await signUp!.preparePhoneNumberVerification();
      }

      console.log('[AUTH] SMS sent to new user');
      setAuthState({
        status: 'verify_code',
        isNewUser: true,
        verificationType: 'phone',
      });
    } catch (err: any) {
      console.error('[AUTH] New signup failed:', {
        message: err.message,
        code: err.errors?.[0]?.code,
        clerkMessage: err.errors?.[0]?.message,
        longMessage: err.errors?.[0]?.longMessage,
      });
      const message =
        err.errors?.[0]?.message || err.message || 'Failed to create account';
      setAuthState({ status: 'error', message });
    }
  }

  async function startEmailVerificationSignup() {
    setAuthState({ status: 'new_signup', sendingSms: true }); // Reuse new_signup state for loading UI
    setResendCountdown(8);

    try {
      // Check if we already have an active signup session (resend case)
      if (signUp?.status) {
        console.log(
          '[AUTH] Resending email verification to existing signup session'
        );
        await signUp.prepareEmailAddressVerification({
          strategy: 'email_code',
        });
      } else {
        // Fresh signup - create WITHOUT phone to avoid Clerk requiring phone verification
        // Phone will be added after email verification completes
        console.log('[AUTH] Creating new user (email verification):', {
          email: profile.email,
        });

        await signUp!.create({
          firstName: profile.firstName,
          lastName: profile.lastName,
          emailAddress: profile.email,
        });

        console.log(
          '[AUTH] After create, signUp.status:',
          signUp!.status,
          'signUp.id:',
          signUp!.id
        );

        await signUp!.prepareEmailAddressVerification({
          strategy: 'email_code',
        });
      }

      console.log('[AUTH] Email verification sent to new user');
      setAuthState({
        status: 'verify_code',
        isNewUser: true,
        verificationType: 'email',
      });
    } catch (err: any) {
      console.error('[AUTH] Email verification signup failed:', {
        message: err.message,
        code: err.errors?.[0]?.code,
        clerkMessage: err.errors?.[0]?.message,
        longMessage: err.errors?.[0]?.longMessage,
      });
      const message =
        err.errors?.[0]?.message || err.message || 'Failed to create account';
      setAuthState({ status: 'error', message });
    }
  }

  async function startPhoneSignin(userId: string, maskedPhone: string) {
    setAuthState({
      status: 'phone_signin',
      sendingSms: true,
      maskedPhone,
      userId,
    });
    setResendCountdown(8);

    try {
      // Phone is already in E.164 format from form input (e.g., +14155551234, +447700900123)
      const phoneE164 = profile.phone;

      // Check if we already have an active sign-in session (resend case)
      let phoneFactor;
      if (signIn?.status && signIn.supportedFirstFactors) {
        console.log('[AUTH] Resending SMS to existing sign-in session');
        phoneFactor = signIn.supportedFirstFactors.find(
          (f: any) => f.strategy === 'phone_code'
        );
      } else {
        // Fresh sign-in - create the session first
        console.log('[AUTH] Signing in existing user with phone:', phoneE164);

        const { supportedFirstFactors } = await signIn!.create({
          identifier: phoneE164,
        });

        phoneFactor = supportedFirstFactors?.find(
          (f) => f.strategy === 'phone_code'
        );
      }

      if (!phoneFactor) {
        throw new Error('Phone verification not supported for this account');
      }

      await signIn!.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId: phoneFactor.phoneNumberId,
      });

      console.log('[AUTH] SMS sent to existing user');
      setAuthState({
        status: 'verify_code',
        isNewUser: false,
        verificationType: 'phone',
        userId,
      });
    } catch (err: any) {
      console.error('[AUTH] Phone signin failed:', {
        message: err.message,
        code: err.errors?.[0]?.code,
        clerkMessage: err.errors?.[0]?.message,
        longMessage: err.errors?.[0]?.longMessage,
      });
      const message =
        err.errors?.[0]?.message || err.message || 'Failed to send code';
      setAuthState({ status: 'error', message });
    }
  }

  async function sendMagicLink(userId: string) {
    try {
      console.log('[AUTH] Sending magic link to email-only user');

      const response = await fetch('/api/user/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, submissionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send magic link');
      }

      // const { magicLinkUrl } = await response.json();
      // console.log('[AUTH] Magic link sent (dev):', magicLinkUrl);

      setAuthState({ status: 'magic_link_sent', userId });
    } catch (err: any) {
      console.error('[AUTH] Magic link failed:', err);
      setAuthState({
        status: 'error',
        message: err.message || 'Failed to send email',
      });
    }
  }

  // ============================================================================
  // Phone conflict resolution
  // ============================================================================

  async function handlePhoneConflictEmailSubmit(emailInput: string) {
    if (authState.status !== 'phone_conflict') return;

    setError('');

    // Check if entered email matches the account that owns the phone
    try {
      const response = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          phone: profile.phone,
          submissionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify email');
      }

      const data: CheckAccountResponse = await response.json();

      // Email must match an account, and it should resolve to PHONE_SIGNIN
      // (meaning this email + phone belong to the same account)
      if (
        data.strategy === 'PHONE_SIGNIN' &&
        data.userId === authState.userId
      ) {
        // Email matches - proceed with phone signin
        await startPhoneSigninWithEmail(data.userId!, emailInput);
      } else if (
        data.strategy === 'MAGIC_LINK' &&
        data.userId === authState.userId
      ) {
        // Email matches but no phone on account - use magic link
        await sendMagicLink(data.userId!);
      } else {
        setError("This email doesn't match the account for this phone number");
      }
    } catch (err: any) {
      console.error('[AUTH] Phone conflict resolution failed:', err);
      setError(err.message || 'Failed to verify email');
    }
  }

  async function startPhoneSigninWithEmail(userId: string, email: string) {
    // User confirmed their email - now sign them in via their existing phone
    setAuthState({
      status: 'phone_signin',
      sendingSms: true,
      maskedPhone: '***',
      userId,
    });
    setResendCountdown(8);

    try {
      // Sign in with email to get correct user, then verify via phone
      const { supportedFirstFactors } = await signIn!.create({
        identifier: email,
      });

      const phoneFactor = supportedFirstFactors?.find(
        (f) => f.strategy === 'phone_code'
      );
      if (!phoneFactor) {
        // No phone on this account - shouldn't happen, but fallback to magic link
        await sendMagicLink(userId);
        return;
      }

      await signIn!.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId: phoneFactor.phoneNumberId,
      });

      console.log('[AUTH] SMS sent to user after email confirmation');
      // Track authenticated email for mismatch detection (phone conflict flow)
      setAuthState({
        status: 'verify_code',
        isNewUser: false,
        verificationType: 'phone',
        userId,
        authenticatedEmail: email,
      });
    } catch (err: any) {
      console.error('[AUTH] Phone signin after email confirm failed:', err);
      const message =
        err.errors?.[0]?.message || err.message || 'Failed to send code';
      setAuthState({ status: 'error', message });
    }
  }

  // ============================================================================
  // Code verification
  // ============================================================================

  async function handleVerifyCode() {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    if (authState.status !== 'verify_code') return;
    if (isVerifying) return;

    setIsVerifying(true);
    setError('');
    const {
      isNewUser,
      verificationType,
      userId: preflightUserId,
      authenticatedEmail,
    } = authState;

    try {
      let finalUserId: string;

      if (isNewUser) {
        // New user signup verification (phone or email based on verificationType)
        const result =
          verificationType === 'email'
            ? await signUp!.attemptEmailAddressVerification({ code })
            : await signUp!.attemptPhoneNumberVerification({ code });

        if (result.status !== 'complete') {
          throw new Error(`Verification failed: ${result.status}`);
        }

        finalUserId = result.createdUserId!;
        console.log('[AUTH] New user created:', finalUserId);

        // Set email as primary (fire-and-forget) - must happen after user exists
        setEmailAsPrimary(profile.email).catch((err) => {
          console.warn('[AUTH] Failed to set email as primary:', err);
        });

        // Assign to org before activating session
        await assignToOrg(submissionId, finalUserId);
        await linkSubmission(submissionId, { userId: finalUserId });

        // Activate session with org
        await setActive!({
          session: result.createdSessionId,
          organization: orgId,
        });

        // For email verification flow, add phone number after session is active
        // (phone wasn't included in signup to avoid Clerk requiring phone verification)
        // Phone is already in E.164 format from form input
        if (verificationType === 'email' && profile.phone) {
          addPhoneToUser(finalUserId, profile.phone).catch((err) => {
            console.warn('[AUTH] Failed to add phone to user:', err);
          });
        }
      } else {
        // Existing user signin verification
        const result = await signIn!.attemptFirstFactor({
          strategy: 'phone_code',
          code,
        });

        if (result.status !== 'complete') {
          throw new Error(`Verification failed: ${result.status}`);
        }

        // Activate session first
        await setActive!({ session: result.createdSessionId });

        // Get userId from session
        finalUserId = await waitForUserId();
        console.log('[AUTH] Existing user signed in:', finalUserId);

        // Link and assign (pass authenticatedEmail for mismatch tracking)
        await linkSubmission(submissionId, {
          userId: finalUserId,
          authenticatedEmail,
        });
        await assignToOrg(submissionId, finalUserId);

        // Re-activate with org
        await setActive!({
          session: result.createdSessionId,
          organization: orgId,
        });

        // Update profile (non-blocking)
        updateUserProfile(finalUserId, profile).catch(console.warn);
      }

      // Complete form
      await completeFormAndRedirect();
    } catch (err: any) {
      console.error('[AUTH] Verification failed:', {
        message: err.message,
        code: err.errors?.[0]?.code,
        clerkMessage: err.errors?.[0]?.message,
        longMessage: err.errors?.[0]?.longMessage,
      });
      setError(err.errors?.[0]?.message || err.message || 'Invalid code');
    }
  }

  async function waitForUserId(): Promise<string> {
    const delays = [10, 20, 50, 100, 200];
    for (const delay of delays) {
      const userId = clerk.session?.user?.id;
      if (userId) return userId;
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error('Failed to get user ID from session');
  }

  // ============================================================================
  // Form completion
  // ============================================================================

  async function completeFormAndRedirect() {
    setAuthState({ status: 'completing' });

    const response = await fetch('/api/forms/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, orgId }),
    });

    if (!response.ok) {
      throw new Error('Failed to complete form');
    }

    const { conversationId } = await response.json();
    router.push(`/chat/${conversationId}`);
  }

  // ============================================================================
  // Resend handler
  // ============================================================================

  async function handleResend() {
    if (resendCountdown > 0) return;

    // Re-run the pre-flight check to restart the appropriate flow
    setAuthState({ status: 'checking' });
    setCode('');
    setError('');
    await checkAccountAndRoute();
  }

  // ============================================================================
  // Render based on state
  // ============================================================================

  // Loading / Checking state
  if (authState.status === 'checking') {
    return (
      <LoadingScreen
        theme={theme}
        message="Setting up..."
      />
    );
  }

  // Already authenticated
  if (authState.status === 'already_authenticated') {
    return (
      <LoadingScreen
        theme={theme}
        title="You're already logged in!"
        message="Sit tight, redirecting you..."
      />
    );
  }

  // Completing form
  if (authState.status === 'completing') {
    return <CompletingScreen theme={theme} />;
  }

  // Error state
  if (authState.status === 'error') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: theme.bgOuter }}
      >
        <div className="w-full max-w-md text-center">
          <div
            className="px-6 py-4 rounded-lg"
            style={{
              backgroundColor: theme.errorBg || '#FEF2F2',
              borderColor: theme.error,
              color: theme.error,
              border: '1px solid',
            }}
          >
            <p className="font-semibold mb-2">Something went wrong</p>
            <p className="text-sm">{authState.message}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm hover:underline"
            style={{ color: theme.primary }}
          >
            Try again
          </button>
          <div
            id="clerk-captcha"
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  // Whitelist blocked - user's email is not on the org's whitelist
  if (authState.status === 'whitelist_blocked') {
    return (
      <WhitelistBlockedScreen
        theme={theme}
        blockedMessage={authState.blockedMessage}
      />
    );
  }

  // Magic link sent
  if (authState.status === 'magic_link_sent') {
    return (
      <MagicLinkSentScreen
        theme={theme}
        email={profile.email}
        onResend={() => window.location.reload()}
      />
    );
  }

  // Phone conflict - need user to enter their registered email
  if (authState.status === 'phone_conflict') {
    return (
      <PhoneConflictScreen
        theme={theme}
        maskedEmail={authState.maskedEmail}
        emailInput={authState.emailInput}
        error={error}
        onEmailChange={(email) =>
          setAuthState({ ...authState, emailInput: email })
        }
        onSubmit={() => handlePhoneConflictEmailSubmit(authState.emailInput)}
      />
    );
  }

  // Code verification (new signup or existing user, phone or email)
  const isSending =
    (authState.status === 'new_signup' && authState.sendingSms) ||
    (authState.status === 'phone_signin' && authState.sendingSms);

  // Get verificationType from state (defaults to 'phone' for backwards compatibility)
  const verificationType =
    authState.status === 'verify_code' ? authState.verificationType : 'phone';

  return (
    <VerifyCodeScreen
      theme={theme}
      phone={formatPhone(profile.phone)}
      email={profile.email}
      verificationType={verificationType}
      code={code}
      error={error}
      isSending={isSending}
      isVerifying={isVerifying}
      resendCountdown={resendCountdown}
      onCodeChange={setCode}
      onVerify={handleVerifyCode}
      onResend={handleResend}
    />
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function LoadingScreen({
  theme,
  title = 'Just a moment...',
  message,
}: {
  theme: any;
  title?: string;
  message: string;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: theme.bgOuter }}
    >
      <div className="w-full max-w-md text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: theme.primaryLight10 }}
        >
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: theme.primary }}
          />
        </div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: theme.textHeading }}
        >
          {title}
        </h1>
        <p
          className="text-lg"
          style={{ color: theme.textHeading }}
        >
          {message}
        </p>
        {/* Clerk CAPTCHA widget - must be present when signUp.create() / signIn.create() is called */}
        <div
          id="clerk-captcha"
          className="mt-4"
        />
      </div>
    </div>
  );
}

function CompletingScreen({ theme }: { theme: any }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: theme.bgOuter }}
    >
      <style jsx>{`
        @keyframes logo-spin-initial {
          0% {
            transform: rotate(0deg);
          }
          66.67% {
            transform: rotate(2880deg);
          }
          100% {
            transform: rotate(2880deg);
          }
        }
        @keyframes logo-pulse-pattern {
          0%,
          66.67% {
            transform: rotate(0deg);
          }
          83.34%,
          100% {
            transform: rotate(1440deg);
          }
        }
        .spinning-logo {
          animation: logo-spin-initial 1.5s ease-out 0s 1,
            logo-pulse-pattern 3.6s ease-in-out 1.5s infinite;
        }
      `}</style>
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <img
            src="/icons/logo-dark.svg"
            alt="Loading"
            width="64"
            height="64"
            className="spinning-logo"
          />
        </div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: theme.textHeading }}
        >
          Just a moment...
        </h1>
        <p
          className="text-lg"
          style={{ color: theme.textHeading }}
        >
          Setting things up for you
        </p>
        <div
          id="clerk-captcha"
          className="mt-4"
        />
      </div>
    </div>
  );
}

function MagicLinkSentScreen({
  theme,
  email,
  onResend,
}: {
  theme: any;
  email: string;
  onResend: () => void;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: theme.bgOuter }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: theme.primaryLight10 }}
          >
            <Mail
              className="w-8 h-8"
              style={{ color: theme.primary }}
            />
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: theme.textHeading }}
          >
            Check Your Email
          </h1>
          <p
            className="text-lg"
            style={{ color: theme.textHeading }}
          >
            We sent a sign-in link to{' '}
            <span className="font-semibold">{email}</span>
          </p>
        </div>

        <div
          className="rounded-2xl shadow-xl border p-8"
          style={{
            backgroundColor: theme.bgContainer,
            borderColor: theme.borderLight,
          }}
        >
          <div className="space-y-4">
            {[
              'Click the link in your email to sign in',
              "We'll automatically add your phone number and complete your form",
              "You'll be redirected to your chat",
            ].map((text, i) => (
              <div
                key={i}
                className="flex items-start gap-3"
              >
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{
                    backgroundColor: theme.primaryLight10,
                    color: theme.primary,
                  }}
                >
                  {i + 1}
                </div>
                <p style={{ color: theme.textHeading }}>{text}</p>
              </div>
            ))}
          </div>
          <div
            className="mt-6 pt-6 border-t"
            style={{ borderColor: theme.borderLight }}
          >
            <p
              className="text-sm text-center"
              style={{ color: theme.textSubtle }}
            >
              The link will expire in 1 hour
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p
            className="text-sm"
            style={{ color: theme.textSubtle }}
          >
            Didn't receive the email?{' '}
            <button
              onClick={onResend}
              className="hover:underline font-medium"
              style={{ color: theme.primary }}
            >
              Resend link
            </button>
          </p>
        </div>
        <div
          id="clerk-captcha"
          className="mt-4"
        />
      </div>
    </div>
  );
}

function PhoneConflictScreen({
  theme,
  maskedEmail,
  emailInput,
  error,
  onEmailChange,
  onSubmit,
}: {
  theme: any;
  maskedEmail: string;
  emailInput: string;
  error: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: theme.bgOuter }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: theme.primaryLight10 }}
          >
            <Phone
              className="w-8 h-8"
              style={{ color: theme.primary }}
            />
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: theme.textHeading }}
          >
            Phone Already Registered
          </h1>
          <p
            className="text-lg"
            style={{ color: theme.textBody }}
          >
            This phone number is linked to an existing account
          </p>
        </div>

        <div
          className="rounded-2xl shadow-xl border p-8"
          style={{
            backgroundColor: theme.bgContainer,
            borderColor: theme.borderLight,
          }}
        >
          <p
            className="mb-6"
            style={{ color: theme.textBody }}
          >
            Enter your account email to continue. Hint:{' '}
            <span className="font-mono font-semibold">{maskedEmail}</span>
          </p>

          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.textBody }}
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail
                    className="w-5 h-5"
                    style={{ color: theme.textMuted }}
                  />
                </div>
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => onEmailChange(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && emailInput && onSubmit()
                  }
                  placeholder="you@example.com"
                  className="pl-10"
                  style={{ color: theme.textHeading }}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  backgroundColor: theme.errorBg || '#FEF2F2',
                  borderColor: theme.error,
                  color: theme.error,
                  border: '1px solid',
                }}
              >
                {error}
              </div>
            )}

            <Button
              onClick={onSubmit}
              disabled={!emailInput}
              className="w-full"
              size="lg"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              Continue
            </Button>

            {/* Clerk CAPTCHA widget - needed when signIn.create() is called after email confirmation */}
            <div
              id="clerk-captcha"
              className="mt-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WhitelistBlockedScreen({
  theme,
  blockedMessage,
}: {
  theme: any;
  blockedMessage?: string;
}) {
  const defaultMessage =
    "You don't have access to this AI mentor. Please contact the organization for assistance.";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: theme.bgOuter }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: theme.errorBg || '#FEF2F2' }}
          >
            <XCircle
              className="w-8 h-8"
              style={{ color: theme.error }}
            />
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: theme.textHeading }}
          >
            Access Restricted
          </h1>
          <p
            className="text-lg"
            style={{ color: theme.textBody }}
          >
            {blockedMessage || defaultMessage}
          </p>
        </div>

        <div
          className="rounded-2xl shadow-xl border p-8 text-center"
          style={{
            backgroundColor: theme.bgContainer,
            borderColor: theme.borderLight,
          }}
        >
          <p
            className="text-sm"
            style={{ color: theme.textSubtle }}
          >
            If you believe this is a mistake, please reach out to the
            organization administrator with your email address.
          </p>
        </div>
        <div
          id="clerk-captcha"
          className="mt-4"
        />
      </div>
    </div>
  );
}

export function VerifyCodeScreen({
  theme,
  phone,
  email,
  verificationType,
  code,
  error,
  isSending,
  isVerifying,
  resendCountdown,
  onCodeChange,
  onVerify,
  onResend,
}: {
  theme: any;
  phone?: string;
  email?: string;
  verificationType: 'phone' | 'email';
  code: string;
  error: string;
  isSending: boolean;
  isVerifying: boolean;
  resendCountdown: number;
  onCodeChange: (code: string) => void;
  onVerify: () => void;
  onResend: () => void;
}) {
  const isEmail = verificationType === 'email';
  const destination = isEmail ? email : phone;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: theme.bgOuter }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: theme.primaryLight10 }}
          >
            {isEmail ? (
              <Mail
                className="w-8 h-8"
                style={{ color: theme.primary }}
              />
            ) : (
              <Shield
                className="w-8 h-8"
                style={{ color: theme.primary }}
              />
            )}
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: theme.textHeading }}
          >
            {isEmail ? 'Check your email' : 'Check your phone'}
          </h1>
          <p
            className="text-lg"
            style={{ color: theme.textHeading }}
          >
            {isSending ? (
              <>
                <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
                Sending code...
              </>
            ) : (
              <>
                We sent a 6-digit code to{' '}
                <span className="font-semibold">{destination}</span>
              </>
            )}
          </p>
        </div>

        <div
          className="rounded-2xl shadow-xl border p-8"
          style={{
            backgroundColor: theme.bgContainer,
            borderColor: theme.borderLight,
          }}
        >
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="text-center text-3xl tracking-[0.5em] mb-4 h-16 font-mono"
            style={{ color: theme.textHeading }}
            disabled={isSending}
            autoFocus={!isSending}
          />

          {error && (
            <div
              className="px-4 py-3 rounded-lg mb-4 text-sm"
              style={{
                backgroundColor: theme.errorBg || '#FEF2F2',
                borderColor: theme.error,
                color: theme.error,
                border: '1px solid',
              }}
            >
              {error}
            </div>
          )}

          <Button
            onClick={onVerify}
            disabled={isSending || isVerifying || code.length !== 6}
            className="w-full"
            size="lg"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5 mr-2" />
                Continue to Chat
              </>
            )}
          </Button>

          <p
            className="text-center text-sm mt-6"
            style={{ color: theme.textHeading }}
          >
            Didn't receive a code?{' '}
            <button
              className={`font-medium ${
                resendCountdown === 0 && !isSending
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed'
              }`}
              style={{
                color:
                  resendCountdown === 0 && !isSending
                    ? theme.primary
                    : theme.textMuted,
              }}
              onClick={() => resendCountdown === 0 && !isSending && onResend()}
              disabled={resendCountdown > 0 || isSending}
            >
              {resendCountdown === 0
                ? 'Resend'
                : `Resend (${resendCountdown}s)`}
            </button>
          </p>
        </div>

        <div
          className="mt-6 text-center text-xs"
          style={{ color: theme.textHeading }}
        >
          <p>Your information is encrypted and secure</p>
        </div>
        <div
          id="clerk-captcha"
          className="mt-4"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Helper functions
// ============================================================================

function formatPhone(phone: string): string {
  // Phone is already in E.164 format, just return it for display
  // e.g., +14155551234, +447700900123
  return phone;
}

async function linkSubmission(
  submissionId: string,
  params: { userId?: string; phone?: string; authenticatedEmail?: string }
) {
  const response = await fetch('/api/forms/submission/link-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, ...params }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to link submission: ${error.error}`);
  }

  console.log('[AUTH] Submission linked to user');
}

async function assignToOrg(submissionId: string, userId: string) {
  const response = await fetch('/api/forms/submission/assign-org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, userId }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to assign to org: ${error.error}`);
  }

  console.log('[AUTH] User assigned to org');
}

async function updateUserProfile(userId: string, profile: UserProfile) {
  const response = await fetch('/api/user/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, profile }),
  });

  if (!response.ok) {
    console.warn('[AUTH] Profile update failed (non-critical)');
  } else {
    console.log('[AUTH] Profile updated');
  }
}

async function setEmailAsPrimary(email: string) {
  const response = await fetch('/api/user/set-email-primary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to set email as primary: ${error.error}`);
  }

  console.log('[AUTH] Email set as primary');
}

async function addPhoneToUser(userId: string, phoneNumber: string) {
  const response = await fetch('/api/user/update-phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, phoneNumber }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to add phone to user: ${error.error}`);
  }

  console.log('[AUTH] Phone added to user');
}
