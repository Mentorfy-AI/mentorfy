import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats bot names from snake_case to Title Case
 * @param name - The bot name to format (can be snake_case like "csm_ai")
 * @returns Formatted bot name (e.g., "csm_ai" -> "Csm Ai", "customer_success" -> "Customer Success")
 *
 * Note: This function is used when display_name is not available or when we need to format
 * a raw name field. If display_name exists in the data, prefer using that directly.
 */
export function formatBotName(name: string | undefined | null): string {
  if (!name) return 'Unnamed Bot'

  // If the name contains underscores, treat it as snake_case and format it
  if (name.includes('_')) {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // If no underscores, return as-is (assume it's already formatted like "CSM AI")
  return name
}
