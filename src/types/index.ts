/**
 * Shared Type Definitions
 * Generic types used across mentors/experiences
 */

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
// PHASE TYPES (Generic structure)
// ============================================

export interface Phase {
  id: number
  name: string
  description: string
  purpose: string
  steps: Step[]
  completionMessage: string
}

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
  variant?: 'checkout' | 'calendly'
  headline?: string
  copyAboveVideo?: string
  copyBelowVideo?: string
  videoKey?: string
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
