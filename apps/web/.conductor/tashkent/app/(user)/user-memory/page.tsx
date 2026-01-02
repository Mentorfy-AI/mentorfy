'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PenSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { useUserMemory } from '@/hooks/use-user-memory';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@clerk/nextjs';

/**
 * Simplified Mentor Memory page displaying user's accumulated memory text
 */
export default function MentorMemoryPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { memory, level, wordsToNextLevel, isLoading, error, refetch } = useUserMemory();
  const { user } = useUser();

  // Get user info from Clerk
  const displayName = user?.fullName || user?.firstName || "User";
  const displayInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    setIsDarkMode(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <HamburgerMenu
        userName={displayName}
        userInitials={displayInitials}
        onNewChat={() => router.push('/chat')}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      <div className="fixed top-6 right-6 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/chat')}
          className="rounded-full w-12 h-12 p-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Start new chat"
        >
          <PenSquare className="w-6 h-6 text-muted-foreground hover:text-foreground transition-colors" />
        </Button>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-8 md:px-6 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Your Mentor Memory</h1>

          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-48" />
            </div>
          ) : (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-blue-500">
                Level {level}
              </span>
              <span>•</span>
              <span>
                {memory?.wordCount.toLocaleString() ?? 0} words
              </span>
              {wordsToNextLevel !== null && (
                <>
                  <span>•</span>
                  <span>
                    {wordsToNextLevel.toLocaleString()} words to Level {level + 1}
                  </span>
                </>
              )}
            </div>
          )}

          {memory?.updatedAt && !isLoading && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(memory.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Debug Button */}
        {process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true' && (
          <div className="mb-4">
            <Button
              onClick={async () => {
                try {
                  // Find unprocessed conversations
                  const conversationsRes = await fetch('/api/conversations');
                  const conversationsData = await conversationsRes.json();

                  if (!conversationsData.success || !conversationsData.conversations) {
                    alert('No conversations found');
                    return;
                  }

                  const unprocessed = conversationsData.conversations.filter((c: any) =>
                    !c.memory_processed_at || c.memory_processed_at < c.updated_at
                  );

                  if (unprocessed.length === 0) {
                    alert('No unprocessed conversations found');
                    return;
                  }

                  // Get user/org from first conversation
                  const firstConv = unprocessed[0];

                  // Process each conversation
                  const results = [];
                  for (const conv of unprocessed) {
                    const payload = {
                      user_id: conv.clerk_user_id,
                      org_id: conv.clerk_org_id,
                      conversation_id: conv.id,
                    };
                    console.log('Processing conversation:', conv.id, 'with payload:', payload);

                    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/memory/process`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });

                    const data = await res.json();
                    console.log('Response for conversation:', conv.id, data);
                    results.push({ convId: conv.id, success: data.success, wordsAdded: data.words_added, error: data.error });
                  }

                  console.log('All results:', results);
                  alert(`Processed ${unprocessed.length} conversation(s)!\n${JSON.stringify(results, null, 2)}`);

                  // Refetch memory instead of reload
                  await refetch();
                } catch (error) {
                  console.error('Debug process error:', error);
                  alert('Error processing memory');
                }
              }}
              variant="outline"
              size="sm"
            >
              🐛 Debug: Process Memory Now
            </Button>
          </div>
        )}

        {/* Memory Content */}
        <div className="bg-card border border-border rounded-lg p-6 min-h-[400px]">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          ) : error ? (
            <div className="text-destructive">
              <p className="font-medium">Error loading memory</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : !memory?.memoryText || memory.memoryText.trim() === '' ? (
            <div className="text-muted-foreground text-center py-12">
              <p className="text-lg font-medium mb-2">No memories yet</p>
              <p className="text-sm">
                Start chatting with your mentor to build your memory!
              </p>
              <Button
                onClick={() => router.push('/chat')}
                className="mt-4"
                variant="default"
              >
                Start a Conversation
              </Button>
            </div>
          ) : (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                {memory.memoryText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
