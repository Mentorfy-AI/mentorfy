export interface FlowDefinition {
  id: string
  mentor: MentorConfig
  phases: PhaseConfig[]
  agents: AgentConfig
  embeds: EmbedConfig
}

export interface MentorConfig {
  name: string
  handle: string
  avatar: string
  welcome: {
    headline: string
    subheadline: string
    buttonText: string
    videoUrl?: string
  }
}

export interface PhaseConfig {
  id: number
  name: string
  steps: StepConfig[]
}

export interface StepConfig {
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
