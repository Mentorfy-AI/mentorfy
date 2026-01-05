import type { Phase, Step, SalesPageStep, VideoStep } from '@/types'

export interface AvailableEmbeds {
  checkoutPlanId?: string
  videoUrl?: string
  calendlyUrl?: string
}

/**
 * Scan completed phases to find available embed URLs.
 * Returns the most recent URL of each type (scanning in reverse order).
 * Generic - works with any mentor's phases.
 */
export function getAvailableEmbeds(
  completedPhaseIds: number[],
  phases: Phase[]
): AvailableEmbeds {
  const result: AvailableEmbeds = {}

  // Get completed phases in reverse order (most recent first)
  const completedPhases = phases
    .filter(p => completedPhaseIds.includes(p.id))
    .reverse()

  for (const phase of completedPhases) {
    // Scan steps in reverse order within each phase
    const steps = [...phase.steps].reverse()

    for (const step of steps) {
      // Check for checkout
      if (!result.checkoutPlanId && isSalesPageStep(step) && step.checkoutPlanId) {
        result.checkoutPlanId = step.checkoutPlanId
      }

      // Check for calendly
      if (!result.calendlyUrl && isSalesPageStep(step) && step.calendlyUrl) {
        result.calendlyUrl = step.calendlyUrl
      }

      // Check for video
      if (!result.videoUrl && isVideoStep(step) && step.videoUrl) {
        result.videoUrl = step.videoUrl
      }

      // Early exit if we found everything
      if (result.checkoutPlanId && result.calendlyUrl && result.videoUrl) {
        return result
      }
    }
  }

  return result
}

function isSalesPageStep(step: Step): step is SalesPageStep {
  return step.type === 'sales-page'
}

function isVideoStep(step: Step): step is VideoStep {
  return step.type === 'video'
}
