import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function RootPage() {
  const { userId, orgId, orgRole } = await auth()

  // Not signed in → sign-in page
  if (!userId) {
    redirect('/sign-in')
  }

  // Signed in but no org → no-organization page
  if (!orgId) {
    redirect('/no-organization')
  }

  // Students → chat
  if (orgRole === 'org:student') {
    redirect('/chat')
  }

  // Everyone else (org:admin, org:team_member) → dashboard
  redirect('/dashboard')
}
