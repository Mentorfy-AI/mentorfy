import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'
import { auth } from '@clerk/nextjs/server'

export interface DashboardMetrics {
  interval: '1month' | '3months' | '6months' | '1year'
  conversationsOverTime: Array<{
    date: string
    count: number
  }>
  studentsHelped: {
    current: number
    previous: number
    percentChange: number
  }
  totalConversations: {
    current: number
    previous: number
    percentChange: number
  }
  timeSaved: {
    currentMinutes: number
    previousMinutes: number
    percentChange: number
  }
}

function getDateRanges(interval: string) {
  const now = new Date()
  let daysInPeriod: number

  switch (interval) {
    case '1month':
      daysInPeriod = 30
      break
    case '3months':
      daysInPeriod = 90
      break
    case '6months':
      daysInPeriod = 180
      break
    case '1year':
      daysInPeriod = 365
      break
    default:
      daysInPeriod = 30
  }

  const currentStart = new Date(now)
  currentStart.setDate(now.getDate() - daysInPeriod)

  const previousStart = new Date(currentStart)
  previousStart.setDate(currentStart.getDate() - daysInPeriod)

  return {
    currentStart: currentStart.toISOString(),
    currentEnd: now.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: currentStart.toISOString(),
  }
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

export async function getDashboardMetrics(
  interval: '1month' | '3months' | '6months' | '1year' = '1month'
): Promise<DashboardMetrics> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Authentication required')
  }

  const supabase = await createClerkSupabaseClient()
  const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(interval)

  // Execute all queries in parallel for better performance
  const [
    conversationsOverTimeResult,
    currentStudentsResult,
    previousStudentsResult,
    currentConversationsCountResult,
    previousConversationsCountResult,
    currentConversationIdsResult,
    previousConversationIdsResult,
  ] = await Promise.all([
    // 1. Conversations Over Time
    supabase
      .from('conversation')
      .select('created_at')
      .eq('clerk_org_id', orgId)
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd)
      .order('created_at'),

    // 2. Students Helped (Current Period)
    supabase
      .from('conversation')
      .select('clerk_user_id')
      .eq('clerk_org_id', orgId)
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // 3. Students Helped (Previous Period)
    supabase
      .from('conversation')
      .select('clerk_user_id')
      .eq('clerk_org_id', orgId)
      .gte('created_at', previousStart)
      .lt('created_at', currentStart),

    // 4. Total Conversations (Current Period)
    supabase
      .from('conversation')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_org_id', orgId)
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // 5. Total Conversations (Previous Period)
    supabase
      .from('conversation')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_org_id', orgId)
      .gte('created_at', previousStart)
      .lt('created_at', currentStart),

    // 6. Get conversation IDs for current period (for message counts)
    supabase
      .from('conversation')
      .select('id')
      .eq('clerk_org_id', orgId)
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // 7. Get conversation IDs for previous period (for message counts)
    supabase
      .from('conversation')
      .select('id')
      .eq('clerk_org_id', orgId)
      .gte('created_at', previousStart)
      .lt('created_at', currentStart),
  ])

  // Process conversations over time
  if (conversationsOverTimeResult.error) {
    console.error('Error fetching conversations over time:', conversationsOverTimeResult.error)
  }

  const conversationsByDate = new Map<string, number>()
  conversationsOverTimeResult.data?.forEach((conv) => {
    const date = new Date(conv.created_at).toISOString().split('T')[0]
    conversationsByDate.set(date, (conversationsByDate.get(date) || 0) + 1)
  })

  const conversationsOverTimeData = Array.from(conversationsByDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Process students
  if (currentStudentsResult.error) {
    console.error('Error fetching current students:', currentStudentsResult.error)
  }
  if (previousStudentsResult.error) {
    console.error('Error fetching previous students:', previousStudentsResult.error)
  }

  const currentStudentsCount = new Set(currentStudentsResult.data?.map((s) => s.clerk_user_id) || []).size
  const previousStudentsCount = new Set(previousStudentsResult.data?.map((s) => s.clerk_user_id) || []).size

  // Process conversation counts
  if (currentConversationsCountResult.error) {
    console.error('Error fetching current conversations count:', currentConversationsCountResult.error)
  }
  if (previousConversationsCountResult.error) {
    console.error('Error fetching previous conversations count:', previousConversationsCountResult.error)
  }

  const currentConversationsCount = currentConversationsCountResult.count || 0
  const previousConversationsCount = previousConversationsCountResult.count || 0

  // Process conversation IDs for message queries
  if (currentConversationIdsResult.error) {
    console.error('Error fetching current conversation IDs:', currentConversationIdsResult.error)
  }
  if (previousConversationIdsResult.error) {
    console.error('Error fetching previous conversation IDs:', previousConversationIdsResult.error)
  }

  const currentConvIds = currentConversationIdsResult.data?.map((c) => c.id) || []
  const previousConvIds = previousConversationIdsResult.data?.map((c) => c.id) || []

  // Fetch message counts in parallel
  const [currentMessagesResult, previousMessagesResult] = await Promise.all([
    supabase
      .from('message')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('conversation_id', currentConvIds.length > 0 ? currentConvIds : ['none']),

    previousConvIds.length > 0
      ? supabase
          .from('message')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user')
          .in('conversation_id', previousConvIds)
      : Promise.resolve({ count: 0, error: null }),
  ])

  if (currentMessagesResult.error) {
    console.error('Error fetching current user messages:', currentMessagesResult.error)
  }
  if (previousMessagesResult.error) {
    console.error('Error fetching previous user messages:', previousMessagesResult.error)
  }

  const currentTimeSavedMinutes = (currentMessagesResult.count || 0) * 5
  const previousTimeSavedMinutes = (previousMessagesResult.count || 0) * 5

  // Build response
  return {
    interval,
    conversationsOverTime: conversationsOverTimeData,
    studentsHelped: {
      current: currentStudentsCount,
      previous: previousStudentsCount,
      percentChange: calculatePercentChange(currentStudentsCount, previousStudentsCount),
    },
    totalConversations: {
      current: currentConversationsCount || 0,
      previous: previousConversationsCount || 0,
      percentChange: calculatePercentChange(currentConversationsCount || 0, previousConversationsCount || 0),
    },
    timeSaved: {
      currentMinutes: currentTimeSavedMinutes,
      previousMinutes: previousTimeSavedMinutes,
      percentChange: calculatePercentChange(currentTimeSavedMinutes, previousTimeSavedMinutes),
    },
  }
}
