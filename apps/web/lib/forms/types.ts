/**
 * Form Builder Type Definitions
 *
 * Core types for building dynamic forms with LLM-powered transitions.
 * Supports both static (predefined) and dynamic (LLM-driven) question flows.
 */

// ============================================================================
// Canvas Positioning
// ============================================================================

/**
 * Position of a question on the canvas
 */
export interface CanvasPosition {
  x: number;
  y: number;
}

/**
 * Canvas viewport state (camera position and zoom)
 */
export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================================
// Transition Strategies
// ============================================================================

/**
 * Simple transition - always go to a specific question
 */
export interface SimpleTransition {
  type: 'simple';
  nextQuestionId: string | null; // null = end of form
}

/**
 * Conditional transition - evaluate conditions to determine next question
 */
export interface ConditionalTransition {
  type: 'conditional';
  routes: ConditionalRoute[];
  defaultNext: string | null; // Fallback if no routes match
}

export interface ConditionalRoute {
  condition: Condition;
  nextQuestionId: string | null;
}

/**
 * Union type of all transition strategies
 */
export type TransitionStrategy = SimpleTransition | ConditionalTransition;

// ============================================================================
// Conditions (Boolean Logic Tree)
// ============================================================================

/**
 * Static condition - check a previous answer's value
 */
export interface StaticCondition {
  type: 'static';
  questionId: string; // Which previous answer to check
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: AnswerValue;
}

/**
 * LLM condition - ask LLM to evaluate based on all previous answers
 */
export interface LLMCondition {
  type: 'llm';
  evaluationPrompt: string; // Has access to ALL previous Q&As
  expectedResult: string; // What LLM should return for this to pass
  model: string;
  temperature: number;
}

/**
 * AND condition - all child conditions must be true
 */
export interface AndCondition {
  type: 'and';
  conditions: Condition[];
}

/**
 * OR condition - at least one child condition must be true
 */
export interface OrCondition {
  type: 'or';
  conditions: Condition[];
}

/**
 * NOT condition - invert child condition
 */
export interface NotCondition {
  type: 'not';
  condition: Condition;
}

/**
 * Union type of all condition variants
 */
export type Condition =
  | StaticCondition
  | LLMCondition
  | AndCondition
  | OrCondition
  | NotCondition;

// ============================================================================
// Question Types (Discriminated Union)
// ============================================================================

export type QuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'likert_scale' | 'number_input' | 'email' | 'phone' | 'informational';

/**
 * Semantic roles for questions that map to user authentication/profile fields
 */
export type SemanticRole = 'first_name' | 'last_name' | 'email' | 'phone';

/**
 * Base fields common to all question types
 */
interface BaseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  subtext?: string; // Optional instruction/help text (e.g., "Select up to 3 options")
  required: boolean;
  transitionStrategy: TransitionStrategy;
  position: CanvasPosition;
  semanticRole?: SemanticRole; // Maps question to user profile field
  isAuthIdentifier?: boolean; // Marks THE field used for Clerk authentication (exactly one per semanticRole)
  buttonText?: string; // Custom text for the continue button (default: "OK")
}

/**
 * Short text input (single line)
 */
export interface ShortTextQuestion extends BaseQuestion {
  type: 'short_text';
  maxLength?: number;
  placeholder?: string;
}

/**
 * Long text input (multi-line textarea)
 */
export interface LongTextQuestion extends BaseQuestion {
  type: 'long_text';
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
}

/**
 * Multiple choice (single or multi-select)
 */
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  options: string[];
  minSelections?: number;
  maxSelections?: number; // 1 = single choice, >1 = multi-select
}

/**
 * Likert scale (agreement scale)
 * Used for psychological assessments and self-reflection
 * The statement being rated is in the base 'text' field
 * Optional category/label can be in 'subtext' field
 */
export interface LikertScaleQuestion extends BaseQuestion {
  type: 'likert_scale';
  options: string[]; // Scale options (e.g., ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"])
}

/**
 * Number input (for quantitative metrics)
 * Supports currency, hours, counts, etc.
 */
export interface NumberInputQuestion extends BaseQuestion {
  type: 'number_input';
  min?: number;
  max?: number;
  step?: number; // 1 for integers, 0.01 for currency
  prefix?: string; // "$", "£", etc.
  suffix?: string; // "hours", "days", "kg", etc.
  placeholder?: string;
}

/**
 * Email input with validation
 */
export interface EmailQuestion extends BaseQuestion {
  type: 'email';
  placeholder?: string;
}

/**
 * Phone input with validation (US format)
 */
export interface PhoneQuestion extends BaseQuestion {
  type: 'phone';
  placeholder?: string;
}

/**
 * Informational screen (display-only, no user input)
 * Used to show static or LLM-generated content between questions
 */
export interface InformationalQuestion extends BaseQuestion {
  type: 'informational';
  required: false;                    // Always false - no input to require
  content: string;                    // Static content OR LLM generation prompt
  contentSource: 'static' | 'llm';    // How to get the content
  llmConfig?: {                       // Only used if contentSource === 'llm'
    model: string;
    temperature: number;
  };
}

/**
 * Union type of all question variants
 */
export type Question = ShortTextQuestion | LongTextQuestion | MultipleChoiceQuestion | LikertScaleQuestion | NumberInputQuestion | EmailQuestion | PhoneQuestion | InformationalQuestion;

// ============================================================================
// Form Definition (Template)
// ============================================================================

/**
 * Group of questions to display together on the same screen
 */
export interface QuestionGroup {
  id: string;
  questionIds: string[]; // Question IDs to show together
  layout?: 'horizontal' | 'vertical' | 'grid'; // Layout arrangement
  title?: string; // Optional title text displayed above the grouped questions
}

/**
 * Welcome screen configuration for forms
 */
export interface WelcomeConfig {
  headline: string; // Main headline text (e.g., "FREE 30-MINUTE SCALING GROWTH MAP SESSION")
  description: string; // Body copy explaining the offer/form
  buttonText: string; // CTA button text (e.g., "Get Started")
  footerText?: string; // Optional footer text (e.g., reviews, disclaimers)
}

/**
 * Complete form template/definition
 */
export interface Form {
  id: string;
  name: string;
  organizationId?: string; // For future multi-tenancy
  questions: Question[];
  groups?: QuestionGroup[]; // Optional grouping - if absent, one question per screen
  viewport?: CanvasViewport; // Canvas camera state
  welcome?: WelcomeConfig; // Optional welcome screen configuration
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Form Completion (Instance Data)
// ============================================================================

/**
 * Answer value can be various types depending on question
 */
export type AnswerValue = string | string[] | number | boolean;

/**
 * A single answer to a question
 */
export interface Answer {
  questionId: string;
  questionText: string; // Actual text shown (critical for dynamic questions)
  value: AnswerValue;
  answeredAt: string; // ISO timestamp
}

/**
 * Metadata about form completion progress
 */
export interface CompletionMetadata {
  viewHistory: string[]; // Ordered list of views shown
}

/**
 * A prospect's progress through a form (partial or complete)
 */
export interface LeadFormCompletion {
  id: string;
  formId: string; // Which form template was used
  currentViewId: string | null; // null = completed
  answers: Answer[];
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  metadata: CompletionMetadata;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Result of validating an answer
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}
