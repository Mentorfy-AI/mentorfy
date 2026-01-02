"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, MessageCircle } from "lucide-react"
import { formatBotName } from "@/lib/utils"

interface MentorBot {
  id: string
  name: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  metadata?: any
}

interface Conversation {
  id: string
  clerk_user_id: string | null
  clerk_org_id: string
  mentor_bot_id: string
  updated_at: string
  created_at: string
  platform?: string
  platform_user_name?: string | null
  message_count?: number
  metadata: any
  mentor_bot?: MentorBot
  // Enriched from Clerk API (not stored in Supabase) or platform_user_name for Slack
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  full_name?: string
  initials?: string
}

interface ConversationsListProps {
  initialConversations: Conversation[]
}

export function ConversationsList({ initialConversations }: ConversationsListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    initialConversations[0]?.id || null
  )
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  useEffect(() => {
    async function loadMessages() {
      if (!selectedConversation) {
        setSelectedMessages([])
        return
      }

      setIsLoadingMessages(true)
      try {
        const response = await fetch(`/api/conversations/${selectedConversation}/messages`)
        const data = await response.json()

        if (data.success) {
          setSelectedMessages(data.messages || [])
        } else {
          console.error('Failed to load messages:', data.error)
          setSelectedMessages([])
        }
      } catch (error) {
        console.error('Failed to load messages:', error)
        setSelectedMessages([])
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [selectedConversation])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}min ago`
    if (diffHours < 24) return `${diffHours}hr ago`
    return `${diffDays}d ago`
  }

  const getInitials = (conversation: Conversation) => {
    // Use pre-computed initials from enrichment, or fallback
    return conversation.initials || "??"
  }

  const getFullName = (conversation: Conversation) => {
    // Use pre-computed full_name from enrichment, or fallback
    return conversation.full_name || "Unknown User"
  }


  const filteredConversations = initialConversations
    .filter((conv) => {
      if (!searchQuery) return true

      const searchLower = searchQuery.toLowerCase()
      const fullName = getFullName(conv).toLowerCase()
      const firstName = conv.first_name?.toLowerCase() || ''
      const lastName = conv.last_name?.toLowerCase() || ''
      const email = conv.email?.toLowerCase() || ''
      const platformUserName = conv.platform_user_name?.toLowerCase() || ''

      return (
        fullName.includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        email.includes(searchLower) ||
        platformUserName.includes(searchLower) ||
        conv.mentor_bot?.name?.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const selectedConversationData = initialConversations.find((c) => c.id === selectedConversation)

  return (
    <div className="flex h-full overflow-hidden bg-card border rounded-lg">
      {/* Conversations sidebar */}
      <div className="w-full lg:w-72 lg:border-r bg-muted/30 flex flex-col overflow-hidden">
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 h-0">
          <div className="p-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => {
                    // On mobile, navigate to detail page
                    if (window.innerWidth < 1024) {
                      router.push(`/conversations/${conversation.id}`)
                    } else {
                      setSelectedConversation(conversation.id)
                    }
                  }}
                  className={`flex items-center gap-3 p-3 mx-2 mb-1 rounded-lg cursor-pointer transition-all hover:bg-background/80 ${
                    selectedConversation === conversation.id
                      ? "lg:bg-background lg:shadow-sm lg:border lg:border-border/50"
                      : ""
                  }`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">{getInitials(conversation)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm truncate">{getFullName(conversation)}</h4>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTimestamp(conversation.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{formatBotName(conversation.mentor_bot?.name)}</span>
                      <span>•</span>
                      {conversation.platform === 'slack' ? (
                        <span className="text-purple-600 dark:text-purple-400">Slack</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Web</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Conversation view - hidden on mobile */}
        <div className="hidden lg:flex flex-1 flex-col bg-background overflow-hidden">
          {selectedConversationData ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-8">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Loading messages...</p>
                  </div>
                ) : selectedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No messages in this conversation</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {selectedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] p-4 rounded-2xl ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <p
                            className={`text-xs mt-2 ${
                              message.role === "user"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </ScrollArea>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-4">
                <MessageCircle className="h-16 w-16 mx-auto opacity-30" />
                <div>
                  <h3 className="font-medium text-lg">No conversations</h3>
                  <p className="text-sm">Start by selecting a conversation from the list</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  )
}
