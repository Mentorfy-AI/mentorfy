import { createContext, useContext, useReducer, useEffect } from 'react'

const STORAGE_KEY = 'mentorfy-rafael-ai-state'

const initialState = {
  user: {
    name: "",
    phone: "",
    createdAt: null
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
    completedLevels: [],
    videosWatched: [],
    justCompletedLevel: false
  },

  memory: [],

  conversation: [],

  lastVisit: null,
  firstVisit: null
}

function reducer(state, action) {
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
          ...state[section],
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
          currentScreen: 'chat-home',
          justCompletedLevel: true
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

    default:
      return state
  }
}

const UserContext = createContext(null)

export function UserProvider({ children }) {
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
