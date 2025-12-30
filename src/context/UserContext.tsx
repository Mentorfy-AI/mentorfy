'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'mentorfy-rafael-ai-state'

const initialState = {
  user: {
    name: "",
    phone: "",
    createdAt: null as string | null
  },

  // Timeline state for horizontal navigation
  timeline: {
    currentPanel: 0, // 0=past, 1=present (only 2 panels)
    profileComplete: false
  },

  situation: {
    experience: "",
    currentIncome: "",
    biggestChallenge: "",
    goal: "",
    longAnswer: ""
  },

  level2: {
    pricingFeeling: "",
    raisedPrices: "",
    pricingStory: ""
  },

  level3: {
    sellingFeeling: "",
    lostSale: ""
  },

  progress: {
    currentScreen: "welcome",
    currentLevel: 1,
    currentStep: 0,
    completedLevels: [] as number[],
    videosWatched: [] as string[],
    justCompletedLevel: false
  },

  memory: [] as { date: string; insight: string }[],

  conversation: [] as any[],

  lastVisit: null as string | null,
  firstVisit: null as string | null
}

type State = typeof initialState

type Action =
  | { type: 'SET_SCREEN'; payload: string }
  | { type: 'SET_ANSWER'; payload: { key: string; value: any } }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'COMPLETE_LEVEL'; payload: number }
  | { type: 'START_LEVEL' }
  | { type: 'WATCH_VIDEO'; payload: string }
  | { type: 'ADD_MEMORY'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: any }
  | { type: 'SET_USER'; payload: any }
  | { type: 'UPDATE_VISIT' }
  | { type: 'LOAD_STATE'; payload: State }
  | { type: 'RESET' }
  | { type: 'SET_PANEL'; payload: number }
  | { type: 'SET_PROFILE_COMPLETE'; payload: boolean }
  | { type: 'SET_CURRENT_LEVEL'; payload: number }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SCREEN':
      return {
        ...state,
        progress: {
          ...state.progress,
          currentScreen: action.payload,
          justCompletedLevel: false
        }
      }

    case 'SET_ANSWER': {
      const { key, value } = action.payload
      const [section, field] = key.split('.')
      return {
        ...state,
        [section]: {
          ...(state as any)[section],
          [field]: value
        }
      }
    }

    case 'ADVANCE_STEP':
      return {
        ...state,
        progress: {
          ...state.progress,
          currentStep: state.progress.currentStep + 1
        }
      }

    case 'SET_STEP':
      return {
        ...state,
        progress: {
          ...state.progress,
          currentStep: action.payload
        }
      }

    case 'COMPLETE_LEVEL': {
      const levelId = action.payload
      const completedLevels = state.progress.completedLevels.includes(levelId)
        ? state.progress.completedLevels
        : [...state.progress.completedLevels, levelId]

      return {
        ...state,
        progress: {
          ...state.progress,
          completedLevels,
          currentLevel: levelId + 1,
          currentStep: 0,
          justCompletedLevel: true
          // Note: screen is set separately by the caller
        }
      }
    }

    case 'START_LEVEL':
      return {
        ...state,
        progress: {
          ...state.progress,
          currentScreen: 'level',
          currentStep: 0,
          justCompletedLevel: false
        }
      }

    case 'WATCH_VIDEO': {
      const videoKey = action.payload
      const videosWatched = state.progress.videosWatched.includes(videoKey)
        ? state.progress.videosWatched
        : [...state.progress.videosWatched, videoKey]

      return {
        ...state,
        progress: {
          ...state.progress,
          videosWatched
        }
      }
    }

    case 'ADD_MEMORY':
      return {
        ...state,
        memory: [
          ...state.memory,
          {
            date: new Date().toISOString().split('T')[0],
            insight: action.payload
          }
        ]
      }

    case 'ADD_MESSAGE':
      return {
        ...state,
        conversation: [
          ...state.conversation,
          {
            ...action.payload,
            timestamp: new Date().toISOString()
          }
        ]
      }

    case 'SET_USER':
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload,
          createdAt: state.user.createdAt || new Date().toISOString()
        }
      }

    case 'UPDATE_VISIT':
      return {
        ...state,
        lastVisit: new Date().toISOString(),
        firstVisit: state.firstVisit || new Date().toISOString()
      }

    case 'LOAD_STATE':
      return {
        ...action.payload,
        lastVisit: new Date().toISOString()
      }

    case 'RESET':
      return initialState

    case 'SET_PANEL':
      return {
        ...state,
        timeline: {
          ...state.timeline,
          currentPanel: action.payload
        }
      }

    case 'SET_PROFILE_COMPLETE':
      return {
        ...state,
        timeline: {
          ...state.timeline,
          profileComplete: action.payload
        }
      }

    case 'SET_CURRENT_LEVEL':
      return {
        ...state,
        progress: {
          ...state.progress,
          currentLevel: action.payload
        }
      }

    default:
      return state
  }
}

const UserContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        dispatch({ type: 'LOAD_STATE', payload: parsed })
      } catch (e) {
        console.error('Failed to load state:', e)
      }
    } else {
      dispatch({ type: 'UPDATE_VISIT' })
    }
  }, [])

  // Save to localStorage on state change
  useEffect(() => {
    if (state.firstVisit) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  return (
    <UserContext.Provider value={{ state, dispatch }}>
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

export function useUserState() {
  const { state } = useUser()
  return state
}

export function useUserDispatch() {
  const { dispatch } = useUser()
  return dispatch
}
