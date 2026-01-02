import { ConversationsOverTime } from "@/components/conversations-over-time"
import { MetricsGrid } from "@/components/metrics-grid"
import { getDashboardMetrics } from "@/lib/data/dashboard"
import { requireOrgAdmin } from "@/lib/auth-helpers"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  // Require admin or team member role to access this page
  await requireOrgAdmin()

  // Fetch metrics for MetricsGrid only
  // ConversationsOverTime fetches its own data
  const metrics = await getDashboardMetrics('1month')

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">Dashboard</h1>
        <p className="text-muted-foreground text-pretty">Impact Insights</p>
      </div>

      <ConversationsOverTime />

      <MetricsGrid initialData={metrics} />
    </div>
  )
}
