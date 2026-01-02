import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isSuperAdmin } from '@/lib/auth-helpers';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Check super admin status
    const superAdmin = await isSuperAdmin();

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { stream, ...restBody } = body;

    console.log('[SECURITY] Agent console chat used', {
      userId,
      requestBody: restBody,
      isSuperAdmin: superAdmin,
      action: 'agent_console_chat',
      timestamp: new Date().toISOString(),
    });

    // Stream SSE response from backend
    const response = await fetch(`${API_URL}/internal/agent-console/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restBody),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to send message' },
        { status: response.status }
      );
    }

    // Pass through the SSE stream
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in agent console chat:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
