
// ============================================================================
// Question Types (Discriminated Union)
// ============================================================================

export type QuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'likert_scale' | 'number_input' | 'email';

export type TransitionStrategy = 'auto_advance' | 'manual';
export type CanvasPosition = { x: number; y: number };

/**
 * Base fields common to all question types
 */
interface BaseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  subtext?: string; // UI Extension: Helper text (e.g. "Select all that apply")
  required: boolean;
  transitionStrategy?: TransitionStrategy; // Made optional for the viewer
  position?: CanvasPosition; // Made optional for the viewer
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
 */
export interface LikertScaleQuestion extends BaseQuestion {
  type: 'likert_scale';
  statement: string; 
  options: string[]; 
}

/**
 * Number input (for quantitative metrics)
 */
export interface NumberInputQuestion extends BaseQuestion {
  type: 'number_input';
  min?: number;
  max?: number;
  step?: number; 
  prefix?: string; 
  suffix?: string; 
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
 * Union type of all question variants
 */
export type Question = ShortTextQuestion | LongTextQuestion | MultipleChoiceQuestion | LikertScaleQuestion | NumberInputQuestion | EmailQuestion;

// ============================================================================
// Answer Types
// ============================================================================

export type SingleAnswer = string | number;
export type MultiAnswer = string[]; // For multiple choice with maxSelections > 1
export type AnswerValue = SingleAnswer | MultiAnswer | null;

export interface Answers {
  [key: string]: AnswerValue;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  tags: string[];
}
