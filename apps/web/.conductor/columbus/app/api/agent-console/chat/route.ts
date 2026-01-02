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
      isSuperAdmin: superAdmin,
      action: 'debug_chat',
      stream: !!stream,
      timestamp: new Date().toISOString()
    });

    // Check if streaming is requested
    if (stream) {
      // Return SSE stream from backend
      const response = await fetch(`${API_URL}/internal/debug-chat/stream`, {
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
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming mode (fallback)
      const response = await fetch(`${API_URL}/internal/debug-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: error || 'Failed to send message' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error in debug chat:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}