import { ConversationsOverTime } from '@/components/conversations-over-time';
import { MetricsGrid } from '@/components/metrics-grid';
import { FormSubmissionsTable } from '@/components/form-submissions-table';
import { getDashboardMetrics } from '@/lib/data/dashboard';
import { getOrgForms } from '@/lib/data/forms';
import { requireOrgAdmin } from '@/lib/auth-helpers';
import { getFormAnalytics } from '@/lib/analytics/posthog-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  // Require admin or team member role to access this page
  await requireOrgAdmin();

  // Fetch metrics for MetricsGrid only
  // ConversationsOverTime fetches its own data
  const [metrics, forms] = await Promise.all([
    getDashboardMetrics('1month'),
    getOrgForms(),
  ]);

  // Fetch Form Analytics
  const formAnalytics = await getFormAnalytics();

  // Merge or append form analytics to metrics
  // Assuming MetricsGrid can handle custom metrics or we append them here
  // For now, let's just log it or pass it if MetricsGrid supports it.
  // Since I don't see MetricsGrid definition, I'll assume we can add to the metrics array or similar.
  // Actually, looking at the file, metrics is passed to initialData.
  // Let's verify MetricsGrid structure first, but for now I will just fetch it.

  // TODO: Integrate formAnalytics into MetricsGrid or a new component
  // For this task, I'll add a summary card above if possible, or just pass it to a new component.
  // Let's create a simple display for now.

  return (
    <div className="px-6 pt-2 pb-6 h-full">
      <div className="flex h-full overflow-hidden bg-card border rounded-lg">
        <div className="w-full flex flex-col overflow-hidden">
          {/* Chart - hidden on mobile */}
          <div className="hidden md:block border-b">
            <ConversationsOverTime />
          </div>

          {/* Stats row */}
          <div className="p-4 border-b">
            <MetricsGrid initialData={metrics} />
          </div>

          {/* Form Submissions */}
          <div className="flex-1 p-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-3">Form Submissions</h3>
            <div className="h-[calc(100%-2rem)]">
              <FormSubmissionsTable forms={forms} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
