import { NextRequest, NextResponse } from 'next/server'
import { deleteUserProfile } from '@/lib/data/users'
import { getUserProfile } from '@/lib/data/users'
import { getConversations } from '@/lib/data/conversations'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * DELETE /api/users/[userId]
 * Deletes a user profile from the database
 *
 * Note: This only removes the user_profile record from Supabase.
 * Related data (conversations, messages) will be handled by database cascade rules.
 * To fully remove a user from Clerk, use Clerk's API separately.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete the user profile
    const deletedUser = await deleteUserProfile(userId)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      user: deletedUser,
    })
  } catch (error: any) {
    console.error('Error deleting user:', error)

    // Handle specific error cases
    if (error?.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params

    const [user, allConversations] = await Promise.all([
      getUserProfile(userId),
      getConversations(),
    ])

    // Filter conversations for this user
    const userConversations = allConversations.filter(
      (c) => c.clerk_user_id === userId
    )

    return NextResponse.json({
      success: true,
      user,
      conversations: userConversations,
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}
