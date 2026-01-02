'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PenSquare, Loader2 } from 'lucide-react';
import { MentorPromptBox } from '@/components/mentor-prompt-box';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { StreamingChatMessage } from '@/components/streaming-chat-message';
import { useStreamingChat } from '@/hooks/use-streaming-chat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

interface ConversationPageProps {
  params: {
    conversationId: string;
  };
}

/**
 * Conversation-specific chat page with streaming support
 * Loads and displays an existing conversation with real-time message streaming
 * Bot is locked to the conversation's mentor_bot_id
 */
export default function ConversationPage({ params }: ConversationPageProps) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [conversation, setConversation] = useState<any>(null);
  const [botInfo, setBotInfo] = useState<{ display_name: string; avatar_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const pendingMessageRef = useRef<string | null>(null);
  const pendingFileIdRef = useRef<string | null>(null); // Store fileId for auto-stream (documents)
  const pendingFileTypeRef = useRef<string | null>(null); // Store fileType for auto-stream
  const pendingFileNameRef = useRef<string | null>(null); // Store fileName for display
  const pendingFileBase64Ref = useRef<string | null>(null); // Store fileBase64 for auto-stream (images)
  const hasAutoSentRef = useRef<boolean>(false);

  // Get user info from Clerk
  const displayName = user?.fullName || user?.firstName || "User";
  const displayInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.[0]?.toUpperCase() || "U";

  // Load conversation details
  useEffect(() => {
    async function loadConversation() {
      try {
        // Try to load from sessionStorage first (instant - no loading screen!)
        const cachedStateJson = sessionStorage.getItem(`conv_${params.conversationId}`);
        let conversationData: any = null;
        let messagesData: any = null;
        let fileIdParam: string | null = null;
        let fileTypeParam: string | null = null;
        let fileNameParam: string | null = null;
        let fileBase64Param: string | null = null;

        if (cachedStateJson) {
          console.log('[CONVERSATION] Using cached state for instant load');
          const cachedState = JSON.parse(cachedStateJson);
          conversationData = { success: true, conversation: cachedState.conversation };
          messagesData = { success: true, messages: cachedState.messages };
          fileIdParam = cachedState.fileId || null;
          fileTypeParam = cachedState.fileType || null;
          fileNameParam = cachedState.fileName || null;
          fileBase64Param = cachedState.fileBase64 || null;

          // Clean up cache after use
          sessionStorage.removeItem(`conv_${params.conversationId}`);

          // Skip loading state entirely!
        } else {
          console.log('[CONVERSATION] No cache found, fetching from API');
          setIsLoading(true);

          // Fetch conversation details
          const conversationResponse = await fetch(`/api/conversations/${params.conversationId}`);
          conversationData = await conversationResponse.json();

          if (!conversationData.success) {
            throw new Error(conversationData.error || 'Failed to load conversation');
          }

          // Fetch messages
          const messagesResponse = await fetch(`/api/conversations/${params.conversationId}/messages`);
          messagesData = await messagesResponse.json();

          if (!messagesData.success) {
            throw new Error(messagesData.error || 'Failed to load messages');
          }
        }

        // Set file info for auto-stream
        if (fileIdParam || fileBase64Param) {
          console.log('[CONVERSATION] File detected - fileId:', fileIdParam, 'fileBase64:', fileBase64Param ? 'present' : 'none', 'type:', fileTypeParam, 'name:', fileNameParam);
          pendingFileIdRef.current = fileIdParam;
          pendingFileTypeRef.current = fileTypeParam;
          pendingFileNameRef.current = fileNameParam;
          pendingFileBase64Ref.current = fileBase64Param;
        }

        const conv = {
          id: conversationData.conversation.id,
          botId: conversationData.conversation.mentor_bot_id,
          title: conversationData.conversation.title,
        };

        // Extract bot info from the joined mentor_bot data
        const mentorBot = conversationData.conversation.mentor_bot;
        if (mentorBot) {
          setBotInfo({
            display_name: mentorBot.display_name || 'AI',
            avatar_url: mentorBot.avatar_url || ''
          });
        }

        const initialMessages = messagesData.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.created_at),
          fileId: msg.metadata?.fileId,
          fileType: msg.metadata?.fileType,
          fileName: msg.metadata?.fileName,
          fileBase64: msg.metadata?.fileBase64,
        }));

        // Check if this is a brand new conversation with only 1 user message
        // This means we need to auto-stream the assistant response
        let messagesToShow = initialMessages;
        if (initialMessages.length === 1 && initialMessages[0].role === 'user') {
          pendingMessageRef.current = initialMessages[0].content;
          // Don't show the user message in initialMessages - sendMessage will add it
          // This prevents duplication when auto-streaming
          messagesToShow = [];
        }

        setConversation(conv);
        initializeChat(conv.id, conv.botId, messagesToShow);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
        setIsLoading(false);
      }
    }

    if (params.conversationId) {
      loadConversation();
    }
  }, [params.conversationId]);

  // Initialize streaming chat after conversation loads
  const [chatInitialized, setChatInitialized] = useState(false);
  const [chatState, setChatState] = useState<any>(null);

  function initializeChat(conversationId: string, botId: string, initialMessages: any[]) {
    setChatState({ conversationId, botId, initialMessages });
    setChatInitialized(true);
  }

  // Use streaming chat hook
  const streamingChat = useStreamingChat(
    chatInitialized
      ? {
          conversationId: chatState.conversationId,
          botId: chatState.botId,
          initialMessages: chatState.initialMessages,
          onError: (err) => setError(err),
        }
      : {
          conversationId: '',
          botId: '',
          initialMessages: [],
        }
  );

  // Auto-stream assistant response for new conversations
  // When a conversation has only 1 user message, we need to get the AI response
  useEffect(() => {
    if (chatInitialized && pendingMessageRef.current && !streamingChat.isStreaming && !hasAutoSentRef.current) {
      console.log('[AUTO-STREAM] Triggering auto-stream for pending message:', pendingMessageRef.current, 'fileId:', pendingFileIdRef.current, 'fileBase64:', pendingFileBase64Ref.current ? 'present' : 'none', 'fileType:', pendingFileTypeRef.current, 'fileName:', pendingFileNameRef.current);
      const messageToStream = pendingMessageRef.current;
      const fileIdToSend = pendingFileIdRef.current;
      const fileTypeToSend = pendingFileTypeRef.current;
      const fileNameToSend = pendingFileNameRef.current;
      const fileBase64ToSend = pendingFileBase64Ref.current;
      pendingMessageRef.current = null;
      pendingFileIdRef.current = null;
      pendingFileTypeRef.current = null;
      pendingFileNameRef.current = null;
      pendingFileBase64Ref.current = null;
      hasAutoSentRef.current = true; // Mark as sent to prevent duplicate sends

      // The user message is already saved to DB and in initialMessages
      // We just need to trigger streaming the assistant response
      // For images: use fileBase64. For documents: use fileId
      // Create a temporary File object for base64 images if needed
      if (fileBase64ToSend && fileTypeToSend) {
        // Convert base64 back to File for sendMessage
        // This is a bit hacky but maintains compatibility with existing code
        const byteString = atob(fileBase64ToSend);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: fileTypeToSend });
        const file = new File([blob], fileNameToSend || 'image', { type: fileTypeToSend });
        streamingChat.sendMessage(messageToStream, file, undefined, undefined);
      } else if (fileIdToSend) {
        // Document with fileId
        streamingChat.sendMessage(messageToStream, undefined, fileIdToSend, fileTypeToSend || undefined);
      } else {
        // No file
        streamingChat.sendMessage(messageToStream);
      }
    } else {
      console.log('[AUTO-STREAM] Skipping auto-stream:', {
        chatInitialized,
        hasPendingMessage: !!pendingMessageRef.current,
        isStreaming: streamingChat.isStreaming,
        hasAutoSent: hasAutoSentRef.current
      });
    }
    // Only depend on chatInitialized to trigger once when chat is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatInitialized]);

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

  const handleNewChat = () => {
    router.push('/chat');
  };

  const handleMemoryNavigation = () => {
    router.push('/user-memory');
  };

  // Memoize the no-op callback to prevent re-renders
  const handleBotSelectNoOp = useCallback(() => {}, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || 'Conversation not found'}</p>
          <Button onClick={handleNewChat}>Start New Chat</Button>
        </div>
      </div>
    );
  }

  const botDisplayName = botInfo?.display_name || 'AI';
  const botInitials = botDisplayName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <HamburgerMenu
        userName={displayName}
        userInitials={displayInitials}
        onNewChat={handleNewChat}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Mobile Layout */}
      <div className="md:hidden min-h-screen flex flex-col">
        <div className="border-b border-border bg-background/95 backdrop-blur-sm">
          {/* Chat Header Mobile */}
          <div className="flex items-center p-4 pt-6">
            <div className="flex items-center gap-4 ml-20">
              <button
                onClick={handleMemoryNavigation}
                className="relative hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              >
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-blue-500 text-white font-semibold text-lg">
                    {botInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full"></div>
              </button>
              <div>
                <h2 className="font-semibold text-foreground text-lg">
                  {botDisplayName}
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-green-500 font-medium">online now</p>
                  <span className="text-sm text-muted-foreground">|</span>
                  <button
                    onClick={handleMemoryNavigation}
                    className="text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    memory active
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          {streamingChat.messages.length === 0 && !streamingChat.isStreaming && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p className="text-lg mb-2">Start a conversation</p>
                <p className="text-sm">
                  Ask me anything you'd like to discuss!
                </p>
              </div>
            </div>
          )}

          {streamingChat.messages.map((message) => (
            <StreamingChatMessage
              key={message.id}
              message={message}
              userInitials="BB"
              botInitials={botInitials}
              isProcessing={
                message.role === "assistant" &&
                message.id === streamingChat.messages[streamingChat.messages.length - 1]?.id &&
                streamingChat.isStreaming
              }
            />
          ))}

          {/* Tool status indicator */}
          {streamingChat.toolStatus && (
            <div className="flex gap-3 items-center text-sm text-muted-foreground italic">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              </div>
              <span>{streamingChat.toolStatus}</span>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 pb-6">
          <MentorPromptBox
            onSubmit={streamingChat.sendMessage}
            selectedBotId={conversation.botId}
            onBotSelect={handleBotSelectNoOp}
            isReadOnly={true}
          />
          <footer className="text-center text-muted-foreground/80 text-balance text-xs mt-3">
            By messaging, you agree to our{' '}
            <a href="#" className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
              Terms
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
              Privacy Policy
            </a>
            .
          </footer>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-screen flex-col items-center px-6">
        <div className="flex flex-col max-w-3xl w-full min-h-[calc(100vh-5rem)]">
          {/* Chat Header Desktop */}
          <div className="flex items-center mb-6 pt-10 px-6">
            <div className="flex items-center gap-4 ml-20">
              <button
                onClick={handleMemoryNavigation}
                className="relative hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              >
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-blue-500 text-white font-semibold text-lg">
                    {botInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full"></div>
              </button>
              <div>
                <h2 className="font-semibold text-foreground text-lg">
                  {botDisplayName}
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-green-500 font-medium">online now</p>
                  <span className="text-sm text-muted-foreground">|</span>
                  <button
                    onClick={handleMemoryNavigation}
                    className="text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    memory active
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 py-6">
            {streamingChat.messages.length === 0 && !streamingChat.isStreaming && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">Start a conversation</p>
                  <p className="text-sm">
                    Ask me anything you'd like to discuss!
                  </p>
                </div>
              </div>
            )}

            {streamingChat.messages.map((message) => (
              <StreamingChatMessage
                key={message.id}
                message={message}
                userInitials="BB"
                botInitials={botInitials}
                isProcessing={
                  message.role === "assistant" &&
                  message.id === streamingChat.messages[streamingChat.messages.length - 1]?.id &&
                  streamingChat.isStreaming
                }
              />
            ))}

            {/* Tool status indicator */}
            {streamingChat.toolStatus && (
              <div className="flex gap-3 items-center text-sm text-muted-foreground italic">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                </div>
                <span>{streamingChat.toolStatus}</span>
              </div>
            )}
          </div>

          <div className="w-full border-t border-border bg-background pt-4">
            <div className="px-2">
              <MentorPromptBox
                onSubmit={streamingChat.sendMessage}
                selectedBotId={conversation.botId}
                onBotSelect={handleBotSelectNoOp}
                isReadOnly={true}
              />
            </div>
            <footer className="text-center text-muted-foreground/80 text-balance text-sm mt-4">
              By messaging, you agree to our{' '}
              <a href="#" className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="underline hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                Privacy Policy
              </a>
              .
            </footer>
          </div>
        </div>
      </div>

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
    </div>
  );
}
