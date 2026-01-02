import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';
import { requireOrgResource } from '@/lib/supabase-server';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 400 }
      );
    }

    const { botId } = params;

    // Validate bot belongs to user's organization
    const bot = await requireOrgResource('mentor_bot', botId, orgId, 'clerk_org_id');
    if (!bot) {
      console.log('[SECURITY] Access denied: User attempted to update bot from different org', {
        userId,
        orgId,
        botId,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    console.log('[SECURITY] Bot system prompt update', {
      userId,
      orgId,
      botId,
      action: 'update_system_prompt',
      timestamp: new Date().toISOString()
    });

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_URL}/api/mentor-bots/${botId}/system-prompt`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to update system prompt' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating system prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}