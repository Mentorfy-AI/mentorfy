import { PostHog } from 'posthog-node'

export async function getFormAnalytics(formId?: string) {
  const projectId = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!projectId || !apiKey) {
    console.warn('PostHog credentials missing for server-side analytics')
    return {
      views: 0,
      completions: 0,
      conversionRate: 0
    }
  }

  try {
    // Fetch Views (Unique users who viewed the form)
    const viewsResponse = await fetch(
      `${host}/api/projects/${projectId}/insights/trend/?events=[{"id":"form_viewed","math":"dau"}]&date_from=-30d`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    )
    const viewsData = await viewsResponse.json()
    const totalViews = viewsData.result?.[0]?.count || 0

    // Fetch Completions (Total completions)
    const completionsResponse = await fetch(
      `${host}/api/projects/${projectId}/insights/trend/?events=[{"id":"form_completed","math":"total"}]&date_from=-30d`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    )
    const completionsData = await completionsResponse.json()
    const totalCompletions = completionsData.result?.[0]?.count || 0

    return {
      views: totalViews,
      completions: totalCompletions,
      conversionRate: totalViews > 0 ? (totalCompletions / totalViews) * 100 : 0
    }
  } catch (error) {
    console.error('Failed to fetch PostHog analytics:', error)
    return {
      views: 0,
      completions: 0,
      conversionRate: 0
    }
  }
}
