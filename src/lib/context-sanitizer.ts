/**
 * Sanitizes session context before sending to AI agents.
 *
 * - Strips internal tracking fields (progress, phase/step indices)
 * - Applies flow's contextMapping to transform keys into semantic labels
 * - Keeps user name for personalization, omits phone/email for privacy
 */

import { getFlow } from '@/data/flows'

type SessionContext = Record<string, unknown>

// Fields to always remove from context before sending to AI
const INTERNAL_FIELDS = [
  'progress',
  'currentPhase',
  'currentStep',
  'completedPhases',
  'phaseIndex',
  'stepIndex',
]

/**
 * Gets a nested value from an object using dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Sets a nested value in an object using dot notation path
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (current[part] === undefined) {
      current[part] = {}
    }
    current = current[part]
  }
  current[parts[parts.length - 1]] = value
}

/**
 * Removes empty strings, undefined, and null values from nested objects
 */
function removeEmptyValues(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj

  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === '' || value === null) continue

    if (typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = removeEmptyValues(value)
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned
      }
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Strips internal fields recursively from context
 */
function stripInternalFields(context: SessionContext): SessionContext {
  const result: SessionContext = {}

  for (const [key, value] of Object.entries(context)) {
    if (INTERNAL_FIELDS.includes(key)) continue

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = stripInternalFields(value as SessionContext)
      if (Object.keys(nested).length > 0) {
        result[key] = nested
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Transforms raw session context into AI-friendly format.
 *
 * 1. Strips internal tracking fields (progress, indices)
 * 2. If flow has contextMapping, applies it to transform keys
 * 3. Keeps user name for personalization
 */
export function sanitizeContextForAI(
  flowId: string,
  context: SessionContext | null | undefined
): SessionContext {
  if (!context || typeof context !== 'object') {
    return {}
  }

  // Get the flow's context mapping
  const flow = getFlow(flowId)
  const mapping = flow.contextMapping

  // If flow has contextMapping, use it for explicit key transformation
  if (mapping && Object.keys(mapping).length > 0) {
    const sanitized: SessionContext = {}

    // Keep user name for personalization
    const userName = getNestedValue(context, 'user.name')
    if (userName) {
      sanitized.user = { name: userName }
    }

    // Apply the flow's context mapping
    for (const [outputPath, inputPath] of Object.entries(mapping)) {
      const value = getNestedValue(context, inputPath)
      if (value !== undefined && value !== '' && value !== null) {
        setNestedValue(sanitized, outputPath, value)
      }
    }

    return removeEmptyValues(sanitized)
  }

  // No contextMapping - just strip internal fields
  return stripInternalFields(context)
}
