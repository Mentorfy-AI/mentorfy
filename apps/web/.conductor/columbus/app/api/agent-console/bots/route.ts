import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    // Check super admin status
    const superAdmin = await isSuperAdmin();

    console.log('[SECURITY] Agent console bot list accessed', {
      userId,
      orgId,
      isSuperAdmin: superAdmin,
      action: 'list_bots_by_org',
      timestamp: new Date().toISOString()
    });

    // Agent console requires super admin access
    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    // Require org selection
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS (super admin explicitly querying specific org)
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('mentor_bot')
      .select('id, name, display_name, description, avatar_url, model_name, model_provider, system_prompt, clerk_org_id, created_at')
      .eq('clerk_org_id', orgId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bots' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bots' },
      { status: 500 }
    );
  }
}