'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useReducer } from 'react'

const SESSION_KEY = 'mentorfy-session-id'

interface Session {
  id: string
  flow_id: string | null
  current_step_id: string
  answers: Record<string, any>
  name: string | null
  email: string | null
  phone: string | null
  status: string
}

// UI-only state (not persisted to backend)
interface UIState {
  currentScreen: 'welcome' | 'level-flow' | 'experience'
  currentPanel: number
}

type UIAction =
  | { type: 'SET_SCREEN'; payload: 'welcome' | 'level-flow' | 'experience' }
  | { type: 'SET_PANEL'; payload: number }

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, currentScreen: action.payload }
    case 'SET_PANEL':
      return { ...state, currentPanel: action.payload }
    default:
      return state
  }
}

interface UserContextValue {
  session: Session | null
  sessionLoading: boolean
  uiState: UIState
  dispatch: React.Dispatch<UIAction>
  completeStep: (stepId: string, answer?: Record<string, any>) => Promise<void>
  updateContact: (data: { name?: string; email?: string; phone?: string }) => Promise<void>
  switchToSession: (sessionId: string) => Promise<boolean>
}

const UserContext = createContext<UserContextValue | null>(null)

interface UserProviderProps {
  children: ReactNode
  flowId?: string
}

export function UserProvider({ children, flowId = 'rafael-tats' }: UserProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  // UI-only state with reducer
  const [uiState, dispatch] = useReducer(uiReducer, {
    currentScreen: 'welcome' as const,
    currentPanel: 0,
  })

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      const savedSessionId = localStorage.getItem(SESSION_KEY)

      if (savedSessionId) {
        try {
          const res = await fetch(`/api/session/${savedSessionId}`)
          if (res.ok) {
            const data = await res.json()
            // Check if existing session matches current flow
            if (data.flow_id === flowId) {
              setSession(data)
              // Restore UI state based on session progress
              const phase = deriveCurrentPhase(data.current_step_id)
              if (phase > 1 || data.current_step_id?.includes('complete')) {
                dispatch({ type: 'SET_SCREEN', payload: 'experience' })
              }
              setSessionLoading(false)
              return
            }
            // Flow mismatch - clear and create new session for this flow
            localStorage.removeItem(SESSION_KEY)
          } else {
            localStorage.removeItem(SESSION_KEY)
          }
        } catch (e) {
          console.error('Failed to validate session:', e)
          localStorage.removeItem(SESSION_KEY)
        }
      }

      // Create new session
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flow_id: flowId })
        })
        if (res.ok) {
          const { sessionId } = await res.json()
          localStorage.setItem(SESSION_KEY, sessionId)
          // Fetch full session data
          const sessionRes = await fetch(`/api/session/${sessionId}`)
          if (sessionRes.ok) {
            setSession(await sessionRes.json())
          }
        }
      } catch (e) {
        console.error('Session creation error:', e)
      }
      setSessionLoading(false)
    }

    initSession()
  }, [flowId])

  // Complete a step - server-as-truth
  const completeStep = useCallback(async (stepId: string, answer?: Record<string, any>) => {
    if (!session) return

    try {
      const res = await fetch('/api/flow/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          stepId,
          answer,
        })
      })

      if (res.ok) {
        const data = await res.json()
        setSession(prev => prev ? {
          ...prev,
          current_step_id: data.currentStepId,
          answers: data.answers,
        } : null)
      }
    } catch (e) {
      console.error('Step completion error:', e)
    }
  }, [session])

  // Update contact info
  const updateContact = useCallback(async (data: { name?: string; email?: string; phone?: string }) => {
    if (!session) return

    try {
      const res = await fetch(`/api/session/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        const updated = await res.json()
        setSession(updated)
      }
    } catch (e) {
      console.error('Contact update error:', e)
    }
  }, [session])

  // Switch to existing session
  const switchToSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/session/${sessionId}`)
      if (!res.ok) return false

      const data = await res.json()
      localStorage.setItem(SESSION_KEY, sessionId)
      setSession(data)
      return true
    } catch (e) {
      console.error('Switch session error:', e)
      return false
    }
  }, [])

  return (
    <UserContext.Provider value={{ session, sessionLoading, uiState, dispatch, completeStep, updateContact, switchToSession }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

export function useSession() {
  const { session, sessionLoading } = useUser()
  return { session, sessionLoading }
}

export function useSessionId() {
  const { session } = useUser()
  return session?.id ?? null
}

export function useCompleteStep() {
  const { completeStep } = useUser()
  return completeStep
}

// Legacy exports for backward compatibility during migration
export function useUserState() {
  const { session, sessionLoading, uiState } = useUser()
  // Map new session structure to old state structure for components still using it
  return {
    sessionId: session?.id ?? null,
    sessionLoading,
    user: {
      name: session?.name ?? '',
      email: session?.email ?? '',
      phone: session?.phone ?? '',
    },
    // Raw answers object for direct access (e.g., models.whatHappened)
    answers: session?.answers ?? {},
    situation: session?.answers?.situation ?? {},
    phase2: session?.answers?.phase2 ?? {},
    phase3: session?.answers?.phase3 ?? {},
    phase4: session?.answers?.phase4 ?? {},
    progress: {
      currentScreen: uiState.currentScreen,
      currentPhase: deriveCurrentPhase(session?.current_step_id),
      currentStep: deriveCurrentStep(session?.current_step_id),
      completedPhases: deriveCompletedPhases(session?.current_step_id),
      videosWatched: [],
      justCompletedLevel: false,
    },
    timeline: {
      currentPanel: uiState.currentPanel,
      profileComplete: false,
    },
  }
}

// Derive current phase from step ID
function deriveCurrentPhase(stepId: string | null | undefined): number {
  if (!stepId) return 1
  // Check for phase-N-complete pattern - if complete, we're on the NEXT phase
  const completeMatch = stepId.match(/^phase-(\d+)-complete$/)
  if (completeMatch) {
    return parseInt(completeMatch[1], 10) + 1
  }
  // Otherwise extract current phase number
  const match = stepId.match(/^phase-(\d+)/)
  return match ? parseInt(match[1], 10) : 1
}

// Derive current step within phase from step ID
function deriveCurrentStep(stepId: string | null | undefined): number {
  if (!stepId) return 0
  // Phase complete means we're done with all steps
  if (stepId.match(/^phase-\d+-complete$/)) return 0
  // Extract step number from phase-N-step-M pattern
  const match = stepId.match(/^phase-\d+-step-(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

// Derive completed phases from step ID
function deriveCompletedPhases(stepId: string | null | undefined): number[] {
  if (!stepId) return []
  const match = stepId.match(/^phase-(\d+)-(start|complete)$/)
  if (!match) return []
  const phaseNum = parseInt(match[1], 10)
  const state = match[2]
  const completedCount = state === 'complete' ? phaseNum : phaseNum - 1
  if (completedCount <= 0) return []
  return Array.from({ length: completedCount }, (_, i) => i + 1)
}

// Legacy dispatch hook for UI-only actions (SET_SCREEN, SET_PANEL)
export function useUserDispatch() {
  const { dispatch } = useUser()
  return dispatch
}
