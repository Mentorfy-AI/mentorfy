import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: 'bg-brand-600 hover:bg-brand-700',
            footerAction: 'hidden', // Hide the sign-up link
          }
        }}
      />
    </div>
  )
}
