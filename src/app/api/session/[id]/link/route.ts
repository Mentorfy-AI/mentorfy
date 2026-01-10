import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/session/[id]/link - link session to authenticated user
export async function POST(_req: Request, context: RouteContext) {
  try {
    const { id: sessionId } = await context.params

    // Get authenticated user from Clerk session (don't trust client)
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Get the session to find its org ID
    const { data: session, error } = await db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const orgId = session.clerk_org_id // null for most sessions (auth not used)

    // 2. Update session with Clerk user ID
    await db
      .from('sessions')
      .update({
        clerk_user_id: clerkUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    // 3. Add user to the organization
    if (orgId) {
      const clerk = await clerkClient()

      try {
        await clerk.organizations.createOrganizationMembership({
          organizationId: orgId,
          userId: clerkUserId,
          role: 'org:member',
        })
      } catch (e: any) {
        // Ignore "already a member" errors
        const isAlreadyMember = e.errors?.some(
          (err: any) => err.code === 'already_a_member_in_organization'
        )
        if (!isAlreadyMember) throw e
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Link session error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
