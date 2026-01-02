import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClerkSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Call the database function with proper parameter names
    const { data, error } = await supabase.rpc('get_org_token_usage', {
      org_id_param: orgId,  // Fixed parameter name
      date_param: today,
    });

    if (error) {
      console.error('Error fetching usage:', error);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    const usage = data?.[0] || { total_tokens: 0, total_cost: 0 };

    return NextResponse.json({
      tokens: usage.total_tokens || 0,
      cost: parseFloat(usage.total_cost || 0),
      limit: 100000, // Daily limit
      date: today,
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
