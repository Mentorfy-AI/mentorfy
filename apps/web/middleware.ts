/**
 * Mentorfy Authentication Middleware
 *
 * **AUTHENTICATION FLOW:**
 * 1. User requests a route
 * 2. Clerk validates JWT token
 * 3. Public routes → Allow immediately
 * 4. Protected routes → Require authentication
 * 5. Super admin routes → Check super_admin table
 * 6. Org routes → Require active org membership (from JWT)
 * 7. Ensure user_profile exists (fallback if webhook failed)
 * 8. Role-based access control (mentor vs student)
 *
 * **ROLE HIERARCHY:**
 * - Super Admin: Platform-level access (/agent-console)
 * - org:admin: Full org access (all mentor + student routes)
 * - org:team_member: Mentor access (all mentor + student routes)
 * - org:student: Student access (only /chat, /user-memory)
 *
 * **SECURITY LAYERS:**
 * 1. Clerk JWT validation (cannot be bypassed)
 * 2. Role-based route protection (middleware)
 * 3. Supabase RLS (database-level filtering by clerk_org_id)
 *
 * We trust Clerk's JWT for organization membership as the source of truth.
 * RLS policies provide defense-in-depth by filtering all queries by clerk_org_id.
 *
 * @see docs/CLERK_INTEGRATION.md for full auth flow documentation
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// Define route matchers
// Note: Routes are matched using path patterns, not exact matches
const isSuperAdminRoute = createRouteMatcher(['/agent-console(.*)', '/usage(.*)']);

const isMentorRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/students(.*)',
  '/conversations(.*)',
  '/knowledge(.*)',
  '/training(.*)',
  '/integrations(.*)',
  '/experience(.*)',
  '/account(.*)',
  '/agents(.*)',
  '/behavior(.*)',
]);

const isStudentRoute = createRouteMatcher(['/chat(.*)', '/user-memory(.*)']);

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
  '/debug(.*)',
  '/no-organization',
  '/api/webhooks(.*)',
  '/api/forms/by-slug(.*)', // Public form access for anonymous users
  '/api/forms/submission(.*)', // Anonymous form submission saving and retrieval
  '/api/forms/complete', // Form completion after SMS verification (validates internally)
  '/api/forms/:formId/transitions/llm', // LLM-based conditional form navigation for anonymous users
  '/api/forms/evaluate-condition', // LLM-based condition evaluation for anonymous form users
  '/api/forms/generate-content', // LLM content generation for informational screens (rate-limited, prompt-validated)
  '/api/auth/check-account', // Pre-flight account check for form auth flow
  '/api/user/send-magic-link', // Send magic link for email-only users
  '/api/user/set-email-primary', // Set email as primary during sign-up (prevents magic link errors)
  '/api/auth/verify-magic-link(.*)', // Magic link redirect handler
  '/auth/magic-link(.*)', // Client-side magic link handler
  '/api/ph(.*)', // PostHog analytics proxy for anonymous form users
  '/f/(.*)', // Public form pages for anonymous users
]);

const isPlaygroundRoute = createRouteMatcher(['/playground(.*)']);

const isApiRoute = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // ============================================================================
  // STEP 0: PLAYGROUND ROUTE CHECK (PRODUCTION ONLY)
  // Block playground routes in production to prevent accidental deployment
  // ============================================================================
  if (isPlaygroundRoute(req) && process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  // ============================================================================
  // STEP 1: PUBLIC ROUTE CHECK
  // Allow unauthenticated access to sign-in, webhooks, etc.
  // ============================================================================
  if (isPublicRoute(req) || isPlaygroundRoute(req)) {
    return NextResponse.next();
  }

  // ============================================================================
  // STEP 2: AUTHENTICATION REQUIRED
  // All non-public routes require valid Clerk session
  // ============================================================================
  const { userId, orgId, orgRole, redirectToSignIn, sessionClaims } =
    await auth();

  if (!userId) {
    // For API routes, return JSON error instead of redirect
    if (isApiRoute(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return redirectToSignIn();
  }

  // Note: We don't log email here to avoid extra Clerk API calls on every request
  // Use Clerk dashboard or specific logs to correlate userId with email if needed

  // ============================================================================
  // STEP 3: SUPER ADMIN ROUTE CHECK
  // Platform-level access (rare) - checks super_admin table in Supabase
  // ============================================================================
  if (isSuperAdminRoute(req)) {
    // Check super admin status from Supabase (single source of truth)
    // IMPORTANT: Must use service client to bypass RLS (otherwise infinite recursion)
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('super_admin')
      .select('clerk_user_id')
      .eq('clerk_user_id', userId)
      .single();

    if (error || !data) {
      console.log('[SECURITY] Super admin access denied:', {
        userId,
        path: req.nextUrl.pathname,
        timestamp: new Date().toISOString(),
        reason: 'Not in super_admin table',
        supabaseError: error?.message,
      });
      // Return 404 instead of 403 to avoid revealing route existence
      return new Response('Not Found', { status: 404 });
    }

    console.log('[SECURITY] Super admin access granted:', {
      userId,
      path: req.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.next();
  }

  // ============================================================================
  // STEP 4: REDIRECT /chat TO /chat/new
  // Canonical new chat route is /chat/new
  // ============================================================================
  if (req.nextUrl.pathname === '/chat') {
    return NextResponse.redirect(new URL('/chat/new', req.url));
  }

  // ============================================================================
  // STEP 5: ORGANIZATION CONTEXT REQUIRED
  // Mentor & student routes require user to be in an active organization
  // ============================================================================
  if (
    isMentorRoute(req) ||
    isStudentRoute(req) ||
    (isApiRoute(req) && !isPublicRoute(req))
  ) {
    if (!orgId) {
      // For API routes, return JSON error instead of redirect
      if (isApiRoute(req)) {
        return NextResponse.json(
          { success: false, error: 'No organization context' },
          { status: 403 }
        );
      }
      // User not in org context → redirect to org selection/creation page
      return NextResponse.redirect(new URL('/no-organization', req.url));
    }

    // ============================================================================
    // STEP 6: ORGANIZATION & USER PROFILE SYNC
    // Organization and user_profile records are created by Clerk webhooks:
    // - organization.created → Creates organization record
    // - organizationMembership.created → Creates user_profile record
    //
    // Webhooks fire immediately when users join orgs, so records should exist.
    // No middleware fallback needed (previously caused Edge Runtime errors).
    // ============================================================================
  }

  // ============================================================================
  // STEP 7: ROLE-BASED ACCESS CONTROL
  // Check user's role in organization for specific route types
  // ============================================================================

  // Mentor routes (/dashboard, /knowledge, /students, etc.)
  // Requires: org:admin OR org:team_member
  if (isMentorRoute(req)) {
    if (orgRole !== 'org:admin' && orgRole !== 'org:team_member') {
      console.log('[SECURITY] Mentor route access denied:', {
        userId,
        orgId,
        orgRole,
        path: req.nextUrl.pathname,
        timestamp: new Date().toISOString(),
        reason: 'Insufficient role - requires org:admin or org:team_member',
      });
      return new Response('Unauthorized', { status: 403 });
    }
  }

  // Student routes (/chat, /user-memory)
  // Requires: org:student OR org:admin OR org:team_member
  // Note: Mentors/admins can access student routes for monitoring/testing
  if (isStudentRoute(req)) {
    const allowedRoles = ['org:student', 'org:admin', 'org:team_member'];
    if (!allowedRoles.includes(orgRole as string)) {
      console.log('[SECURITY] Student route access denied:', {
        userId,
        orgId,
        orgRole,
        path: req.nextUrl.pathname,
        timestamp: new Date().toISOString(),
        reason:
          'Insufficient role - requires org:student, org:admin, or org:team_member',
      });
      return new Response('Unauthorized', { status: 403 });
    }
  }

  // ============================================================================
  // AUTHORIZATION COMPLETE
  // User has valid session, org membership, and role permissions
  // Proceed to route handler, which will use Clerk-authenticated Supabase client
  // RLS will further filter data by user's clerk_org_id
  // ============================================================================
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
