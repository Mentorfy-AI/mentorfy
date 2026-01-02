import type React from 'react';
import type { Metadata } from 'next';
import { MentorNavigation } from '@/components/mentor-navigation';

export const metadata: Metadata = {
  title: 'Mentorfy',
  description: 'Scale 1-on-1 mentorship with AI to change lives',
};

export default function MentorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MentorNavigation>{children}</MentorNavigation>;
}
