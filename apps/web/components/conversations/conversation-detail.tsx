"use client"

import { useRouter } from "next/navigation"
import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare } from "lucide-react"
import { formatBotName } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

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
      <div className="flex h-full overflow-hidden bg-card border rounded-lg">
        <div className="w-full flex flex-col overflow-hidden">
          {/* Header - compact */}
          <div className="p-4 border-b flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/conversations')}
              className="-ml-2"
            >
              ← Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold">{getFullName(conversation)}</h1>
              <p className="text-xs text-muted-foreground">with {formatBotName(conversation.mentor_bot?.name)}</p>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
              <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
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
                        {message.role === "user" ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div className="text-sm leading-relaxed markdown-content">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || "")
                                  const codeContent = String(children).replace(/\n$/, "")

                                  return !inline && match ? (
                                    <SyntaxHighlighter
                                      style={oneDark}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-md my-2 text-xs"
                                      {...props}
                                    >
                                      {codeContent}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code
                                      className={`${className} bg-primary-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono`}
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  )
                                },
                                p({ children }) {
                                  return <p className="mb-2 last:mb-0">{children}</p>
                                },
                                ul({ children }) {
                                  return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                                },
                                ol({ children }) {
                                  return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                                },
                                li({ children }) {
                                  return <li className="ml-2">{children}</li>
                                },
                                a({ href, children }) {
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline hover:opacity-80"
                                    >
                                      {children}
                                    </a>
                                  )
                                },
                                strong({ children }) {
                                  return <strong className="font-semibold">{children}</strong>
                                },
                                em({ children }) {
                                  return <em className="italic">{children}</em>
                                },
                                h1({ children }) {
                                  return <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>
                                },
                                h2({ children }) {
                                  return <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>
                                },
                                h3({ children }) {
                                  return <h3 className="text-sm font-bold mb-2 mt-2 first:mt-0">{children}</h3>
                                },
                                blockquote({ children }) {
                                  return (
                                    <blockquote className="border-l-4 border-primary-foreground/30 pl-3 my-2 italic">
                                      {children}
                                    </blockquote>
                                  )
                                },
                                hr() {
                                  return <hr className="my-3 border-primary-foreground/20" />
                                },
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
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
      </div>
    </>
  )
}
