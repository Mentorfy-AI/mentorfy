import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export async function getConversations() {
  const supabase = await createClerkSupabaseClient()

  // Get conversations (RLS filters by org automatically)
  const { data: conversations, error: convError } = await supabase
    .from('conversation')
    .select(`
      *,
      mentor_bot:mentor_bot_id (
        id,
        name
      )
    `)
    .order('updated_at', { ascending: false })

  if (convError) throw convError

  // Note: User names/emails should be fetched from Clerk API when needed
  // Supabase user_profile only stores app-specific data (summary, metadata)
  return conversations || []
}

export async function getConversation(conversationId: string) {
  const supabase = await createClerkSupabaseClient()

  // Get conversation with messages (RLS filters by org automatically)
  const { data: conversation, error: convError } = await supabase
    .from('conversation')
    .select(`
      *,
      mentor_bot:mentor_bot_id (
        id,
        name
      ),
      messages:message (
        id,
        role,
        content,
        created_at,
        metadata
      )
    `)
    .eq('id', conversationId)
    .single()

  if (convError) throw convError

  // Sort messages by created_at
  if (conversation?.messages) {
    conversation.messages.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  // Note: User names/emails should be fetched from Clerk API when needed
  // conversation.clerk_user_id is available for Clerk lookups
  return conversation
}
