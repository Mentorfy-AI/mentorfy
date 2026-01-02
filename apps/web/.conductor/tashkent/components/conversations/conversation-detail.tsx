"use client"

import { useRouter } from "next/navigation"
import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ExternalLink, MessageSquare } from "lucide-react"

interface Message {
  id: string
  role: string
  content: string
  created_at: string
  metadata: any
}

interface MentorBot {
  id: string
  name: string
}

interface Conversation {
  id: string
  clerk_user_id: string
  clerk_org_id: string
  mentor_bot_id: string
  updated_at: string
  created_at: string
  metadata: any
  mentor_bot?: MentorBot
  messages?: Message[]
  // Enriched from Clerk API (not stored in Supabase)
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  full_name?: string
  initials?: string
}

interface ConversationDetailProps {
  conversation: Conversation
}

export function ConversationDetail({ conversation }: ConversationDetailProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation.id])

  const getInitials = (conversation: Conversation) => {
    // Use pre-computed initials from enrichment, or fallback
    return conversation.initials || "??"
  }

  const getFullName = (conversation: Conversation) => {
    // Use pre-computed full_name from enrichment, or fallback
    return conversation.full_name || "Unknown User"
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const messages = conversation.messages || []

  return (
    <>
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.push('/conversations')}>
          ← Back to Conversations
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conversation Details</h1>
            <p className="text-muted-foreground text-sm">
              {getFullName(conversation)} with {conversation.mentor_bot?.name || "Unknown bot"}
            </p>
          </div>
        </div>
      </div>

      <Card className="flex h-[calc(100vh-16rem)] overflow-hidden">
        <div className="flex-1 flex flex-col bg-background">
          {/* Conversation header */}
          <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg">
                        {getInitials(conversation)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold truncate">{getFullName(conversation)}</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => router.push(`/users/${conversation.clerk_user_id}`)}
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{conversation.email || 'No email'}</span>
                      <span>•</span>
                      <span>{messages.length} messages</span>
                      <span>•</span>
                      <span>Bot: {conversation.mentor_bot?.name || "Unknown"}</span>
                      <span>•</span>
                      <span>Last message: {new Date(conversation.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map((message) => (
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
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-3 ${
                            message.role === "user" ? "text-muted-foreground" : "text-primary-foreground/70"
                          }`}
                        >
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </>
  )
}
