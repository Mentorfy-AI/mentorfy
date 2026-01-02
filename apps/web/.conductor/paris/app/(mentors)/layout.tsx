import type React from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { MentorNavigation } from '@/components/mentor-navigation';

export const metadata: Metadata = {
  title: 'Mentorfy - AI-Powered Mentorship Platform',
  description: 'Scale 1-on-1 mentorship with AI to change lives',
};

export default function MentorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Suspense fallback={<div>Loading...</div>}>
        <MentorNavigation>{children}</MentorNavigation>
      </Suspense>
    </ThemeProvider>
  );
}
