/**
 * Sanitizes session context before sending to AI agents.
 *
 * Transforms implementation-specific keys into semantic labels using
 * the flow's contextMapping. This prevents agents from mentioning
 * internal structure like "phases" or "steps" which breaks immersion.
 */

import { getFlow } from '@/data/flows'

type SessionContext = Record<string, unknown>

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
 * Transforms raw session context into AI-friendly semantic labels.
 * Uses the flow's contextMapping to transform keys.
 */
export function sanitizeContextForAI(
  flowId: string,
  context: SessionContext | null | undefined
): SessionContext {
  if (!context || typeof context !== 'object') {
    return {}
  }

  const flow = getFlow(flowId)
  const mapping = flow.contextMapping

  if (!mapping) {
    console.warn(`Flow "${flowId}" has no contextMapping - AI will receive empty context`)
    return {}
  }

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
