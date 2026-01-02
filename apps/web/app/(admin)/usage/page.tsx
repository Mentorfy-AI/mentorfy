'use client';

import { useState, useEffect, useCallback } from 'react';

interface OrgUsage {
  org_name: string | null;
  org_id: string;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  users: number;
  conversations: number;
}

interface ModelUsage {
  model: string;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  requests: number;
}

interface UserUsage {
  user_id: string;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  conversations: number;
}

interface Summary {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  orgs: number;
}

interface Organization {
  id: string;
  name: string;
}

interface UserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UsageData {
  summary: Summary;
  byOrg: OrgUsage[];
  byModel: ModelUsage[];
  byUser: UserUsage[] | null;
  userPagination: UserPagination;
  organizations: Organization[];
}

type TimeWindow = 'week' | 'month' | '3months' | 'year';

const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  week: 'Last 7 Days',
  month: 'This Month',
  '3months': 'Last 3 Months',
  year: 'Last Year',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

function formatModel(model: string): string {
  return model
    .replace('claude-', '')
    .replace('-20250929', '')
    .replace('-20250514', '')
    .replace('-20250219', '')
    .replace('-20241022', '')
    .replace('-20240620', '')
    .replace('-20240307', '')
    .replace('-20240229', '');
}

export default function UsagePage() {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('month');
  const [userPage, setUserPage] = useState(1);
  const [data, setData] = useState<UsageData | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageData = useCallback(async (preserveOrgs = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedOrgId) params.set('orgId', selectedOrgId);
      params.set('timeWindow', timeWindow);
      params.set('userPage', userPage.toString());

      const url = `/api/usage/admin?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const result = await response.json();
      setData(result);

      // Only update organizations list when not filtering by org (to keep full list in dropdown)
      if (!preserveOrgs && !selectedOrgId && result.organizations) {
        setOrganizations(result.organizations);
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, timeWindow, userPage]);

  // Initial load - fetch all orgs
  useEffect(() => {
    fetchUsageData(false);
  }, []);

  // When filters change, preserve org list
  useEffect(() => {
    fetchUsageData(true);
  }, [selectedOrgId, timeWindow, userPage]);

  // Reset user page when org changes
  useEffect(() => {
    setUserPage(1);
  }, [selectedOrgId]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usage Dashboard</h1>
          </div>
          <div className="flex gap-3">
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
              className="px-4 py-2 border rounded-md text-sm bg-background text-foreground"
            >
              {Object.entries(TIME_WINDOW_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value || null)}
              className="px-4 py-2 border rounded-md text-sm bg-background text-foreground"
            >
              <option value="">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="text-center py-12 text-red-500">{error}</div>}

        {data && (
          <>
            {/* Summary Cards */}
            <div className={`grid grid-cols-1 gap-6 mb-8 ${selectedOrgId ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              <div className="bg-card border rounded-lg p-6">
                <div className="text-sm text-muted-foreground">Cost</div>
                <div className="text-3xl font-bold text-foreground mt-2">
                  {formatCost(data.summary.cost)}
                </div>
              </div>
              <div className="bg-card border rounded-lg p-6">
                <div className="text-sm text-muted-foreground">Tokens</div>
                <div className="text-3xl font-bold text-foreground mt-2">
                  {formatTokens(data.summary.inputTokens + data.summary.outputTokens)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatTokens(data.summary.inputTokens)} in /{' '}
                  {formatTokens(data.summary.outputTokens)} out
                </div>
              </div>
              {!selectedOrgId && (
                <div className="bg-card border rounded-lg p-6">
                  <div className="text-sm text-muted-foreground">Active Orgs</div>
                  <div className="text-3xl font-bold text-foreground mt-2">
                    {data.summary.orgs}
                  </div>
                </div>
              )}
            </div>

            {/* By Organization - only show when not filtered to single org */}
            {!selectedOrgId && (
              <div className="bg-card border rounded-lg p-6 mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  By Organization
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                          Organization
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Cost
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Input
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Output
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Users
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Convos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byOrg.map((row) => (
                        <tr key={row.org_id} className="border-b last:border-0">
                          <td className="py-3 px-4 text-foreground">
                            {row.org_name || row.org_id.slice(0, 12) + '...'}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right font-medium">
                            {formatCost(row.cost)}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {formatTokens(row.input_tokens)}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {formatTokens(row.output_tokens)}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {row.users}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {row.conversations}
                          </td>
                        </tr>
                      ))}
                      {data.byOrg.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No usage data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* By Model */}
            <div className="bg-card border rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4">By Model</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Model
                      </th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                        Cost
                      </th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                        Input
                      </th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                        Output
                      </th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                        Requests
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byModel.map((row) => (
                      <tr key={row.model} className="border-b last:border-0">
                        <td className="py-3 px-4 text-foreground font-mono text-xs">
                          {formatModel(row.model)}
                        </td>
                        <td className="py-3 px-4 text-foreground text-right font-medium">
                          {formatCost(row.cost)}
                        </td>
                        <td className="py-3 px-4 text-foreground text-right">
                          {formatTokens(row.input_tokens)}
                        </td>
                        <td className="py-3 px-4 text-foreground text-right">
                          {formatTokens(row.output_tokens)}
                        </td>
                        <td className="py-3 px-4 text-foreground text-right">
                          {row.requests.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {data.byModel.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No usage data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By User (only when org selected) */}
            {selectedOrgId && data.byUser && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">By User</h2>
                  {data.userPagination.totalPages > 1 && (
                    <div className="text-sm text-muted-foreground">
                      {data.userPagination.total} users
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                          User ID
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Cost
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Input
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Output
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                          Convos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byUser.map((row) => (
                        <tr key={row.user_id} className="border-b last:border-0">
                          <td className="py-3 px-4 text-foreground font-mono text-xs">
                            {row.user_id.slice(0, 20)}...
                          </td>
                          <td className="py-3 px-4 text-foreground text-right font-medium">
                            {formatCost(row.cost)}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {formatTokens(row.input_tokens)}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {formatTokens(row.output_tokens)}
                          </td>
                          <td className="py-3 px-4 text-foreground text-right">
                            {row.conversations}
                          </td>
                        </tr>
                      ))}
                      {data.byUser.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No usage data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.userPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <button
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={userPage === 1}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {userPage} of {data.userPagination.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setUserPage((p) => Math.min(data.userPagination.totalPages, p + 1))
                      }
                      disabled={userPage === data.userPagination.totalPages}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        )}
      </div>
    </div>
  );
}
