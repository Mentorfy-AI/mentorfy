import type React from 'react';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import { testuale, neueHaas, inter, spaceGrotesk } from '@/lib/fonts';
import { PostHogProvider } from '@/app/providers';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Mentorfy',
  description: 'Scale 1-on-1 mentorship with AI to change lives',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/sign-in"
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
      <html
        lang="en"
        className={`${testuale.variable} ${neueHaas.variable} ${inter.variable} ${spaceGrotesk.variable} light`}
      >
        <body className="font-primary antialiased">
          <Script
            id="favicon-switcher"
            strategy="beforeInteractive"
          >
            {`
              (function() {
                const setFavicon = () => {
                  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const favicon = document.querySelector("link[rel='icon']") || document.createElement('link');
                  favicon.rel = 'icon';
                  favicon.href = isDark ? '/favicon-light.png' : '/favicon-dark.png';
                  if (!document.querySelector("link[rel='icon']")) {
                    document.head.appendChild(favicon);
                  }
                };
                setFavicon();
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setFavicon);
              })();
            `}
          </Script>
          <PostHogProvider>
            {children}
            <Analytics />
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
