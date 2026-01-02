import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';

export interface MessagesResponse {
  success: boolean;
  messages?: any[];
  error?: string;
}

/**
 * GET /api/conversations/[conversationId]/messages
 * Get all messages for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
): Promise<NextResponse<MessagesResponse>> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClerkSupabaseClient();
    const conversationId = params.conversationId;

    // Verify conversation exists and belongs to same org (allows admins to view all conversations in org)
    const { data: conversation } = await supabase
      .from('conversation')
      .select('id')
      .eq('id', conversationId)
      .eq('clerk_org_id', orgId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('message')
      .select('id, role, content, created_at, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
    });
  } catch (error) {
    console.error('Messages API error:', error);
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
 * POST /api/conversations/[conversationId]/messages
 * Add a new message to a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { role, content } = body;

    if (!role || !content) {
      return NextResponse.json(
        { success: false, error: 'Role and content are required' },
        { status: 400 }
      );
    }

    const supabase = await createClerkSupabaseClient();
    const conversationId = params.conversationId;

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from('conversation')
      .select('id')
      .eq('id', conversationId)
      .eq('clerk_user_id', userId)
      .eq('clerk_org_id', orgId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from('message')
      .insert({
        conversation_id: conversationId,
        role,
        content,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return NextResponse.json(
        { success: false, error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Update conversation last_message_at
    const { error: updateError } = await supabase
      .from('conversation')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating conversation timestamp:', updateError);
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Create message error:', error);
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
