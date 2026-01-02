import type React from 'react';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Mentorfy Chat',
  description: 'AI-powered chat interface',
  generator: 'v0.app',
};

export default function MentorChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
