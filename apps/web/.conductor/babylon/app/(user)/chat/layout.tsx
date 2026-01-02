import type React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Mentor AI Chat',
  description: 'AI-powered mentorship chat interface',
  generator: 'v0.app',
};

export default function MentorChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
