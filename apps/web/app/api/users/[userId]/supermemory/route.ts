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
 * GET /api/users/[userId]/supermemory
 *
 * Fetches a user's Supermemory profile for mentor viewing.
 * Uses the mentor's orgId + target userId to build containerTag.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse<SupermemoryProfileResponse | ErrorResponse>> {
  try {
    const { userId: targetUserId } = await params;

    // Validate authentication - mentor must be logged in
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Construct containerTag using mentor's org + target user
    // This ensures mentor can only access memories within their org
    const containerTag = `${orgId}-${targetUserId}`;

    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) {
      console.error('SUPERMEMORY_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

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
    const profile = data.profile || data;

    return NextResponse.json({
      static: profile.static || [],
      dynamic: profile.dynamic || [],
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/users/[userId]/supermemory:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
