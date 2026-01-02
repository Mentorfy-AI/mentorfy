import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations
 * Super admin endpoint to list ALL organizations in the system
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin using service role client (bypasses RLS)
    const supabase = createServiceClient();
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admin')
      .select('clerk_user_id')
      .eq('clerk_user_id', userId)
      .single();

    if (superAdminError || !superAdmin) {
      console.log('[SECURITY] Non-super-admin attempted to access all organizations', {
        userId,
        action: 'list_all_organizations',
        error: superAdminError?.message,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    console.log('[SECURITY] Super admin listing all organizations', {
      userId,
      action: 'list_all_organizations',
      timestamp: new Date().toISOString()
    });

    // Fetch all unique clerk_org_ids from mentor_bot table
    const { data: bots, error: botsError } = await supabase
      .from('mentor_bot')
      .select('clerk_org_id')
      .not('clerk_org_id', 'is', null);

    if (botsError) {
      console.error('Error fetching organizations:', botsError);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    // Get unique organization IDs
    const uniqueOrgIds = [...new Set(bots.map(bot => bot.clerk_org_id))];

    // Fetch organization details from Clerk using clerkClient
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();

    const organizations = await Promise.all(
      uniqueOrgIds.map(async (orgId) => {
        try {
          const org = await clerk.organizations.getOrganization({ organizationId: orgId });
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
          };
        } catch (error) {
          console.error(`Error fetching org ${orgId} from Clerk:`, error);
          // Fallback to orgId if Clerk fetch fails
          return {
            id: orgId,
            name: orgId,
            slug: orgId,
          };
        }
      })
    );

    const validOrgs = organizations.filter(org => org !== null);

    return NextResponse.json(validOrgs);
  } catch (error) {
    console.error('Error in /api/organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
