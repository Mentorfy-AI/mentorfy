import { getDashboardMetrics } from "@/lib/data/dashboard"
import { ConversationsOverTimeClient } from "./conversations-over-time-client"

export async function ConversationsOverTime() {
  // Fetch data on the server with org scoping
  const metrics = await getDashboardMetrics('1month')

  return (
    <ConversationsOverTimeClient
      initialPeriod="1month"
      initialChartData={metrics.conversationsOverTime}
    />
  )
}
