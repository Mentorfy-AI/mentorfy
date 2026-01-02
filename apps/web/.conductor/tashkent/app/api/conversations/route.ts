import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';

export interface ConversationListResponse {
  success: boolean;
  conversations?: any[];
  error?: string;
}

/**
 * GET /api/conversations
 * List all conversations for the current user, sorted by most recent
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ConversationListResponse>> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClerkSupabaseClient();

    // Get conversations for current user, sorted by most recent activity
    // Filter out Slack conversations (platform='slack') from student UI
    const { data: conversations, error } = await supabase
      .from('conversation')
      .select(
        `
        id,
        title,
        created_at,
        updated_at,
        last_message_at,
        memory_processed_at,
        clerk_user_id,
        clerk_org_id,
        platform,
        mentor_bot:mentor_bot_id (
          id,
          name,
          avatar_url
        )
      `
      )
      .eq('clerk_user_id', userId)
      .eq('clerk_org_id', orgId)
      .or('platform.is.null,platform.neq.slack')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
    });
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { botId, title } = body;

    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClerkSupabaseClient();

    // Verify bot belongs to organization
    const { data: bot } = await supabase
      .from('mentor_bot')
      .select('id')
      .eq('id', botId)
      .eq('clerk_org_id', orgId)
      .single();

    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Create conversation
    const { data: conversation, error } = await supabase
      .from('conversation')
      .insert({
        clerk_user_id: userId,
        clerk_org_id: orgId,
        mentor_bot_id: botId,
        title: title || 'New conversation',
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
