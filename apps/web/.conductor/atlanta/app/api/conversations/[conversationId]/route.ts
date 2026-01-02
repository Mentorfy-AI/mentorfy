import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId, orgId } = await auth()

    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClerkSupabaseClient()
    const conversationId = params.conversationId

    // Fetch conversation details with bot info
    const { data: conversation, error } = await supabase
      .from('conversation')
      .select(`
        *,
        mentor_bot:mentor_bot_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('id', conversationId)
      .eq('clerk_user_id', userId)
      .eq('clerk_org_id', orgId)
      .single()

    if (error) {
      console.error('Error fetching conversation:', error)
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      conversation,
    })
  } catch (error) {
    console.error('Error in GET /api/conversations/[conversationId]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
