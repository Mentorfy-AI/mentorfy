/**
 * Form Utilities
 *
 * Helper functions for working with forms and answers
 */

import { Form, Answer, SemanticRole } from './types';

/**
 * User profile extracted from form answers
 */
export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // Raw 10 digits (no formatting)
}

/**
 * Extracts user profile from form answers using semantic roles and auth identifiers
 * Returns null if any required fields are missing
 */
export function extractUserProfile(
  form: Form,
  answers: Answer[]
): UserProfile | null {
  const getAnswerByRole = (role: SemanticRole): string | null => {
    // Find the question marked as auth identifier for this role
    const question = form.questions.find(
      q => q.semanticRole === role && q.isAuthIdentifier === true
    );

    if (!question) {
      console.error(`No auth identifier found for semantic role: ${role}`);
      return null;
    }

    const answer = answers.find(a => a.questionId === question.id);
    if (!answer) {
      console.error(`No answer found for question: ${question.id} (role: ${role})`);
      return null;
    }

    return answer.value as string;
  };

  const firstName = getAnswerByRole('first_name');
  const lastName = getAnswerByRole('last_name');
  const email = getAnswerByRole('email');
  const phone = getAnswerByRole('phone');

  if (!firstName || !lastName || !email || !phone) {
    console.error('Missing required profile fields:', {
      firstName: !!firstName,
      lastName: !!lastName,
      email: !!email,
      phone: !!phone,
    });
    return null;
  }

  return {
    firstName,
    lastName,
    email,
    phone,
  };
}
