import { getConversation } from '@/lib/data/conversations'
import { ConversationDetail } from '@/components/conversations/conversation-detail'
import { getClerkUserDetails, enrichWithClerkUser } from '@/lib/clerk-enrichment'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ conversationId: string }>
}

export default async function ConversationDetailPage({ params }: PageProps) {
  const { conversationId } = await params

  try {
    const conversation = await getConversation(conversationId)

    // Enrich with Clerk user data (name, email)
    const clerkUserDetails = await getClerkUserDetails(conversation.clerk_user_id)
    const enrichedConversation = enrichWithClerkUser(conversation, clerkUserDetails)

    return (
      <div className="px-6 pt-2 pb-6 h-full">
        <ConversationDetail conversation={enrichedConversation} />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
