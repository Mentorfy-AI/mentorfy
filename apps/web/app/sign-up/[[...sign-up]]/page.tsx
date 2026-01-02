import { SignUp } from '@clerk/nextjs'

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { __clerk_ticket?: string }
}) {
  // Check if user has an invitation ticket from Clerk
  // Invitation links include __clerk_ticket parameter
  const hasInvite = searchParams?.__clerk_ticket

  // If no invitation ticket, redirect to sign-in
  // Sign-ups only allowed via:
  // 1. Email invitations (has __clerk_ticket)
  // 2. Form submissions with SMS verification (different flow, doesn't use /sign-up)
  if (!hasInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation Required</h1>
          <p className="text-muted-foreground">
            Sign-ups are invite-only. Please contact your organization administrator for an invitation link.
          </p>
          <a
            href="/sign-in"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Return to Sign In
          </a>
        </div>
      </div>
    )
  }

  // User has valid invitation - show sign-up form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp />
    </div>
  )
}
