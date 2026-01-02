import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';
import { z } from 'zod';

const createConversationSchema = z.object({
  botId: z.string().uuid('Invalid bot ID format'),
  message: z.string().optional(), // Allow empty message when files are attached
});

export interface CreateConversationResponse {
  success: boolean;
  conversationId?: string;
  error?: string;
}

/**
 * POST /api/conversations/create
 * Creates a new conversation and saves the first user message
 * Returns the conversation ID for immediate streaming
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateConversationResponse>> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createConversationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { botId, message } = validation.data;
    const supabase = await createClerkSupabaseClient();

    // Verify bot belongs to user's organization
    const { data: bot, error: botError } = await supabase
      .from('mentor_bot')
      .select('id')
      .eq('id', botId)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Create conversation with auto-generated title
    const title = message && message.trim()
      ? message.slice(0, 50).trim()
      : 'New conversation';
    const { data: conversation, error: convError } = await supabase
      .from('conversation')
      .insert({
        clerk_user_id: userId,
        clerk_org_id: orgId,
        mentor_bot_id: botId,
        title,
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error(
        '[CREATE-CONVERSATION] Failed to create conversation:',
        convError
      );
      return NextResponse.json(
        { success: false, error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
