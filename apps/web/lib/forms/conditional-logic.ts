/**
 * Conditional Logic Evaluation
 *
 * Evaluates boolean condition trees to determine form routing.
 */

import {
  Condition,
  StaticCondition,
  LLMCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  Answer,
  AnswerValue,
  ConditionalRoute,
} from './types';

/**
 * Evaluate a condition tree (recursive)
 */
export async function evaluateCondition(
  condition: Condition,
  answers: Answer[],
  formId: string
): Promise<boolean> {
  switch (condition.type) {
    case 'static':
      return evaluateStatic(condition, answers);

    case 'llm':
      return evaluateLLM(condition, answers, formId);

    case 'and':
      return evaluateAnd(condition, answers, formId);

    case 'or':
      return evaluateOr(condition, answers, formId);

    case 'not':
      return evaluateNot(condition, answers, formId);

    default:
      console.error('Unknown condition type:', condition);
      return false;
  }
}

/**
 * Evaluate static condition (compare answer value)
 */
function evaluateStatic(
  condition: StaticCondition,
  answers: Answer[]
): boolean {
  const answer = answers.find(a => a.questionId === condition.questionId);

  if (!answer) {
    return false;
  }

  switch (condition.operator) {
    case 'equals':
      return answer.value === condition.value;

    case 'not_equals':
      return answer.value !== condition.value;

    case 'contains':
      if (Array.isArray(answer.value)) {
        return answer.value.includes(condition.value as string);
      }
      return String(answer.value).includes(String(condition.value));

    case 'greater_than':
      return Number(answer.value) > Number(condition.value);

    case 'less_than':
      return Number(answer.value) < Number(condition.value);

    default:
      return false;
  }
}

/**
 * Evaluate LLM condition (ask AI to judge)
 */
async function evaluateLLM(
  condition: LLMCondition,
  answers: Answer[],
  formId: string
): Promise<boolean> {
  try {
    // Build context from all Q&As
    const context = answers
      .map(a => `Q: ${a.questionText}\nA: ${formatAnswerValue(a.value)}`)
      .join('\n\n');

    // Call LLM evaluation endpoint
    const response = await fetch('/api/forms/evaluate-condition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId, // Required for security validation
        evaluationPrompt: condition.evaluationPrompt,
        context,
        model: condition.model,
        temperature: condition.temperature,
      }),
    });

    if (!response.ok) {
      console.error('LLM evaluation failed:', await response.text());
      return false;
    }

    const { result } = await response.json();

    // Check if result matches expected
    return result.trim() === condition.expectedResult;
  } catch (error) {
    console.error('Error evaluating LLM condition:', error);
    return false;
  }
}

/**
 * Evaluate AND condition (all children must be true)
 */
async function evaluateAnd(
  condition: AndCondition,
  answers: Answer[],
  formId: string
): Promise<boolean> {
  const results = await Promise.all(
    condition.conditions.map(c => evaluateCondition(c, answers, formId))
  );
  return results.every(r => r === true);
}

/**
 * Evaluate OR condition (at least one child must be true)
 */
async function evaluateOr(
  condition: OrCondition,
  answers: Answer[],
  formId: string
): Promise<boolean> {
  const results = await Promise.all(
    condition.conditions.map(c => evaluateCondition(c, answers, formId))
  );
  return results.some(r => r === true);
}

/**
 * Evaluate NOT condition (invert child)
 */
async function evaluateNot(
  condition: NotCondition,
  answers: Answer[],
  formId: string
): Promise<boolean> {
  const result = await evaluateCondition(condition.condition, answers, formId);
  return !result;
}

/**
 * Get next question ID from conditional routes
 * Returns first matching route, or undefined if no matches
 */
export async function getNextQuestionFromConditional(
  routes: ConditionalRoute[],
  answers: Answer[],
  formId: string
): Promise<string | null | undefined> {
  // Evaluate routes in order, return first match
  for (const route of routes) {
    const matches = await evaluateCondition(route.condition, answers, formId);
    if (matches) {
      return route.nextQuestionId;
    }
  }

  // No conditions matched
  return undefined;
}

/**
 * Format answer value for display in LLM context
 */
function formatAnswerValue(value: AnswerValue): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}
