/**
 * Flow Configuration
 * Central source of truth for all magic numbers, colors, and layout values
 */

import { getFlow } from '@/data/flows'

// Timing constants (in milliseconds)
export const TIMING = {
  // Thinking/response delays
  THINKING_DELAY: 800,
  RESPONSE_DELAY: 2300,

  // Level complete transitions
  LEVEL_COMPLETE_DURATION: 2000,
  LEVEL_COMPLETE_FADE: 1200,

  // Scroll behavior
  SCROLL_RETRY_INTERVAL: 100,
  SCROLL_INITIAL_DELAY: 500,
  SCROLL_MAX_RETRIES: 20,
  PROGRAMMATIC_SCROLL_RESET: 800,
  PROGRAMMATIC_SCROLL_INIT: 100,

  // Streaming text
  STREAM_SPEED: 5,

  // Animation durations
  FADE_DURATION: 0.4,
  CHECKMARK_DELAY: 0.2,
  TEXT_REVEAL_DELAY: 0.6,

  // AI Moment phases
  AI_THINKING_CYCLE: 2000,
  AI_WAITING_START: 6000,
  AI_STREAMING_START: 8000,

  // Demo command delay
  DEMO_THINKING_DELAY: 1200,

  // Arrow ready delay
  ARROW_READY_DELAY: 3000,
} as const

// Color palette
export const COLORS = {
  // Primary accent (green)
  ACCENT: '#10B981',
  ACCENT_SHADOW: 'rgba(16, 185, 129, 0.4)',
  ACCENT_SHADOW_LIGHT: 'rgba(16, 185, 129, 0.25)',
  ACCENT_GLOW: 'rgba(16, 185, 129, 0.55)',

  // Backgrounds
  BACKGROUND: '#FAF6F0',
  BACKGROUND_WHITE: '#FFFFFF',
  BACKGROUND_HEADER: 'rgba(255, 255, 255, 0.25)',

  // Text colors
  TEXT_PRIMARY: '#111',
  TEXT_SECONDARY: '#666',
  TEXT_MUTED: '#999',
  TEXT_LIGHT: '#888',

  // Borders and dividers
  BORDER: '#E8E3DC',
  BORDER_LIGHT: 'rgba(255, 255, 255, 0.4)',
  BORDER_SUBTLE: 'rgba(0, 0, 0, 0.06)',
  DIVIDER: '#E5E0D8',
  DIVIDER_LIGHT: '#E5E5E5',

  // Button backgrounds
  BUTTON_BG: '#F0EBE4',
  BUTTON_DISABLED: '#E8E3DC',

  // Glass effect
  GLASS_BG: 'rgba(255, 255, 255, 0.25)',
  GLASS_BORDER: 'rgba(255, 255, 255, 0.4)',
} as const

// Layout constants
export const LAYOUT = {
  // Max widths
  MAX_WIDTH: 720,
  MAX_WIDTH_NARROW: 560,

  // Header
  HEADER_HEIGHT: 70,
  HEADER_TOP: 6,
  HEADER_PADDING: 20,
  HEADER_BORDER_RADIUS: 20,

  // Scroll
  SCROLL_MARGIN_TOP: 65,

  // Spacing
  GAP_SMALL: 8,
  GAP_MEDIUM: 16,
  GAP_LARGE: 24,
  GAP_XL: 28,

  // Border radius
  RADIUS_SMALL: 6,
  RADIUS_MEDIUM: 12,
  RADIUS_LARGE: 18,
  RADIUS_XL: 20,
  RADIUS_ROUND: 100,
  RADIUS_CIRCLE: '50%',

  // Button sizes
  BUTTON_SIZE_SMALL: 32,
  BUTTON_SIZE_MEDIUM: 40,

  // Z-index layers
  Z_HEADER: 100,
  Z_BUTTON: 50,
  Z_OVERLAY: 200,
} as const

// Typography
export const TYPOGRAPHY = {
  // Font families
  FONT_SANS: "'Geist', -apple-system, sans-serif",
  FONT_SERIF: "'Lora', Charter, Georgia, serif",

  // Font sizes
  SIZE_XS: 11,
  SIZE_SM: 12,
  SIZE_BASE: 13,
  SIZE_MD: 14,
  SIZE_LG: 15,
  SIZE_XL: 17,
  SIZE_2XL: 20,
  SIZE_3XL: 24,

  // Font weights
  WEIGHT_NORMAL: 400,
  WEIGHT_MEDIUM: 500,
  WEIGHT_SEMIBOLD: 600,

  // Line heights
  LINE_HEIGHT_TIGHT: 1.3,
  LINE_HEIGHT_NORMAL: 1.5,
  LINE_HEIGHT_RELAXED: 1.7,
} as const

// Helper to get phase names from a flow
export function getPhaseNames(flowId: string): Record<number, string> {
  const flow = getFlow(flowId)
  const names: Record<number, string> = {}
  for (const phase of flow.phases) {
    names[phase.id] = phase.name
  }
  return names
}

// Default phase names for rafael-tats (legacy compatibility)
export const PHASE_NAMES: Record<number, string> = getPhaseNames('rafael-tats')

// Authentication configuration
export const AUTH_CONFIG = {
  // Which phase completion triggers sign-in requirement
  // Set to null to disable auth requirement entirely
  requireAuthAfterPhase: null as number | null,
} as const

// Helper to get demo commands from a flow
export function getDemoCommands(flowId: string) {
  const flow = getFlow(flowId)
  return {
    'sell me': {
      embedType: 'checkout' as const,
      checkoutPlanId: flow.embeds.checkoutPlanId,
    },
    'video': {
      embedType: 'video' as const,
      videoUrl: flow.mentor.welcome.videoUrl,
    },
    'book me': {
      embedType: 'booking' as const,
      calendlyUrl: flow.embeds.calendlyUrl,
    },
  }
}

// Default demo commands for rafael-tats (legacy compatibility)
export const DEMO_COMMANDS = getDemoCommands('rafael-tats')
