'use client';

import { useState, useEffect } from 'react';
import { Menu, Plus, MessageSquare, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import {
  useClerk,
  useUser,
  useOrganization,
  OrganizationSwitcher,
  UserButton,
} from '@clerk/nextjs';
import Image from 'next/image';

interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: string;
  last_message_at?: string;
  created_at?: string;
  mentor_bot: {
    id: string;
  };
}

interface HamburgerMenuProps {
  /** User's display name */
  userName?: string;
  /** URL for user's avatar image */
  userAvatar?: string;
  /** User's initials for avatar fallback */
  userInitials?: string;
  /** Callback for starting a new chat */
  onNewChat?: () => void;
  /** External control of open state (for mobile) */
  isOpen?: boolean;
  /** Callback when open state changes (for mobile) */
  onOpenChange?: (open: boolean) => void;
  /** Hide the trigger button (for mobile where parent controls trigger) */
  hideTrigger?: boolean;
}

/**
 * Hamburger menu component that provides navigation and chat history
 * Features: New chat creation, chat history, mentor memory access, and account management
 */
export function HamburgerMenu({
  userName,
  userAvatar,
  userInitials,
  onNewChat,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  hideTrigger = false,
}: HamburgerMenuProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [displayedChats, setDisplayedChats] = useState(20);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { organization } = useOrganization();

  // Get user info from Clerk or props
  const displayName = userName || user?.fullName || 'User';
  const displayAvatar = userAvatar || user?.imageUrl;
  const displayInitials =
    userInitials ||
    (user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName?.[0]?.toUpperCase() || 'U');

  // Trigger animation when sheet opens
  useEffect(() => {
    if (isOpen) {
      // Reset animation state
      setShouldAnimate(false);
      // Trigger animation after a brief delay to ensure component is mounted
      const timer = setTimeout(() => {
        setShouldAnimate(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setShouldAnimate(false);
    }
  }, [isOpen]);

  // Fetch conversation history
  useEffect(() => {
    async function fetchConversations() {
      try {
        setIsLoadingHistory(true);
        const response = await fetch('/api/conversations');
        const data = await response.json();
        if (data.success && data.conversations) {
          const formattedHistory = data.conversations.map((conv: any) => ({
            id: conv.id,
            title: conv.title || 'Untitled conversation',
            timestamp: formatTimestamp(conv.last_message_at || conv.created_at),
            last_message_at: conv.last_message_at,
            created_at: conv.created_at,
            mentor_bot: conv.mentor_bot,
          }));
          setChatHistory(formattedHistory);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  const handleLoadMore = () => {
    setDisplayedChats((prev) => prev + 20);
  };

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  const handleChatSelect = (chat: ChatHistoryItem) => {
    router.push(`/chat/${chat.id}`);
    setIsOpen(false);
  };

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    }
    setIsOpen(false);
  };

  const handleMentorMemoryClick = () => {
    router.push('/user-memory');
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/sign-in' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setIsOpen(false);
  };

  const handleProfileClick = () => {
    router.push('/user-memory');
    setIsOpen(false);
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      {!hideTrigger && (
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="fixed top-6 left-6 rounded-full w-12 h-12 p-0 hover:bg-accent z-10 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </SheetTrigger>
      )}

      <SheetContent
        side="left"
        className="w-72 p-0 flex flex-col"
      >
        {/* Header - Fixed */}
        <SheetHeader className="shrink-0 p-0 mx-2">
          <SheetTitle className="text-left text-xl font-semibold">
            <div className="flex h-16 shrink-0 items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                  <Image
                    src="/icons/logo-dark.svg"
                    alt="Mentorfy"
                    width={32}
                    height={32}
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-mono">Mentorfy</h1>
                </div>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* New Chat Section - Fixed */}
        <div className="px-2 shrink-0">
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-3 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            <Plus className="w-4 h-4" />
            Start New Chat
          </Button>
        </div>

        {/* Memory Section - Fixed */}
        <div className="px-2 shrink-0">
          <button
            onClick={handleMentorMemoryClick}
            className="w-full bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:bg-accent/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm hover:shadow-md"
          >
            {/* Header with icon and title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-medium text-foreground">Memory</h4>
                <p className="text-xs text-muted-foreground">
                  View your memory
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* <Separator className="shrink-0" /> */}

        {/* Chat History Section - Scrollable */}
        <h3 className="text-sm font-medium text-muted-foreground pl-2 uppercase tracking-wide">
          Recent Chats
        </h3>
        <Separator className="shrink-0" />
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-0">
          <div className="space-y-2">
            {chatHistory.slice(0, displayedChats).map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleChatSelect(chat)}
                className="w-full text-left rounded-lg hover:bg-accent/50 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-foreground">
                      {chat.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {chat.timestamp}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {chatHistory.length > displayedChats && (
              <Button
                onClick={handleLoadMore}
                variant="ghost"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Load more ({chatHistory.length - displayedChats} remaining)
              </Button>
            )}
          </div>
        </div>

        {/* Account Section - Fixed at Bottom */}
        <div className="border-t pt-4 space-y-3 mt-auto">
          {/* Organization Switcher */}
          <OrganizationSwitcher
            hidePersonal={true}
            appearance={{
              elements: {
                organizationSwitcherPopoverCard:
                  'bg-popover/100 backdrop-blur-none',
              },
            }}
          />

          {/* User Button */}
          <div className="flex items-center gap-3 p-3 border rounded-md border-border">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-10 h-10',
                  userButtonPopoverCard: {
                    pointerEvents: 'initial',
                    background: 'white',
                  },
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">Manage profile</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
