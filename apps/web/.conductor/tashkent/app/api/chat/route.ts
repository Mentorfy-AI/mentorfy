import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';

// Configuration for backend API
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export interface ChatRequest {
  message: string;
  conversationId?: string;
  botId?: string;
  previousMessages?: any[]; // Full conversation history
}

export interface ChatResponse {
  response: string;
  conversationId?: string;
  sources?: string[];
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ChatResponse>> {
  try {
    const body: ChatRequest = await request.json();

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { response: '', error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get Clerk auth context
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { response: '', error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { response: '', error: 'No active organization' },
        { status: 400 }
      );
    }

    // Initialize Supabase client with Clerk token
    const supabase = await createClerkSupabaseClient();

    // Get bot ID - either from request or default to first bot in organization
    let botId = body.botId;
    if (!botId) {
      const { data: defaultBot, error: botError } = await supabase
        .from('mentor_bot')
        .select('id')
        .eq('clerk_org_id', orgId)
        .limit(1)
        .single();

      if (botError || !defaultBot) {
        return NextResponse.json(
          { response: '', error: 'No agent found for organization' },
          { status: 404 }
        );
      }
      botId = defaultBot.id;
    }

    // Validate bot belongs to user's organization
    const { data: botCheck, error: botCheckError } = await supabase
      .from('mentor_bot')
      .select('id')
      .eq('id', botId)
      .eq('clerk_org_id', orgId)
      .single();

    if (botCheckError || !botCheck) {
      console.log('[SECURITY] Access denied: User attempted to chat with bot from different org', {
        userId,
        orgId,
        botId,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { response: '', error: 'Agent not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[SECURITY] Chat message processed', {
      userId,
      orgId,
      botId,
      action: 'send_message',
      timestamp: new Date().toISOString()
    });

    // Call backend API
    try {
      const backendResponse = await fetch(`${BACKEND_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: body.message,
          conversation_id: body.conversationId,
          bot_id: botId,
          user_id: userId,
          organization_id: orgId,
          previous_messages: body.previousMessages, // Include conversation history
        }),
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Backend error: ${backendResponse.status}`
        );
      }

      const result = await backendResponse.json();

      return NextResponse.json({
        response: result.response,
        conversationId: result.conversation_id,
        sources: result.sources,
      });
    } catch (backendError) {
      console.error('Backend API call failed:', backendError);
      return NextResponse.json(
        {
          response: '',
          error: `Chat service temporarily unavailable: ${
            backendError instanceof Error
              ? backendError.message
              : 'Unknown error'
          }`,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        response: '',
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
