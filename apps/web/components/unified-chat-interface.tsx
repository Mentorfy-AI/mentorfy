'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { PenSquare } from 'lucide-react';
import { MentorPromptBox } from '@/components/mentor-prompt-box';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { StreamingChatMessage } from '@/components/streaming-chat-message';
import {
  useStreamingChat,
  StreamingChatMessage as Message,
} from '@/hooks/use-streaming-chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
interface Bot {
  id: string;
  display_name: string;
  description?: string;
  avatar_url: string;
}

interface BotInfo {
  id: string;
  display_name: string;
  avatar_url: string;
}

interface UnifiedChatInterfaceProps {
  // Bot information (required for both new and existing chats)
  botId: string;
  botInfo: BotInfo;

  // For existing conversations only
  conversationId?: string;
  initialMessages?: Message[];

  // For new chats only
  allBots?: Bot[];
  onBotSelect?: (botId: string) => void;

  // For form greeting flow
  needsFormGreeting?: boolean;
}

/**
 * Unified chat interface that handles BOTH new and existing conversations.
 * This component stays mounted when navigating from /chat/new to /chat/[conversationId],
 * allowing streaming to continue seamlessly across the URL change.
 */
export function UnifiedChatInterface({
  botId: initialBotId,
  botInfo: initialBotInfo,
  conversationId,
  initialMessages = [],
  allBots = [],
  onBotSelect,
  needsFormGreeting,
}: UnifiedChatInterfaceProps) {
  const router = useRouter();
  const { user } = useUser();
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  const [currentBotId, setCurrentBotId] = useState(initialBotId);
  const [currentBotInfo, setCurrentBotInfo] = useState(initialBotInfo);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Refs for scroll management
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Get user info from Clerk
  const displayName = user?.fullName || user?.firstName || 'User';
  const displayInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName?.[0]?.toUpperCase() || 'U';

  // Initialize streaming chat
  const streamingChat = useStreamingChat({
    conversationId: currentConversationId || 'temp',
    botId: currentBotId,
    initialMessages,
    needsFormGreeting,
    onError: (err) => setError(err),
    onConversationCreated: (convId) => {
      setCurrentConversationId(convId);
      // Use native History API to avoid Next.js remounting the component
      window.history.replaceState(null, '', `/chat/${convId}`);
    },
  });

  // Determine if this is a new chat (no conversation ID yet)
  const isNewChat = !currentConversationId;

  // For new chats, find the selected bot from allBots to get full info including description
  const selectedBot = allBots?.find((bot) => bot.id === currentBotId);
  const profileDisplayName = selectedBot?.display_name || 'Select Your Mentor';
  const profileBio =
    selectedBot?.description ||
    'Choose an agent below to start your conversation';
  const profileInitials = selectedBot
    ? selectedBot.display_name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';
  const profileAvatar = selectedBot?.avatar_url || undefined;

  // Auto-scroll to bottom when new messages arrive or streaming state changes
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [streamingChat.messages.length, streamingChat.isStreaming]);

  // Handle bot selection for new chats
  const handleBotSelect = useCallback(
    (selectedBotId: string | null) => {
      if (!selectedBotId) return;

      setCurrentBotId(selectedBotId);

      // Find bot info from allBots
      const selectedBot = allBots.find((b) => b.id === selectedBotId);
      if (selectedBot) {
        setCurrentBotInfo({
          id: selectedBot.id,
          display_name: selectedBot.display_name,
          avatar_url: selectedBot.avatar_url,
        });
      }

      if (onBotSelect) {
        onBotSelect(selectedBotId);
      }
    },
    [allBots, onBotSelect]
  );

  // No-op handler for existing conversations where bot selection is disabled
  const handleBotSelectNoOp = useCallback(() => {}, []);

  const handleMessageSubmit = useCallback(
    async (message: string, selectedBotId?: string, files?: any[]) => {
      console.log('[CHAT-INTERFACE] handleMessageSubmit called:', {
        message,
        selectedBotId,
        filesCount: files?.length,
      });

      const finalBotId = selectedBotId || currentBotId;

      if (!finalBotId) {
        console.error('[CHAT-INTERFACE] No bot selected, aborting');
        return;
      }

      setIsSubmitting(true);

      // The streaming hook handles everything:
      // - Creates conversation if needed (conversationId === 'temp')
      // - Saves user message
      // - Streams assistant response
      // - Saves assistant message
      // - Notifies us via onConversationCreated callback to update URL
      console.log('[CHAT-INTERFACE] Calling streamingChat.sendMessage');
      await streamingChat.sendMessage(message, files);

      setIsSubmitting(false);
      console.log('[CHAT-INTERFACE] Message submission complete');
    },
    [currentBotId, streamingChat]
  );

  const handleNewChat = useCallback(() => {
    // Hard navigate to fully reset all state
    window.location.href = '/chat/new';
  }, []);

  const botDisplayName = currentBotInfo.display_name;
  const botInitials = botDisplayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // NEW CHAT: Show ProfileCard UI
  if (isNewChat) {
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
          {/* Mobile Top Bar with Hamburger */}
          <div className="sticky top-0 z-30 border-b border-border backdrop-blur-md bg-gradient-to-b from-background via-background/95 to-transparent">
            <div className="flex items-center justify-between py-2 px-6">
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

              <h2 className="font-primary font-bold text-foreground text-lg">
                New Chat
              </h2>

              {/* Spacer to balance layout (no new chat button on /chat/new) */}
              <div className="w-10"></div>
            </div>
          </div>
          <div className="flex-1">
            <header className="flex flex-col items-center justify-start px-6 pt-4 pb-4">
              <div className="relative mb-4">
                <Avatar className="w-32 h-32 ring-2 ring-border/20 shadow-lg">
                  {profileAvatar ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={profileAvatar}
                        alt={`${profileDisplayName}'s profile picture`}
                        fill
                        className="object-cover"
                        priority
                      />
                    </div>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary/10 to-accent/10 text-foreground text-4xl font-medium">
                      {profileInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              <h1 className="font-primary font-bold text-center text-balance text-3xl">
                {profileDisplayName}
              </h1>
              <p className="text-muted-foreground text-sm mt-2 text-center italic">
                "{profileBio}"
              </p>
            </header>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm px-1 pb-1">
            <MentorPromptBox
              onSubmit={handleMessageSubmit}
              selectedBotId={currentBotId}
              onBotSelect={handleBotSelect}
              isReadOnly={false}
              isSubmitting={isSubmitting}
              allBots={allBots}
            />
            <footer className="text-center text-muted-foreground/80 text-balance text-xs mt-3">
              By messaging, you agree to our{' '}
              <a
                href="https://www.mentorfy.ai/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href="https://www.mentorfy.ai/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
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
            <header className="flex flex-col items-center justify-center text-center pb-4">
              <div className="relative mb-4">
                <Avatar className="w-32 h-32 ring-2 ring-border/20 shadow-lg">
                  {profileAvatar ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={profileAvatar}
                        alt={`${profileDisplayName}'s profile picture`}
                        fill
                        className="object-cover"
                        priority
                      />
                    </div>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary/10 to-accent/10 text-foreground text-4xl font-medium">
                      {profileInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              <h1 className="font-primary font-bold text-center text-balance text-4xl">
                {profileDisplayName}
              </h1>
              <p className="text-muted-foreground text-sm mt-2 text-center italic">
                "{profileBio}"
              </p>
            </header>

            <div className="w-full max-w-3xl mt-12">
              <div className="px-2">
                <MentorPromptBox
                  onSubmit={handleMessageSubmit}
                  selectedBotId={currentBotId}
                  onBotSelect={handleBotSelect}
                  isReadOnly={false}
                  isSubmitting={isSubmitting}
                  allBots={allBots}
                />
              </div>
              <footer className="text-center text-muted-foreground/80 text-balance text-sm mt-4">
                By messaging, you agree to our{' '}
                <a
                  href="https://www.mentorfy.ai/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  Terms
                </a>{' '}
                and{' '}
                <a
                  href="https://www.mentorfy.ai/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
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

  // EXISTING CONVERSATION: Show conversation UI
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

            {/* Bot Avatar and Name */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  {currentBotInfo.avatar_url && (
                    <AvatarImage
                      src={currentBotInfo.avatar_url}
                      alt={botDisplayName}
                    />
                  )}
                  <AvatarFallback className="bg-blue-500 text-white font-semibold text-lg">
                    {botInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-background rounded-full"></div>
              </div>
              <h2 className="font-primary font-bold text-foreground text-lg">
                {botDisplayName}
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

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 pb-32 flex flex-col min-h-0"
        >
          {streamingChat.messages.length === 0 &&
            !streamingChat.isStreaming && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">Start a conversation</p>
                  <p className="text-sm">
                    Ask me anything you'd like to discuss!
                  </p>
                </div>
              </div>
            )}

          {streamingChat.messages.length > 0 && (
            <div className="flex flex-col gap-4 justify-end min-h-full">
              {streamingChat.messages.map((message, index) => (
                <div key={message.id}>
                  <StreamingChatMessage
                    message={message}
                    userInitials={displayInitials}
                    botInitials={botInitials}
                    isProcessing={
                      message.role === 'assistant' &&
                      message.id ===
                        streamingChat.messages[
                          streamingChat.messages.length - 1
                        ]?.id &&
                      streamingChat.isStreaming
                    }
                    hasFirstToken={streamingChat.hasFirstToken}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <MentorPromptBox
              onSubmit={handleMessageSubmit}
              selectedBotId={currentBotId}
              onBotSelect={onBotSelect || handleBotSelectNoOp}
              isReadOnly={!isNewChat}
              isStreaming={streamingChat.isStreaming}
              onCancelStreaming={streamingChat.cancelStreaming}
              allBots={allBots}
            />
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-screen flex-col items-center px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewChat}
          className="fixed top-6 right-6 z-10 rounded-full w-12 h-12 p-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Start new chat"
        >
          <PenSquare className="w-6 h-6 text-muted-foreground hover:text-foreground transition-colors" />
        </Button>

        <div className="flex flex-col max-w-3xl w-full min-h-[calc(100vh-5rem)]">
          <div className="sticky top-0 z-10 flex items-center justify-center mb-6 px-6 py-6 backdrop-blur-md bg-gradient-to-b from-background via-background/95 to-transparent">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  {currentBotInfo.avatar_url && (
                    <AvatarImage
                      src={currentBotInfo.avatar_url}
                      alt={botDisplayName}
                    />
                  )}
                  <AvatarFallback className="bg-blue-500 text-white font-semibold text-lg">
                    {botInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-background rounded-full"></div>
              </div>
              <h2 className="font-primary font-bold text-foreground text-lg">
                {botDisplayName}
              </h2>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 pb-32 flex flex-col min-h-0"
          >
            {streamingChat.messages.length === 0 &&
              !streamingChat.isStreaming && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg mb-2">Start a conversation</p>
                    <p className="text-sm">
                      Ask me anything you'd like to discuss!
                    </p>
                  </div>
                </div>
              )}

            {streamingChat.messages.length > 0 && (
              <div className="flex flex-col gap-4 justify-end min-h-full">
                {streamingChat.messages.map((message, index) => (
                  <div key={message.id}>
                    <StreamingChatMessage
                      message={message}
                      userInitials={displayInitials}
                      botInitials={botInitials}
                      isProcessing={
                        message.role === 'assistant' &&
                        message.id ===
                          streamingChat.messages[
                            streamingChat.messages.length - 1
                          ]?.id &&
                        streamingChat.isStreaming
                      }
                      hasFirstToken={streamingChat.hasFirstToken}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 w-full p-4 pb-6 z-50 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto">
              <MentorPromptBox
                onSubmit={handleMessageSubmit}
                selectedBotId={currentBotId}
                onBotSelect={onBotSelect || handleBotSelectNoOp}
                isReadOnly={!isNewChat}
                isStreaming={streamingChat.isStreaming}
                onCancelStreaming={streamingChat.cancelStreaming}
                allBots={allBots}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
