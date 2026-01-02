/**
 * Form Validation
 *
 * Validates form structure before saving to ensure:
 * - Exactly one auth identifier per required semantic role
 * - Question groups reference valid questions
 * - All required fields are present
 */

import { Form, SemanticRole } from './types';

export class FormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormValidationError';
  }
}

/**
 * Validates that a form has exactly one auth identifier for each required semantic role
 * Throws FormValidationError if validation fails
 */
export function validateFormAuthFields(form: Form): void {
  const requiredRoles: SemanticRole[] = ['first_name', 'last_name', 'email', 'phone'];

  for (const role of requiredRoles) {
    const questionsWithRole = form.questions.filter(q => q.semanticRole === role);

    if (questionsWithRole.length === 0) {
      throw new FormValidationError(
        `Form must have at least one question with semanticRole="${role}"`
      );
    }

    const authIdentifiers = questionsWithRole.filter(q => q.isAuthIdentifier === true);

    if (authIdentifiers.length === 0) {
      throw new FormValidationError(
        `Form has ${questionsWithRole.length} question(s) with semanticRole="${role}" but none marked with isAuthIdentifier=true`
      );
    }

    if (authIdentifiers.length > 1) {
      const ids = authIdentifiers.map(q => q.id).join(', ');
      throw new FormValidationError(
        `Form has ${authIdentifiers.length} questions with semanticRole="${role}" marked as isAuthIdentifier=true. Expected exactly 1. Question IDs: ${ids}`
      );
    }
  }
}

/**
 * Validates question groups reference valid question IDs
 */
export function validateFormGroups(form: Form): void {
  if (!form.groups) return;

  const questionIds = new Set(form.questions.map(q => q.id));

  for (const group of form.groups) {
    for (const qid of group.questionIds) {
      if (!questionIds.has(qid)) {
        throw new FormValidationError(
          `Group "${group.id}" references non-existent question ID: ${qid}`
        );
      }
    }

    if (group.questionIds.length === 0) {
      throw new FormValidationError(
        `Group "${group.id}" has no questions`
      );
    }
  }
}

/**
 * Complete form validation - call before saving
 * Throws FormValidationError if validation fails
 */
export function validateForm(form: Form): void {
  validateFormAuthFields(form);
  validateFormGroups(form);
}
