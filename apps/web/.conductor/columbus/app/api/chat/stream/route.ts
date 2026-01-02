import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// CRITICAL: Disable caching for streaming endpoint
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

/**
 * Streaming chat proxy endpoint
 * Proxies SSE stream from FastAPI to Next.js frontend
 */
export async function POST(request: NextRequest) {
  try {
    // Get Clerk auth context
    const { userId, orgId } = await auth();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401 }
      );
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'No active organization' }),
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.conversation_id) {
      console.error('[STREAM] Missing conversation_id in request body');
      return new Response(
        JSON.stringify({ error: 'conversation_id is required' }),
        { status: 400 }
      );
    }

    if (!body.bot_id) {
      console.error('[STREAM] Missing bot_id in request body');
      return new Response(
        JSON.stringify({ error: 'bot_id is required' }),
        { status: 400 }
      );
    }

    // Build request payload with all required fields
    const backendPayload = {
      message: body.message,
      conversation_id: body.conversation_id,
      bot_id: body.bot_id,
      user_id: userId,
      organization_id: orgId,
      file_id: body.file_id,
      file_type: body.file_type,
      file_base64: body.file_base64,
      previous_messages: body.previous_messages,
    };

    console.log('[STREAM] Forwarding to backend:', {
      conversation_id: backendPayload.conversation_id,
      bot_id: backendPayload.bot_id,
      has_file: !!backendPayload.file_id,
      message_preview: backendPayload.message?.slice(0, 50),
    });

    // Forward to FastAPI streaming endpoint
    const response = await fetch(`${BACKEND_API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[STREAM] Backend error:', {
        status: response.status,
        error: errorData,
      });
      return new Response(
        JSON.stringify({
          error: errorData.detail || `Backend error: ${response.status}`,
          details: errorData
        }),
        { status: response.status }
      );
    }

    // Return the SSE stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('Streaming chat API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { status: 500 }
    );
  }
}
