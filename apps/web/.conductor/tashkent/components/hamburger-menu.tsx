"use client"

import { useState, useEffect } from "react"
import { Menu, Plus, MessageSquare, LogOut, Brain, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useClerk, useUser, useOrganization, OrganizationSwitcher } from "@clerk/nextjs"
import { useUserMemory } from "@/hooks/use-user-memory"
import { getLevelThreshold } from "@/lib/gamification"

interface ChatHistoryItem {
  id: string
  title: string
  timestamp: string
  last_message_at?: string
  created_at?: string
}

interface HamburgerMenuProps {
  /** User's display name */
  userName?: string
  /** URL for user's avatar image */
  userAvatar?: string
  /** User's initials for avatar fallback */
  userInitials?: string
  /** Callback for starting a new chat */
  onNewChat?: () => void
  /** Current dark mode state */
  isDarkMode?: boolean
  /** Callback for toggling theme */
  onToggleTheme?: () => void
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
  isDarkMode = true,
  onToggleTheme,
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [displayedChats, setDisplayedChats] = useState(20)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const router = useRouter()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { level, wordsToNextLevel, memory } = useUserMemory()

  // Get user info from Clerk or props
  const displayName = userName || user?.fullName || "User"
  const displayAvatar = userAvatar || user?.imageUrl
  const displayInitials = userInitials || (user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.[0]?.toUpperCase() || "U")

  // Calculate progress percentage for current level
  const currentLevelThreshold = getLevelThreshold(level)
  const nextLevelThreshold = level < 8 ? getLevelThreshold((level + 1) as any) : null
  const wordsInCurrentLevel = (memory?.wordCount ?? 0) - currentLevelThreshold
  const wordsNeededForLevel = nextLevelThreshold ? nextLevelThreshold - currentLevelThreshold : 1
  const progressPercent = nextLevelThreshold
    ? Math.min(100, Math.max(0, (wordsInCurrentLevel / wordsNeededForLevel) * 100))
    : 100

  // Fetch conversation history
  useEffect(() => {
    async function fetchConversations() {
      try {
        setIsLoadingHistory(true)
        const response = await fetch('/api/conversations')
        const data = await response.json()
        if (data.success && data.conversations) {
          const formattedHistory = data.conversations.map((conv: any) => ({
            id: conv.id,
            title: conv.title || 'Untitled conversation',
            timestamp: formatTimestamp(conv.last_message_at || conv.created_at),
            last_message_at: conv.last_message_at,
            created_at: conv.created_at,
          }))
          setChatHistory(formattedHistory)
        }
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    if (isOpen) {
      fetchConversations()
    }
  }, [isOpen])

  const handleLoadMore = () => {
    setDisplayedChats(prev => prev + 20)
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    const weeks = Math.floor(days / 7)

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const handleChatSelect = (chatId: string) => {
    router.push(`/chat/${chatId}`)
    setIsOpen(false)
  }

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat()
    }
    setIsOpen(false)
  }

  const handleMentorMemoryClick = () => {
    router.push("/user-memory")
    setIsOpen(false)
  }

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/sign-in' })
    } catch (error) {
      console.error('Error signing out:', error)
    }
    setIsOpen(false)
  }

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme()
    }
    setIsOpen(false)
  }

  const handleProfileClick = () => {
    router.push("/user-memory")
    setIsOpen(false)
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
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

      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-left text-xl font-semibold">Mentorfy</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* New Chat Section */}
          <div className="px-6 pb-4">
            <Button
              onClick={handleNewChat}
              className="w-full justify-start gap-3 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <Plus className="w-4 h-4" />
              Start New Chat
            </Button>
          </div>

          {/* Mentor Memory Section */}
          <div className="px-6 pb-4">
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
                  <h4 className="text-sm font-medium text-foreground">Mentor Memory</h4>
                  <p className="text-xs text-muted-foreground">
                    Level {level} • {wordsToNextLevel !== null ? 'Click to level up' : 'Max level'}
                  </p>
                </div>
              </div>

              {/* Progress bar section */}
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {wordsToNextLevel !== null
                    ? `${wordsToNextLevel.toLocaleString()} more words to level up to Level ${level + 1}`
                    : 'Maximum level reached!'}
                </p>
              </div>
            </button>
          </div>

          <Separator className="mx-6" />

          {/* Chat History Section */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Recent Chats</h3>
            <div className="space-y-2">
              {chatHistory.slice(0, displayedChats).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleChatSelect(chat.id)}
                  className="w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-foreground">
                        {chat.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{chat.timestamp}</p>
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

          <Separator className="mx-6" />

          {/* Account Section */}
          <div className="p-6 pt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">Account</h3>

            {/* User Profile Display */}
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 mb-4 w-full hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="w-10 h-10">
                {displayAvatar ? (
                  <img
                    src={displayAvatar || "/placeholder.svg"}
                    alt={`${displayName}'s avatar`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">{displayInitials}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    Level {level}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {organization?.name || 'No organization'}
                </p>
              </div>
            </button>

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

            {/* Account Actions */}
            <div className="space-y-1">
              {/* Theme Toggle Button */}
              <Button
                variant="ghost"
                onClick={handleToggleTheme}
                className="w-full justify-start gap-3 h-10 text-muted-foreground hover:text-foreground"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </Button>

              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-3 h-10 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
