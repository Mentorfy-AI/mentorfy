'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { MentorPromptBox } from '@/components/mentor-prompt-box';
import { ProfileCard } from '@/components/profile-card';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserMemory } from '@/hooks/use-user-memory';
import { useUser } from '@clerk/nextjs';
import { getLevelThreshold } from '@/lib/gamification';

/**
 * New chat landing page
 * Shows profile card and bot selector for starting a new conversation
 * Navigates to /chat/[conversationId] after first message is sent
 */
export default function NewChatPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState<{ display_name: string; description: string; avatar_url: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { level, wordsToNextLevel, memory } = useUserMemory();
  const { user } = useUser();

  // Get user info from Clerk
  const displayName = user?.fullName || user?.firstName || "User";
  const displayInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.[0]?.toUpperCase() || "U";
  const displayAvatar = user?.imageUrl;

  // Calculate progress percentage for current level
  const currentLevelThreshold = getLevelThreshold(level);
  const nextLevelThreshold = level < 8 ? getLevelThreshold((level + 1) as any) : null;
  const wordsInCurrentLevel = (memory?.wordCount ?? 0) - currentLevelThreshold;
  const wordsNeededForLevel = nextLevelThreshold ? nextLevelThreshold - currentLevelThreshold : 1;
  const progressPercent = nextLevelThreshold
    ? Math.min(1, Math.max(0, wordsInCurrentLevel / wordsNeededForLevel))
    : 1;

  // Read botId from URL query params on mount
  useEffect(() => {
    const botIdParam = searchParams.get('botId');
    if (botIdParam) {
      setSelectedBotId(botIdParam);
    }
  }, [searchParams]);

  // Fetch bot details when bot is selected
  useEffect(() => {
    if (!selectedBotId) {
      setSelectedBot(null);
      return;
    }

    async function fetchBotDetails() {
      try {
        const response = await fetch(`/api/agents/${selectedBotId}`);
        const data = await response.json();

        if (data.success && data.agent) {
          setSelectedBot({
            display_name: data.agent.display_name,
            description: data.agent.description,
            avatar_url: data.agent.avatar_url
          });
        }
      } catch (error) {
        console.error('Error fetching bot details:', error);
      }
    }

    fetchBotDetails();
  }, [selectedBotId]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    setIsDarkMode(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleMessageSubmit = useCallback(async (message: string, botId?: string, file?: File) => {
    const finalBotId = botId || selectedBotId;

    if (!finalBotId) {
      // TODO: Show error toast or validation message
      console.error('Please select an agent before sending a message');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create conversation WITH first message atomically
      // This prevents empty conversations from being created
      // Note: FormData is used to support file uploads
      const formData = new FormData();
      formData.append('botId', finalBotId);
      formData.append('firstMessage', message);
      formData.append('title', message.slice(0, 50));
      if (file) {
        formData.append('file', file);
      }

      const startResponse = await fetch('/api/conversations/start', {
        method: 'POST',
        body: formData,
      });

      const startData = await startResponse.json();
      if (!startData.success) {
        throw new Error(startData.error || 'Failed to create conversation');
      }

      const conversationId = startData.conversation.id;

      // Store conversation state for instant loading (skip loading screen)
      const conversationState = {
        conversation: {
          id: startData.conversation.id,
          mentor_bot_id: startData.conversation.mentor_bot_id,
          title: startData.conversation.title,
          mentor_bot: selectedBot ? {
            display_name: selectedBot.display_name,
            avatar_url: selectedBot.avatar_url
          } : null
        },
        messages: [startData.message],
        fileId: startData.fileId,
        fileType: startData.fileType,
        fileBase64: startData.fileBase64
      };
      sessionStorage.setItem(`conv_${conversationId}`, JSON.stringify(conversationState));

      // Navigate to conversation page - it will auto-stream the assistant response
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      setIsSubmitting(false);
      // TODO: Show error toast to user
    }
  }, [selectedBotId, router]);

  const handleBotSelect = useCallback((botId: string | null) => {
    setSelectedBotId(botId);
  }, []);

  const handleMemoryNavigation = useCallback(() => {
    router.push('/user-memory');
  }, [router]);

  const handleNewChat = useCallback(() => {
    // Already on new chat page, just reset state
    setSelectedBotId(null);
    setSelectedBot(null);
  }, []);

  // Determine what to show in ProfileCard
  const profileDisplayName = selectedBot?.display_name || "Select Your Mentor";
  const profileBio = selectedBot?.description || "Choose an agent below to start your conversation";
  const profileInitials = selectedBot
    ? selectedBot.display_name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
    : "?";
  const profileAvatar = selectedBot?.avatar_url || undefined;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <HamburgerMenu
        onNewChat={handleNewChat}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Mobile Layout */}
      <div className="md:hidden min-h-screen flex flex-col">
        <div className="flex-1">
          <ProfileCard
            name={profileDisplayName}
            bio={profileBio}
            avatarFallback={profileInitials}
            avatarSrc={profileAvatar}
            level={level}
            progress={progressPercent}
            wordsToLevelUp={wordsToNextLevel ?? 0}
            isMobile
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 pb-6">
          <MentorPromptBox
            onSubmit={handleMessageSubmit}
            selectedBotId={selectedBotId || undefined}
            onBotSelect={handleBotSelect}
            isReadOnly={false}
            isSubmitting={isSubmitting}
          />
          <footer className="text-center text-muted-foreground/80 text-balance text-xs mt-3">
            By messaging, you agree to our{' '}
            <a
              href="#"
              className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Terms
            </a>{' '}
            and{' '}
            <a
              href="#"
              className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Privacy Policy
            </a>
            .
          </footer>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-screen flex-col items-center px-6">
        <div className="flex flex-col items-center max-w-4xl w-full pt-10">
          <ProfileCard
            name={profileDisplayName}
            bio={profileBio}
            avatarFallback={profileInitials}
            avatarSrc={profileAvatar}
            level={level}
            progress={progressPercent}
            wordsToLevelUp={wordsToNextLevel ?? 0}
          />

          <div className="w-full max-w-3xl mt-12">
            <div className="px-2">
              <MentorPromptBox
                onSubmit={handleMessageSubmit}
                selectedBotId={selectedBotId || undefined}
                onBotSelect={handleBotSelect}
                isReadOnly={false}
                isSubmitting={isSubmitting}
              />
            </div>
            <footer className="text-center text-muted-foreground/80 text-balance text-sm mt-4">
              By messaging, you agree to our{' '}
              <a
                href="#"
                className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href="#"
                className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Privacy Policy
              </a>
              .
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
