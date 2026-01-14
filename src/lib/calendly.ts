/**
 * Appends session_id to a Calendly URL for webhook tracking.
 * Calendly preserves URL parameters in the tracking object of webhook payloads.
 */
export function getCalendlyUrlWithSession(
  baseUrl: string,
  sessionId?: string
): string {
  if (!sessionId) return baseUrl

  const url = new URL(baseUrl)
  url.searchParams.set('session_id', sessionId)
  return url.toString()
}
