/**
 * Rafael AI Type Definitions
 * Comprehensive TypeScript interfaces for all data structures
 */

// ============================================
// PHASE & STEP TYPES
// ============================================

export interface StepOption {
  value: string
  label: string
}

export interface ContactField {
  key: string
  label: string
  type: 'text' | 'email' | 'tel'
  placeholder: string
  autoComplete: string
}

// Base step interface
interface BaseStep {
  type: 'question' | 'ai-moment' | 'video' | 'sales-page'
  stateKey?: string
}

// Multiple choice question
export interface MultipleChoiceStep extends BaseStep {
  type: 'question'
  questionType: 'multiple-choice'
  question: string
  options: StepOption[]
  stateKey: string
}

// Long answer question
export interface LongAnswerStep extends BaseStep {
  type: 'question'
  questionType: 'long-answer'
  question: string
  placeholder: string
  stateKey: string
}

// Contact info question
export interface ContactInfoStep extends BaseStep {
  type: 'question'
  questionType: 'contact-info'
  question: string
  fields: ContactField[]
  stateKey: string
}

// AI moment step
export interface AIMomentStep extends BaseStep {
  type: 'ai-moment'
  promptKey: string
  skipThinking?: boolean
}

// Video step
export interface VideoStep extends BaseStep {
  type: 'video'
  videoUrl: string
  introText?: string
}

// Sales page step
export interface SalesPageStep extends BaseStep {
  type: 'sales-page'
  headline: string
  subheadline?: string
  videoUrl?: string
  checkoutPlanId?: string
  calendlyUrl?: string
}

// Union type for all steps
export type Step =
  | MultipleChoiceStep
  | LongAnswerStep
  | ContactInfoStep
  | AIMomentStep
  | VideoStep
  | SalesPageStep

// Question-only steps
export type QuestionStep = MultipleChoiceStep | LongAnswerStep | ContactInfoStep

// Phase definition
export interface Phase {
  id: number
  name: string
  description: string
  purpose: string
  steps: Step[]
  completionMessage: string
}

// ============================================
// MESSAGE TYPES
// ============================================

export type MessageRole = 'user' | 'assistant' | 'divider'

export interface EmbedData {
  embedType: 'checkout' | 'video' | 'booking'
  beforeText: string
  afterText: string
  checkoutPlanId?: string
  videoUrl?: string
  calendlyUrl?: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  _placeholder?: boolean
  embedData?: EmbedData
  thinkingTime?: number
  phaseNumber?: number
}

// ============================================
// STATE TYPES
// ============================================

export interface UserInfo {
  name: string
  phone: string
  email?: string
  createdAt: string | null
}

export interface TimelineState {
  currentPanel: number // 0 = Chat, 1 = PhaseFlow
  profileComplete: boolean
}

export interface SituationState {
  bookingStatus: string
  dayRate: string
  goal: string
  blocker: string
  confession: string
  // Legacy fields
  experience: string
  currentIncome: string
  biggestChallenge: string
  longAnswer: string
}

export interface Phase2State {
  checkFirst: string
  hundredKFollowers: string
  postWorked: string
  viewsReflection?: string
}

export interface Phase3State {
  timeOnContent: string
  hardestPart: string
  contentCreatorIdentity: string
  extraTime?: string
}

export interface Phase4State {
  lastPriceRaise: string
  tooExpensiveResponse: string
  pricingFear: string
  doubleRevenue?: string
}

export interface ProgressState {
  currentScreen: 'welcome' | 'level-flow' | 'experience'
  currentPhase: number
  currentStep: number
  completedPhases: number[]
  videosWatched: string[]
  justCompletedLevel: boolean
}

export interface MemoryEntry {
  date: string
  insight: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Complete user state
export interface UserState {
  user: UserInfo
  timeline: TimelineState
  situation: SituationState
  phase2: Phase2State
  phase3: Phase3State
  phase4: Phase4State
  progress: ProgressState
  memory: MemoryEntry[]
  conversation: ConversationMessage[]
  lastVisit: string | null
  firstVisit: string | null
  // Legacy fields
  level2?: {
    pricingFeeling: string
    raisedPrices: string
    pricingStory: string
  }
  level3?: {
    sellingFeeling: string
    lostSale: string
  }
}

// ============================================
// ACTION TYPES
// ============================================

export type UserAction =
  | { type: 'SET_SCREEN'; payload: ProgressState['currentScreen'] }
  | { type: 'SET_ANSWER'; payload: { key: string; value: string } }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'COMPLETE_PHASE'; payload: number }
  | { type: 'START_LEVEL' }
  | { type: 'WATCH_VIDEO'; payload: string }
  | { type: 'ADD_MEMORY'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: Omit<ConversationMessage, 'timestamp'> }
  | { type: 'SET_USER'; payload: Partial<UserInfo> }
  | { type: 'UPDATE_VISIT' }
  | { type: 'LOAD_STATE'; payload: UserState }
  | { type: 'RESET' }
  | { type: 'SET_PANEL'; payload: number }
  | { type: 'SET_PROFILE_COMPLETE'; payload: boolean }
  | { type: 'SET_CURRENT_PHASE'; payload: number }

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface PhaseFlowProps {
  levelId: number
  onComplete: () => void
  onBack?: () => void
  backHandlerRef?: React.MutableRefObject<(() => void) | null>
  hideHeader?: boolean
}

export interface AIChatProps {
  onArrowReady?: () => void
  currentPhase: number
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export interface TimelineShellProps {
  children: React.ReactNode
  currentPanel?: number
  onPanelChange?: (panel: number) => void
}

export interface PanelProps {
  children: React.ReactNode
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

// ============================================
// MENTOR TYPES
// ============================================

export interface MentorData {
  name: string
  handle: string
  avatar: string
  verified: boolean
  title: string
  welcomeMessage: string
  welcomeVideo: string
  welcomeSubtext: string
}

export interface VideoLibrary {
  [key: string]: string
}

// ============================================
// MOCK RESPONSE TYPES
// ============================================

export type ResponseGenerator = (state: UserState) => string

export interface MockResponses {
  [key: string]: ResponseGenerator
}
