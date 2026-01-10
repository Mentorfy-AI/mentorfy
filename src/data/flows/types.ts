export interface FlowDefinition {
  id: string
  mentor: MentorConfig
  phases: PhaseConfig[]
  agents: AgentConfig
  embeds: EmbedConfig
  /**
   * Maps raw session context keys to sanitized output keys for AI agents.
   * Format: 'outputKey': 'inputPath' where inputPath uses dot notation.
   * Groups outputs by category (e.g., 'businessStatus.bookingStatus': 'situation.bookingStatus')
   */
  contextMapping?: ContextMapping
}

export interface ContextMapping {
  [outputKey: string]: string
}

export interface MentorConfig {
  name: string
  handle: string
  avatar: string
  welcome: {
    callout?: string
    headline: string
    subheadline: string
    buttonText: string
    videoUrl?: string
    disclaimer?: string
    socialProof?: string
  }
}

export interface PhaseConfig {
  id: number
  name: string
  steps: StepConfig[]
}

export interface StepConfig {
  stepKey: string
  type: 'question' | 'ai-moment' | 'sales-page' | 'video' | 'thinking'
  question?: string
  questionType?: 'multiple-choice' | 'long-answer' | 'contact-info'
  options?: { label: string; value: string }[]
  stateKey?: string
  placeholder?: string
  fields?: ContactField[]
  promptKey?: string
  skipThinking?: boolean
  variant?: string
  headline?: string
  copyAboveVideo?: string
  copyBelowVideo?: string
  calendlyUrl?: string
  // Personalized question generation
  baseQuestion?: string
  personalizePromptKey?: string
  // Disqualification exit condition
  exitCondition?: {
    values: string[]
    headline: string
    message: string
  }
  // Explicitly hide back button on this step (for phase boundaries)
  noBackButton?: boolean
}

export interface ContactField {
  key: string
  label: string
  type: 'text' | 'email' | 'tel'
  placeholder: string
  autoComplete?: string
}

export interface AgentConfig {
  chat: { model: string; maxTokens: number; temperature: number }
  diagnosis?: { model: string; maxTokens: number }
  summary?: { model: string; maxTokens: number }
}

export interface EmbedConfig {
  checkoutAfterPhase?: number
  bookingAfterPhase?: number
  checkoutPlanId?: string
  calendlyUrl?: string
}
