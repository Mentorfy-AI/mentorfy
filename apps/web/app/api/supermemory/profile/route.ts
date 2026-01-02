import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SupermemoryProfileResponse {
  static: string[];
  dynamic: string[];
}

interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * GET /api/supermemory/profile
 *
 * Fetches the authenticated user's profile from Supermemory.
 * Uses scoped containerTag ({orgId}-{userId}) to ensure users only see their own data.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SupermemoryProfileResponse | ErrorResponse>> {
  try {
    // Validate authentication
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Construct scoped containerTag (same pattern as chat.py)
    const containerTag = `${orgId}-${userId}`;

    // Get Supermemory API key
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) {
      console.error('SUPERMEMORY_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // Call Supermemory API
    const response = await fetch('https://api.supermemory.ai/v4/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ containerTag }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Supermemory API error:', response.status, errorData);

      return NextResponse.json(
        {
          error: 'Failed to fetch profile from Supermemory',
          details: errorData.error || `Status ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Supermemory API returns data nested in a 'profile' object
    const profile = data.profile || data;

    // Return profile data
    return NextResponse.json({
      static: profile.static || [],
      dynamic: profile.dynamic || [],
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/supermemory/profile:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
