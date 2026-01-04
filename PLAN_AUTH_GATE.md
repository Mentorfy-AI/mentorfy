# Implementation Plan: Auth Modal + Sign-In Wall

## Problem Statement

Users can currently complete the entire Mentorfy flow without signing in. We need to:

1. **Account button behavior:** When signed out, clicking the account button in the header should open a sign-in/sign-up modal. When signed in, Clerk's `<UserButton />` already handles showing a dropdown with sign-out.

2. **Sign-in wall after Phase 1:** Users can complete Phase 1 without auth, but must sign in/sign up to continue to Phase 2. This must be:
   - **Seamless:** After signing in, the phase transition continues automatically (no re-clicking "Continue")
   - **Modular:** The phase that triggers auth should be configurable (easily changed from Phase 1 to Phase 2, etc.)
   - **Decoupled:** Frontend config controls when auth is required; backend just stores session data

3. **Session linking:** When a user signs in, their Clerk account must be linked to their existing session, and they must be added to the mentor's Clerk organization.

---

## Relevant Codebase Context

### Key Files

| File | Purpose |
|------|---------|
| `src/app/rafael-ai/page.tsx` | Main page component. Contains the header with account button, phase transition handlers (`handleInitialLevelComplete`, `handlePanelLevelComplete`, `handleContinueClick`) |
| `src/config/rafael-ai.ts` | Central config for timing, colors, layout. Will add auth config here. |
| `src/context/UserContext.tsx` | User state management. Has `sessionId`, `CLERK_ORG_ID = 'rafael-tatts'`, session sync logic. |
| `src/components/rafael-ai/shared/ChatBar.tsx` | Contains "Continue to Phase X" button that triggers `onContinue` prop |
| `src/app/api/session/[id]/link/route.ts` | Existing endpoint for linking sessions (needs to be updated) |

### Current Auth Setup

Clerk is configured but not actively used:
- `<ClerkProvider>` wraps the app in `src/app/layout.tsx`
- Header in `page.tsx` (lines 309-345) has conditional rendering:
  - `<SignedIn>`: Shows `<UserButton />` (works correctly)
  - `<SignedOut>`: Shows a dimmed, non-functional user icon button

### Phase Transition Flow

1. User completes Phase 1 questions in `PhaseFlow` component
2. `PhaseFlow` calls `onComplete` prop
3. In `page.tsx`, this triggers either:
   - `handleInitialLevelComplete()` (fullscreen Phase 1)
   - `handlePanelLevelComplete()` (phases in panel mode)
4. These handlers dispatch `COMPLETE_PHASE` action, show celebration screen, increment `currentPhase`

### Session Management

- Sessions are created on first visit via `POST /api/session`
- Session ID stored in localStorage and `UserContext.state.sessionId`
- `CLERK_ORG_ID` is hardcoded as `'org_35wDDMLUgC1nZZLkDLtZ3A8TbJY'` - in future, this will come from mentor config
- `/api/session/[id]/link` endpoint exists but needs implementation for Clerk user + org linking

---

## Implementation

### Step 0: Update Org ID Constant

**File:** `src/context/UserContext.tsx`

Update the hardcoded org ID from slug to actual Clerk org ID:

```tsx
// Change from:
const CLERK_ORG_ID = 'rafael-tatts'

// To:
const CLERK_ORG_ID = 'org_35wDDMLUgC1nZZLkDLtZ3A8TbJY'
```

---

### Step 1: Add Auth Config

**File:** `src/config/rafael-ai.ts`

Add at the end of the file:

```tsx
// Auth configuration
export const AUTH_CONFIG = {
  // Which phase completion triggers sign-in requirement
  // null = no auth required, 1 = after Phase 1, 2 = after Phase 2, etc.
  requireAuthAfterPhase: 1 as number | null,
}
```

---

### Step 2: Create the Auth Gate Hook

**File:** `src/hooks/useAuthGate.ts` (new file)

```tsx
'use client'

import { useAuth, useClerk } from '@clerk/nextjs'
import { useEffect, useRef, useCallback } from 'react'
import { AUTH_CONFIG } from '@/config/rafael-ai'
import { useSessionId } from '@/context/UserContext'

/**
 * Hook for gating phase transitions behind authentication.
 *
 * When a user tries to continue past a gated phase:
 * 1. If signed in: action proceeds immediately
 * 2. If signed out: modal opens, action is stored, executes after sign-in
 *
 * Also handles linking the session to Clerk user after sign-in.
 */
export function useAuthGate() {
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const sessionId = useSessionId()

  // Store the action to execute after sign-in completes
  const pendingActionRef = useRef<(() => void) | null>(null)

  // Track previous auth state to detect sign-in moment
  const wasSignedInRef = useRef(isSignedIn)

  // Detect when user signs in and execute pending action
  useEffect(() => {
    const justSignedIn = isSignedIn && !wasSignedInRef.current
    wasSignedInRef.current = isSignedIn

    if (justSignedIn) {
      // Link session to Clerk user and add to org
      if (sessionId) {
        fetch(`/api/session/${sessionId}/link`, {
          method: 'POST',
        }).catch(err => console.error('Failed to link session:', err))
      }

      // Execute the pending phase transition
      if (pendingActionRef.current) {
        const action = pendingActionRef.current
        pendingActionRef.current = null
        // Small delay to let the modal close smoothly
        setTimeout(action, 100)
      }
    }
  }, [isSignedIn, sessionId])

  /**
   * Gate a phase transition behind auth if required by config.
   *
   * @param completedPhase - The phase number that was just completed
   * @param onAllowed - Callback to execute if auth passes (or after sign-in)
   */
  const gatePhaseTransition = useCallback((
    completedPhase: number,
    onAllowed: () => void
  ): void => {
    const gatePhase = AUTH_CONFIG.requireAuthAfterPhase
    const needsAuth = gatePhase !== null && !isSignedIn && completedPhase >= gatePhase

    if (needsAuth) {
      pendingActionRef.current = onAllowed
      openSignIn({})
    } else {
      onAllowed()
    }
  }, [isSignedIn, openSignIn])

  return { gatePhaseTransition }
}
```

---

### Step 3: Update the Link Endpoint

**File:** `src/app/api/session/[id]/link/route.ts`

This endpoint needs to:
1. Get the authenticated Clerk user ID from the session (server-side, not from client)
2. Update the session record with the Clerk user ID
3. Add the user to the organization associated with this session

```tsx
import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    // Get authenticated user from Clerk session (don't trust client)
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Get the session to find its org ID
    const { data: session, error } = await db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const orgId = session.clerk_org_id // e.g., 'org_35wDDMLUgC1nZZLkDLtZ3A8TbJY'

    // 2. Update session with Clerk user ID
    await db
      .from('sessions')
      .update({ clerk_user_id: clerkUserId })
      .eq('id', sessionId)

    // 3. Add user to the organization (orgId is the actual Clerk org ID, e.g. org_35wDDM...)
    if (orgId) {
      const clerk = await clerkClient()

      try {
        await clerk.organizations.createOrganizationMembership({
          organizationId: orgId,
          userId: clerkUserId,
          role: 'org:member'
        })
      } catch (e: any) {
        // Ignore "already a member" errors (Clerk error code)
        const isAlreadyMember = e.errors?.some(
          (err: any) => err.code === 'already_a_member_in_organization'
        )
        if (!isAlreadyMember) throw e
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Link session error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

### Step 4: Wire Up the Header Account Button

**File:** `src/app/rafael-ai/page.tsx`

Add import at top:
```tsx
import { useClerk } from '@clerk/nextjs'
```

Inside `RafaelAIContent` component, add:
```tsx
const { openSignIn } = useClerk()
```

Replace the `<SignedOut>` button (around line 322-345) with:

```tsx
<SignedOut>
  <button
    onClick={() => openSignIn({})}
    style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      color: '#666',
      background: '#F0EBE4',
      border: '1px solid #E8E3DC',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s ease',
    }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </button>
</SignedOut>
```

Key changes: removed `opacity: 0.35`, changed `cursor: 'default'` to `'pointer'`, added `onClick`.

---

### Step 5: Integrate Auth Gate into Phase Transitions

**File:** `src/app/rafael-ai/page.tsx`

Add import:
```tsx
import { useAuthGate } from '@/hooks/useAuthGate'
```

Inside `RafaelAIContent`, add:
```tsx
const { gatePhaseTransition } = useAuthGate()
```

> **Note:** If a user closes the auth modal without signing in, then later signs in via the header button, the pending action will still execute. This is intentional - it provides a seamless experience regardless of how they authenticate.

Update `handleInitialLevelComplete` (around line 153):

```tsx
const handleInitialLevelComplete = () => {
  gatePhaseTransition(currentPhaseNumber, () => {
    // Existing logic - move all of it inside this callback
    setCompletedPhaseNumber(currentPhaseNumber)
    setShowLevelComplete(true)

    setTimeout(() => {
      setPanel(0)
      dispatch({ type: 'COMPLETE_PHASE', payload: currentPhaseNumber })
      setArrowReady(false)
      dispatch({ type: 'SET_SCREEN', payload: 'experience' })

      setTimeout(() => {
        setShowLevelComplete(false)
        setCompletedPhaseNumber(null)
      }, TIMING.LEVEL_COMPLETE_FADE)
    }, TIMING.LEVEL_COMPLETE_DURATION)
  })
}
```

Update `handlePanelLevelComplete` (around line 179):

```tsx
const handlePanelLevelComplete = () => {
  gatePhaseTransition(currentPhaseNumber, () => {
    // Existing logic - move all of it inside this callback
    setCompletedPhaseNumber(currentPhaseNumber)
    setShowLevelComplete(true)

    setTimeout(() => {
      dispatch({ type: 'COMPLETE_PHASE', payload: currentPhaseNumber })
      setArrowReady(false)
      setPanel(0)

      setTimeout(() => {
        setShowLevelComplete(false)
        setCompletedPhaseNumber(null)
      }, TIMING.LEVEL_COMPLETE_FADE)
    }, TIMING.LEVEL_COMPLETE_DURATION)
  })
}
```

---

## User Flow After Implementation

1. User arrives at `/rafael-ai`, starts Phase 1
2. User completes Phase 1 questions
3. `handleInitialLevelComplete` calls `gatePhaseTransition(1, transitionFn)`
4. Config says `requireAuthAfterPhase: 1`, user not signed in
5. Modal opens, `transitionFn` is stored in ref
6. User signs in or signs up via Clerk modal
7. `useEffect` in hook detects `isSignedIn` flip:
   - Calls `/api/session/[id]/link` to link Clerk user + add to org
   - Executes stored `transitionFn`
8. Phase transition proceeds seamlessly - user sees celebration screen, enters chat

---

## Changing the Auth Gate Phase

To move the sign-in wall from Phase 1 to Phase 2:

```tsx
// src/config/rafael-ai.ts
export const AUTH_CONFIG = {
  requireAuthAfterPhase: 2 as number | null, // Changed from 1 to 2
}
```

To disable the sign-in wall entirely:

```tsx
export const AUTH_CONFIG = {
  requireAuthAfterPhase: null as number | null,
}
```

---

## Review Notes

**Validated against codebase on 2026-01-04:**

1. **`useSessionId` hook** - Confirmed to exist in `src/context/UserContext.tsx:568-571`. Plan is correct.

2. **Organization ID** - `CLERK_ORG_ID` must be updated to `'org_35wDDMLUgC1nZZLkDLtZ3A8TbJY'` in UserContext. This is the actual Clerk org ID (not slug), which is passed to `POST /api/session` and stored in the `clerk_org_id` column. Using the org ID directly avoids slug resolution.

3. **Session schema** - Confirmed in `src/lib/db.ts:9-21`. Columns: `id`, `clerk_user_id` (nullable), `clerk_org_id`, `email`, `phone`, `name`, `supermemory_container`, `status`, `context`, `created_at`, `updated_at`.

4. **Session timing** - Sessions are created on first visit via `UserContext.initSession()`. The `if (sessionId)` check in the hook handles the edge case where sign-in happens before session creation (unlikely but safe).

**Related issue:** `mentorfy-8g0` - Race condition on email uniqueness (separate from this plan)

---

## Simplifications Applied

- Removed unused return value from `gatePhaseTransition` (was returning `boolean`, now `void`)
- Removed unused `isSignedIn` from hook return (can be obtained directly from `useAuth()` if needed)
- Added note about pending action behavior when modal is closed without signing in
