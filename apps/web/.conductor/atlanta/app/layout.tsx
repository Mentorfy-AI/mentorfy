import type React from 'react';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Analytics } from '@vercel/analytics/next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Mentorfy - AI-Powered Mentorship Platform',
  description: 'Scale 1-on-1 mentorship with AI to change lives',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignInUrl="/"
      afterSignUpUrl="/"
      appearance={{
        variables: {
          colorBackground: 'hsl(var(--background))',
          colorText: 'hsl(var(--foreground))',
          colorPrimary: 'hsl(var(--primary))',
          colorTextOnPrimaryBackground: 'hsl(var(--primary-foreground))',
          colorInputBackground: 'hsl(var(--background))',
          colorInputText: 'hsl(var(--foreground))',
          colorTextSecondary: 'hsl(var(--muted-foreground))',
          colorNeutral: 'hsl(var(--foreground))',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
