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

    // Fetch organization details from Clerk using clerkClient
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();

    // Get all organizations from Clerk (includes new orgs not yet in mentor_bot table)
    const clerkOrganizations = await clerk.organizations.getOrganizationList({ limit: 100 });

    const organizations = clerkOrganizations.data.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
    }));

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
