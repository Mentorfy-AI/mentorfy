import { getUserProfile, getSupermemoryProfile } from '@/lib/data/users'
import { getConversations } from '@/lib/data/conversations'
import { UserProfile } from '@/components/users/user-profile'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ userId: string }>
}

export default async function UserProfilePage({ params }: PageProps) {
  const { userId } = await params

  try {
    const [user, conversations, supermemoryProfile] = await Promise.all([
      getUserProfile(userId),
      getConversations(),
      getSupermemoryProfile(userId),
    ])

    // Filter conversations for this user
    const userConversations = conversations.filter(
      (c) => c.clerk_user_id === userId
    )

    return (
      <div className="px-6 pt-2 pb-6 h-full">
        <UserProfile
          user={user}
          conversations={userConversations}
          supermemoryProfile={supermemoryProfile}
        />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
