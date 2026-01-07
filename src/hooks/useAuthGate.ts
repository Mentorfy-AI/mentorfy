'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { AUTH_CONFIG } from '@/config/flow'

type PendingAction = () => void

/**
 * Hook that gates phase transitions behind authentication.
 *
 * When a user completes a phase that requires auth (per AUTH_CONFIG),
 * it shows a blocking auth wall (can't be dismissed).
 * After sign-in, it executes the pending action.
 *
 * Session creation happens automatically in UserContext when auth completes.
 */
export function useAuthGate() {
  const { isSignedIn, isLoaded } = useAuth()

  // Whether to show the blocking auth wall
  const [showAuthWall, setShowAuthWall] = useState(false)

  // Store pending action to execute after sign-in
  const pendingActionRef = useRef<PendingAction | null>(null)

  // Track if we were signed out before (to detect sign-in completion)
  const wasSignedOutRef = useRef<boolean | null>(null)

  // Detect sign-in completion and execute pending action
  useEffect(() => {
    if (!isLoaded) return

    // Initialize tracking once Clerk loads
    if (wasSignedOutRef.current === null) {
      wasSignedOutRef.current = !isSignedIn
      return
    }

    // User just signed in and we have a pending action
    if (isSignedIn && wasSignedOutRef.current && pendingActionRef.current) {
      // Hide the auth wall
      setShowAuthWall(false)

      // Execute the pending action
      const action = pendingActionRef.current
      pendingActionRef.current = null
      action()
    }

    wasSignedOutRef.current = !isSignedIn
  }, [isLoaded, isSignedIn])

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
