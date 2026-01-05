'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { AUTH_CONFIG } from '@/config/rafael-ai'
import { useSessionId } from '@/context/UserContext'

type PendingAction = () => void

/**
 * Hook that gates phase transitions behind authentication.
 *
 * When a user completes a phase that requires auth (per AUTH_CONFIG),
 * it shows a blocking auth wall (can't be dismissed).
 * After sign-in, it links the session to the user and executes the action.
 *
 * Note: Pending actions are stored in a ref and don't survive page refresh.
 * If this becomes a problem, consider using Clerk's afterSignInUrl for
 * URL-based flow instead. Current approach is simpler for most cases.
 */
export function useAuthGate() {
  const { isSignedIn, isLoaded, userId } = useAuth()
  const sessionId = useSessionId()

  // Whether to show the blocking auth wall
  const [showAuthWall, setShowAuthWall] = useState(false)

  // Store pending action to execute after sign-in
  const pendingActionRef = useRef<PendingAction | null>(null)

  // Track if we were signed out before (to detect sign-in completion)
  // Only set initial value after Clerk has loaded
  const wasSignedOutRef = useRef<boolean | null>(null)

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
    // Don't do anything until Clerk has loaded
    if (!isLoaded) return

    const handleSignInComplete = async () => {
      // Initialize wasSignedOut tracking once Clerk loads
      if (wasSignedOutRef.current === null) {
        wasSignedOutRef.current = !isSignedIn
        return
      }

      if (isSignedIn && wasSignedOutRef.current && pendingActionRef.current) {
        // User just signed in and we have a pending action
        await linkSession()

        // Hide the auth wall
        setShowAuthWall(false)

        // Execute the pending action
        const action = pendingActionRef.current
        pendingActionRef.current = null
        action()
      }

      wasSignedOutRef.current = !isSignedIn
    }

    handleSignInComplete()
  }, [isLoaded, isSignedIn, linkSession])

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

    // Wait for Clerk to load before making auth decision
    // If not loaded yet, allow through (better UX than blocking)
    // The auth check will happen on next phase if needed
    if (!isLoaded) {
      onAllowed()
      return
    }

    // Already signed in - allow immediately
    if (isSignedIn) {
      onAllowed()
      return
    }

    // Store action and show blocking auth wall
    pendingActionRef.current = onAllowed
    setShowAuthWall(true)
  }, [isLoaded, isSignedIn])

  return { gatePhaseTransition, showAuthWall }
}
