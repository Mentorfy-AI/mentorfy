import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface UserMemoryResponse {
  success: boolean;
  memory?: {
    memory_text: string;
    word_count: number;
    updated_at: string;
  };
  error?: string;
}

/**
 * GET /api/memory
 * Get user memory for the current authenticated user in their org
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<UserMemoryResponse>> {
  try {
    const { userId, orgId, getToken } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('GET /api/memory - Querying for:', { userId, orgId });

    // Using service client since we're already authenticated by Clerk middleware
    // and RLS with Clerk JWTs requires additional Supabase configuration
    const supabase = createServiceClient();

    // Get user memory for current user/org
    const { data, error } = await supabase
      .from('user_memory')
      .select('memory_text, word_count, updated_at')
      .eq('clerk_user_id', userId)
      .eq('clerk_org_id', orgId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user memory:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch memory' },
        { status: 500 }
      );
    }

    // If no memory exists yet, return empty state
    if (!data) {
      return NextResponse.json({
        success: true,
        memory: {
          memory_text: '',
          word_count: 0,
          updated_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      memory: data,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/memory:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
