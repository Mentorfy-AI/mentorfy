/**
 * Form Builder Validation Logic
 *
 * Validates answers against question rules and form structure.
 */

import {
  Question,
  AnswerValue,
  ValidationResult,
  ShortTextQuestion,
  LongTextQuestion,
  MultipleChoiceQuestion,
  LikertScaleQuestion,
  NumberInputQuestion,
  EmailQuestion,
  PhoneQuestion,
  Form,
} from './types';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// ============================================================================
// Form Structure Validation
// ============================================================================

/**
 * Maximum character length for question text
 * Based on optimal readability and UI constraints
 */
export const MAX_QUESTION_TEXT_LENGTH = 150;

/**
 * Validates a question's structure (not its answer)
 * Checks constraints like question text length
 */
export function validateQuestion(question: Question): ValidationResult {
  // Validate question text length
  if (question.text.length > MAX_QUESTION_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Question text must be ${MAX_QUESTION_TEXT_LENGTH} characters or less (currently ${question.text.length})`,
    };
  }

  return { valid: true };
}

/**
 * Validates all questions in a form
 * Returns first validation error found, or success if all valid
 */
export function validateForm(form: Form): ValidationResult {
  for (const question of form.questions) {
    const result = validateQuestion(question);
    if (!result.valid) {
      return {
        valid: false,
        error: `Question "${question.id}": ${result.error}`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Answer Validation
// ============================================================================

/**
 * Validate an answer against a question's rules
 */
export function validateAnswer(
  question: Question,
  answer: AnswerValue
): ValidationResult {
  // Check required
  if (question.required && !answer) {
    return { valid: false, error: 'This field is required' };
  }

  // If not required and empty, it's valid
  if (!answer && !question.required) {
    return { valid: true };
  }

  // Type-specific validation
  switch (question.type) {
    case 'short_text':
      return validateShortText(question, answer);
    case 'long_text':
      return validateLongText(question, answer);
    case 'multiple_choice':
      return validateMultipleChoice(question, answer);
    case 'likert_scale':
      return validateLikertScale(question, answer);
    case 'number_input':
      return validateNumberInput(question, answer);
    case 'email':
      return validateEmail(question, answer);
    case 'phone':
      return validatePhone(question, answer);
    case 'informational':
      return { valid: true };  // No validation needed - display only
    default:
      return { valid: false, error: 'Unknown question type' };
  }
}

function validateShortText(
  question: ShortTextQuestion,
  answer: AnswerValue
): ValidationResult {
  if (typeof answer !== 'string') {
    return { valid: false, error: 'Answer must be text' };
  }

  if (question.maxLength && answer.length > question.maxLength) {
    return {
      valid: false,
      error: `Maximum ${question.maxLength} characters allowed`,
    };
  }

  return { valid: true };
}

function validateLongText(
  question: LongTextQuestion,
  answer: AnswerValue
): ValidationResult {
  if (typeof answer !== 'string') {
    return { valid: false, error: 'Answer must be text' };
  }

  if (question.minLength && answer.length < question.minLength) {
    return {
      valid: false,
      error: `Minimum ${question.minLength} characters required`,
    };
  }

  if (question.maxLength && answer.length > question.maxLength) {
    return {
      valid: false,
      error: `Maximum ${question.maxLength} characters allowed`,
    };
  }

  return { valid: true };
}

function validateMultipleChoice(
  question: MultipleChoiceQuestion,
  answer: AnswerValue
): ValidationResult {
  // Answer should be string (single) or string[] (multi)
  const selections = Array.isArray(answer) ? answer : [answer];

  // Check all selections are valid options
  const invalidSelections = selections.filter(
    s => !question.options.includes(String(s))
  );

  if (invalidSelections.length > 0) {
    return { valid: false, error: 'Invalid option selected' };
  }

  // Check min selections
  if (question.minSelections && selections.length < question.minSelections) {
    return {
      valid: false,
      error: `Please select at least ${question.minSelections} option(s)`,
    };
  }

  // Check max selections
  if (question.maxSelections && selections.length > question.maxSelections) {
    return {
      valid: false,
      error: `Please select at most ${question.maxSelections} option(s)`,
    };
  }

  return { valid: true };
}

function validateLikertScale(
  question: LikertScaleQuestion,
  answer: AnswerValue
): ValidationResult {
  if (!answer || typeof answer !== 'string') {
    return { valid: false, error: 'Please select an option' };
  }

  if (!question.options.includes(answer)) {
    return { valid: false, error: 'Invalid selection' };
  }

  return { valid: true };
}

function validateNumberInput(
  question: NumberInputQuestion,
  answer: AnswerValue
): ValidationResult {
  // Handle empty values
  if (answer === '' || answer === null || answer === undefined) {
    if (question.required) {
      return { valid: false, error: 'This field is required' };
    }
    return { valid: true };
  }

  const num = Number(answer);

  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid number' };
  }

  if (question.min !== undefined && num < question.min) {
    return { valid: false, error: `Minimum value is ${question.min}` };
  }

  if (question.max !== undefined && num > question.max) {
    return { valid: false, error: `Maximum value is ${question.max}` };
  }

  return { valid: true };
}

function validateEmail(
  question: EmailQuestion,
  answer: AnswerValue
): ValidationResult {
  if (typeof answer !== 'string') {
    return { valid: false, error: 'Answer must be text' };
  }

  const trimmed = answer.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }

  // Simple, practical email regex (covers 99% of real emails)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

function validatePhone(
  question: PhoneQuestion,
  answer: AnswerValue
): ValidationResult {
  if (typeof answer !== 'string') {
    return { valid: false, error: 'Answer must be text' };
  }

  const trimmed = answer.trim();

  if (!trimmed) {
    return { valid: false, error: 'Phone number is required' };
  }

  // Phone should be in E.164 format (e.g., +14155551234, +447700900123)
  if (!trimmed.startsWith('+')) {
    return {
      valid: false,
      error: 'Please select a country and enter your phone number',
    };
  }

  // Use libphonenumber to validate the international number
  const parsed = parsePhoneNumberFromString(trimmed);

  if (!parsed) {
    return {
      valid: false,
      error: 'Please enter a valid phone number',
    };
  }

  if (!parsed.isValid()) {
    return {
      valid: false,
      error: 'Please enter a valid phone number for your country',
    };
  }

  return { valid: true };
}
