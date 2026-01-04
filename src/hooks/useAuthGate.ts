'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { AUTH_CONFIG } from '@/config/rafael-ai'
import { useSessionId } from '@/context/UserContext'

type PendingAction = () => void

/**
 * Hook that gates phase transitions behind authentication.
 *
 * When a user completes a phase that requires auth (per AUTH_CONFIG),
 * it opens the sign-in modal and stores the pending action.
 * After sign-in, it links the session to the user and executes the action.
 *
 * Note: Pending actions are stored in a ref and don't survive page refresh.
 * If this becomes a problem, consider using Clerk's afterSignInUrl for
 * URL-based flow instead. Current approach is simpler for most cases.
 */
export function useAuthGate() {
  const { isSignedIn, userId } = useAuth()
  const { openSignIn } = useClerk()
  const sessionId = useSessionId()

  // Store pending action to execute after sign-in
  const pendingActionRef = useRef<PendingAction | null>(null)

  // Track if we were signed out before (to detect sign-in completion)
  const wasSignedOutRef = useRef(!isSignedIn)

  // Link session to authenticated user
  const linkSession = useCallback(async () => {
    if (!sessionId || !userId) return false

    try {
      const res = await fetch(`/api/session/${sessionId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerk_user_id: userId })
      })
      return res.ok
    } catch (e) {
      console.error('Failed to link session:', e)
      return false
    }
  }, [sessionId, userId])

  // Detect sign-in completion and execute pending action
  useEffect(() => {
    const handleSignInComplete = async () => {
      if (isSignedIn && wasSignedOutRef.current && pendingActionRef.current) {
        // User just signed in and we have a pending action
        await linkSession()

        // Execute the pending action
        const action = pendingActionRef.current
        pendingActionRef.current = null
        action()
      }

      wasSignedOutRef.current = !isSignedIn
    }

    handleSignInComplete()
  }, [isSignedIn, linkSession])

  /**
   * Gate a phase transition behind authentication.
   *
   * @param completedPhase - The phase number that was just completed
   * @param onAllowed - Callback to execute when transition is allowed
   */
  const gatePhaseTransition = useCallback((
    completedPhase: number,
    onAllowed: () => void
  ) => {
    const { requireAuthAfterPhase } = AUTH_CONFIG

    // Auth disabled or not required for this phase
    if (requireAuthAfterPhase === null || completedPhase < requireAuthAfterPhase) {
      onAllowed()
      return
    }

    // Already signed in - allow immediately
    if (isSignedIn) {
      onAllowed()
      return
    }

    // Store action and open sign-in modal
    pendingActionRef.current = onAllowed
    openSignIn()
  }, [isSignedIn, openSignIn])

  return { gatePhaseTransition }
}
