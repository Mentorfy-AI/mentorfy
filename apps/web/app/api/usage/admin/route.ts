import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const timeWindow = searchParams.get('timeWindow') || 'month'; // 'week', 'month', '3months', 'year'
    const userPage = parseInt(searchParams.get('userPage') || '1', 10);
    const userLimit = 25;

    const superAdmin = await isSuperAdmin();

    console.log('[SECURITY] Usage admin data accessed', {
      userId,
      orgId,
      isSuperAdmin: superAdmin,
      action: 'view_usage',
      timestamp: new Date().toISOString(),
    });

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();

    // Get usage by org
    const { data: byOrg, error: orgError } = await supabase.rpc('get_usage_by_org_window', {
      org_filter: orgId,
      time_window: timeWindow,
    });

    if (orgError) {
      console.error('Error fetching org usage:', orgError);
      return NextResponse.json(
        { error: 'Failed to fetch org usage' },
        { status: 500 }
      );
    }

    // Get usage by model
    const { data: byModel, error: modelError } = await supabase.rpc('get_usage_by_model_window', {
      org_filter: orgId,
      time_window: timeWindow,
    });

    if (modelError) {
      console.error('Error fetching model usage:', modelError);
      return NextResponse.json(
        { error: 'Failed to fetch model usage' },
        { status: 500 }
      );
    }

    // Get usage by user (only when org selected) - paginated
    let byUser = null;
    let userTotal = 0;
    if (orgId) {
      const { data, error } = await supabase.rpc('get_usage_by_user_window', {
        org_id_param: orgId,
        time_window: timeWindow,
        page_num: userPage,
        page_size: userLimit,
      });

      if (error) {
        console.error('Error fetching user usage:', error);
      } else {
        byUser = data;
      }

      // Get total user count for pagination
      const { data: countData } = await supabase.rpc('get_usage_user_count', {
        org_id_param: orgId,
        time_window: timeWindow,
      });
      userTotal = countData?.[0]?.count || 0;
    }

    // Calculate summary
    const summary = {
      cost: byOrg?.reduce((sum: number, row: { cost: number }) => sum + Number(row.cost), 0) || 0,
      inputTokens: byOrg?.reduce((sum: number, row: { input_tokens: number }) => sum + Number(row.input_tokens), 0) || 0,
      outputTokens: byOrg?.reduce((sum: number, row: { output_tokens: number }) => sum + Number(row.output_tokens), 0) || 0,
      orgs: byOrg?.length || 0,
    };

    // Build org list from actual usage data (not Clerk) so IDs match
    const organizations = byOrg?.map((row: { org_id: string; org_name: string | null }) => ({
      id: row.org_id,
      name: row.org_name || row.org_id.slice(0, 16) + '...',
    })) || [];

    return NextResponse.json({
      summary,
      byOrg,
      byModel,
      byUser,
      userPagination: {
        page: userPage,
        limit: userLimit,
        total: userTotal,
        totalPages: Math.ceil(userTotal / userLimit),
      },
      organizations,
    });
  } catch (error) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
