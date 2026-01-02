"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Users, MessageCircle, ExternalLink } from "lucide-react"

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
  const [sortBy, setSortBy] = useState("recent")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
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
      const searchLower = searchQuery.toLowerCase()
      const fullName = getFullName(conv).toLowerCase()
      const email = conv.email?.toLowerCase() || ''

      // Search filter
      const matchesSearch = (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        conv.mentor_bot?.name?.toLowerCase().includes(searchLower) ||
        false
      )

      // Platform filter
      if (platformFilter !== "all") {
        const platform = conv.platform || "web"
        if (platform !== platformFilter) return false
      }

      return matchesSearch
    })
    .sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
      return 0
    })

  const selectedConversationData = initialConversations.find((c) => c.id === selectedConversation)

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredConversations.length} conversations</span>
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="web">Web Only</SelectItem>
              <SelectItem value="slack">Slack Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex h-[calc(100vh-16rem)] border rounded-lg overflow-hidden bg-card">
        {/* Conversations sidebar */}
        <div className="w-80 border-r bg-muted/30 flex flex-col overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`flex items-start gap-3 p-3 mx-2 mb-1 rounded-lg cursor-pointer transition-all hover:bg-background/80 ${
                    selectedConversation === conversation.id
                      ? "bg-background shadow-sm border border-border/50"
                      : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(conversation)}</AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm truncate">{getFullName(conversation)}</h4>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTimestamp(conversation.updated_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.mentor_bot?.name || "Unknown bot"}
                      </p>
                      {conversation.platform === 'slack' ? (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded flex-shrink-0">
                          Slack
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded flex-shrink-0">
                          Web
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <MessageCircle className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {conversation.message_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Conversation view */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {selectedConversationData ? (
            <>
              {/* Header */}
              <div className="flex-shrink-0 border-b p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>{getInitials(selectedConversationData)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold">{getFullName(selectedConversationData)}</h2>
                        {selectedConversationData.clerk_user_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/users/${selectedConversationData.clerk_user_id}`)}
                            title="View User Profile"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{selectedConversationData.email || 'No email'}</span>
                        <span>•</span>
                        <span>{selectedMessages.length} messages</span>
                        <span>•</span>
                        <span>Bot: {selectedConversationData.mentor_bot?.name}</span>
                        <span>•</span>
                        {selectedConversationData.platform === 'slack' ? (
                          <span className="text-purple-600 dark:text-purple-400">Slack</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">Web</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-6">
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
                  <div className="space-y-6">
                    {selectedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${
                            message.role === "user"
                              ? "bg-muted text-foreground border border-border"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <p
                            className={`text-xs mt-2 ${
                              message.role === "user"
                                ? "text-muted-foreground"
                                : "text-primary-foreground/70"
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
    </>
  )
}
