'use client';

import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NoOrganizationPage() {
  const { signOut } = useClerk();
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-6 p-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            No Organization Access
          </h1>
          <p className="text-muted-foreground mb-4">
            You are not currently a member of any organization.
          </p>
          <p className="text-sm text-muted-foreground">
            To access Mentorfy, you need to be invited to an organization by an administrator.
          </p>
        </div>

        <div className="pt-4 space-y-3">
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-left">
            <p className="font-medium mb-2">What you can do:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Contact your organization administrator for an invite</li>
              <li>Check your email for pending invitations</li>
              <li>Sign out and try a different account</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Link
              href="/"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              Go Home
            </Link>
            <button
              onClick={async () => {
                try {
                  await signOut();
                  router.push('/sign-in');
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
