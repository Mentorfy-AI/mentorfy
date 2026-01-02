import { getConversations } from '@/lib/data/conversations'
import { ConversationsList } from '@/components/conversations/conversations-list'
import { getClerkUserDetailsMap, enrichManyWithClerkUsers } from '@/lib/clerk-enrichment'
import { requireOrgAdmin } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ConversationsPage() {
  // Require admin or team member role to access this page
  await requireOrgAdmin()

  const conversations = await getConversations()

  // Enrich conversations with Clerk user data (names, emails)
  // This fetches user details from Clerk API since we don't store them in Supabase
  // Filter out null clerk_user_ids (Slack users)
  const clerkUserIds = [...new Set(
    conversations
      .map((c) => c.clerk_user_id)
      .filter((id): id is string => id !== null && id !== undefined)
  )]
  const clerkUsersMap = await getClerkUserDetailsMap(clerkUserIds)

  // Enrich with Clerk data, handling Slack users specially
  const enrichedConversations = conversations.map((conv) => {
    if (!conv.clerk_user_id) {
      // Slack user - use platform_user_name instead
      return {
        ...conv,
        first_name: null,
        last_name: null,
        email: null,
        full_name: conv.platform_user_name || 'Slack User',
        initials: conv.platform_user_name
          ? conv.platform_user_name.substring(0, 2).toUpperCase()
          : 'SU',
      }
    }

    // Regular Clerk user
    const userDetails = clerkUsersMap.get(conv.clerk_user_id)
    return {
      ...conv,
      first_name: userDetails?.first_name || null,
      last_name: userDetails?.last_name || null,
      email: userDetails?.email || null,
      full_name: userDetails?.full_name || 'Unknown User',
      initials: userDetails?.initials || '??',
    }
  })

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">Monitor AI chats</p>
      </div>

      <ConversationsList initialConversations={enrichedConversations} />
    </div>
  )
}
