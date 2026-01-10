/**
 * Sanitizes session context before sending to AI agents.
 *
 * Transforms implementation-specific keys (phase2, phase3, etc.) into
 * semantic labels that don't reveal the underlying flow structure.
 * This prevents agents from mentioning "phases" or "steps" which breaks immersion.
 */

import { getFlow, type ContextMapping } from '@/data/flows'

type SessionContext = {
  user?: {
    name?: string
    email?: string
    phone?: string
  }
  // Progress tracking (internal, never shared with AI)
  progress?: {
    currentScreen?: string
    currentPhase?: number
    currentStep?: number
    completedPhases?: number[]
    videosWatched?: string[]
    justCompletedLevel?: boolean
  }
  // All other fields are flow-specific and dynamically mapped
  [key: string]: any
}

type SanitizedContext = {
  user?: {
    name?: string
    email?: string
  }
  [key: string]: any
}

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
 * Uses the flow's contextMapping to dynamically transform keys.
 * Strips out internal tracking data and renames phase-specific keys.
 */
export function sanitizeContextForAI(flowId: string, context: SessionContext): SanitizedContext {
  const sanitized: SanitizedContext = {}

  // User info (keep name for personalization, omit phone/email for privacy in prompts)
  if (context.user?.name) {
    sanitized.user = { name: context.user.name }
  }

  // Get the flow's context mapping
  const flow = getFlow(flowId)
  const mapping = flow.contextMapping

  if (mapping) {
    // Apply the flow's context mapping dynamically
    for (const [outputPath, inputPath] of Object.entries(mapping)) {
      const value = getNestedValue(context, inputPath)
      if (value !== undefined && value !== '' && value !== null) {
        setNestedValue(sanitized, outputPath, value)
      }
    }
  }

  // Clean up any empty nested objects
  return removeEmptyValues(sanitized)
}
