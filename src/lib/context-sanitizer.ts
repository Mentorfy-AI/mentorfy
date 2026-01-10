/**
 * Sanitizes session context before sending to AI
 * Removes internal tracking fields like phase/step progress
 * that the AI doesn't need and shouldn't reference
 */

type SessionContext = Record<string, unknown>

// Fields to remove from context before sending to AI
const INTERNAL_FIELDS = [
  'progress',
  'currentPhase',
  'currentStep',
  'completedPhases',
  'phaseIndex',
  'stepIndex',
]

/**
 * Remove internal tracking fields from session context
 * These are used for flow navigation but shouldn't influence AI responses
 */
export function sanitizeContextForAI(
  flowId: string,
  context: SessionContext | null | undefined
): SessionContext {
  if (!context || typeof context !== 'object') {
    return {}
  }

  const sanitized: SessionContext = {}

  for (const [key, value] of Object.entries(context)) {
    // Skip internal tracking fields
    if (INTERNAL_FIELDS.includes(key)) {
      continue
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = sanitizeContextForAI(flowId, value as SessionContext)
      if (Object.keys(nested).length > 0) {
        sanitized[key] = nested
      }
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
