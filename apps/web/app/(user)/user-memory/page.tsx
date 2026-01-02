'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PenSquare, RefreshCw, Brain } from 'lucide-react';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@clerk/nextjs';
import { useSupermemoryProfile } from '@/hooks/use-supermemory-profile';

/**
 * User Memory page - displays memories from Supermemory
 * Shows static (long-term) and dynamic (recent) profile information
 */
export default function UserMemoryPage() {
  const router = useRouter();
  const { user } = useUser();
  const { profile, isLoading, error, refetch } = useSupermemoryProfile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Get user info from Clerk
  const displayName = user?.fullName || user?.firstName || 'User';
  const displayInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName?.[0]?.toUpperCase() || 'U';

  const hasStaticItems = profile?.static && profile.static.length > 0;
  const hasDynamicItems = profile?.dynamic && profile.dynamic.length > 0;
  const hasAnyMemories = hasStaticItems || hasDynamicItems;

  const handleNewChat = () => {
    router.push('/chat/new');
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Desktop Hamburger Menu */}
      <div className="hidden md:block">
        <HamburgerMenu
          userName={displayName}
          userInitials={displayInitials}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Mobile Sidebar - Controlled by parent state */}
      <div className="md:hidden">
        <HamburgerMenu
          userName={displayName}
          userInitials={displayInitials}
          onNewChat={handleNewChat}
          isOpen={isMobileSidebarOpen}
          onOpenChange={setIsMobileSidebarOpen}
          hideTrigger={true}
        />
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden min-h-screen flex flex-col">
        {/* Mobile Top Bar */}
        <div className="sticky top-0 z-30 border-b border-border backdrop-blur-md bg-gradient-to-b from-background via-background/95 to-transparent">
          <div className="flex items-center justify-between py-6 px-6">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <svg
                className="w-6 h-6 text-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Page Title with Icon */}
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <h2 className="font-primary font-bold text-foreground text-lg">
                Your Memory
              </h2>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="p-2 -mr-2 hover:bg-accent rounded-lg transition-colors"
              aria-label="Start new chat"
            >
              <PenSquare className="w-6 h-6 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-6">
          <p className="text-sm text-muted-foreground mb-6">
            Your accumulated memories from conversations
          </p>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-card border border-destructive rounded-lg p-6">
              <div className="text-center py-8">
                <p className="text-lg font-medium text-destructive mb-2">
                  Failed to load memories
                </p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !hasAnyMemories && (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="text-center py-12">
                <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium mb-2">No memories yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Start chatting with your mentor to build your memory!
                </p>
                <Button
                  onClick={handleNewChat}
                  variant="default"
                >
                  Start a Conversation
                </Button>
              </div>
            </div>
          )}

          {/* Profile Content */}
          {!isLoading && !error && hasAnyMemories && (
            <div className="space-y-6">
              {/* Static Profile Section */}
              {hasStaticItems && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">About You</h2>
                    <span className="text-xs text-muted-foreground">
                      {profile.static.length} item
                      {profile.static.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {profile.static.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-foreground leading-relaxed pl-4 border-l-2 border-blue-500"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dynamic Profile Section */}
              {hasDynamicItems && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Recent Context</h2>
                    <span className="text-xs text-muted-foreground">
                      {profile.dynamic.length} item
                      {profile.dynamic.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {profile.dynamic.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-foreground leading-relaxed pl-4 border-l-2 border-green-500"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        {/* New Chat Button - Fixed top right */}
        <div className="fixed top-6 right-6 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="rounded-full w-12 h-12 p-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Start new chat"
          >
            <PenSquare className="w-6 h-6 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </div>

        <div className="container max-w-4xl mx-auto px-4 py-8 md:px-6 md:py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Your Memory</h1>
            <p className="text-sm text-muted-foreground">
              Your accumulated memories from conversations
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-card border border-destructive rounded-lg p-6">
              <div className="text-center py-8">
                <p className="text-lg font-medium text-destructive mb-2">
                  Failed to load memories
                </p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !hasAnyMemories && (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="text-center py-12">
                <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium mb-2">No memories yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Start chatting with your mentor to build your memory!
                </p>
                <Button
                  onClick={handleNewChat}
                  variant="default"
                >
                  Start a Conversation
                </Button>
              </div>
            </div>
          )}

          {/* Profile Content */}
          {!isLoading && !error && hasAnyMemories && (
            <div className="space-y-6">
              {/* Static Profile Section */}
              {hasStaticItems && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                      Long-term Information
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {profile.static.length} item
                      {profile.static.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Information that remains relevant over time
                  </p>
                  <ul className="space-y-2">
                    {profile.static.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-foreground leading-relaxed pl-4 border-l-2 border-blue-500"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dynamic Profile Section */}
              {hasDynamicItems && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Recent Context</h2>
                    <span className="text-xs text-muted-foreground">
                      {profile.dynamic.length} item
                      {profile.dynamic.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Recent memories from conversations
                  </p>
                  <ul className="space-y-2">
                    {profile.dynamic.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-foreground leading-relaxed pl-4 border-l-2 border-green-500"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Refresh Button */}
              <div className="flex justify-center">
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Memories
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
