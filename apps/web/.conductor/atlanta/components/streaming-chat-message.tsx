"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sparkles } from "lucide-react"
import { useState, useEffect } from "react"
import type { StreamingChatMessage } from "@/hooks/use-streaming-chat"

interface StreamingChatMessageProps {
  message: StreamingChatMessage
  userInitials?: string
  botInitials?: string
  isProcessing?: boolean
}

// Status words for Elise Pham Bot - strategic, action-oriented mentorship vibe
const STATUS_WORDS = [
  "Strategizing",
  "Analyzing",
  "Mapping your path",
  "Checking frameworks",
  "Reviewing patterns",
  "Crafting your roadmap",
  "Evaluating options",
  "Building your plan",
  "Connecting the dots",
  "Zooming out",
  "Getting specific",
  "Preparing insights",
]

export function StreamingChatMessage({
  message,
  userInitials = "U",
  botInitials = "AI",
  isProcessing = false,
}: StreamingChatMessageProps) {
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0)
  const isUser = message.role === "user"

  // Cycle through status words when processing
  useEffect(() => {
    if (!isProcessing) return

    const interval = setInterval(() => {
      setCurrentStatusIndex((prev) => (prev + 1) % STATUS_WORDS.length)
    }, 3600) // Change word every 3.6 seconds for engagement

    return () => clearInterval(interval)
  }, [isProcessing])

  return (
    <div className="mb-4">
      <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback
            className={`text-xs font-medium ${
              isUser ? "bg-gray-500 text-white" : "bg-blue-500 text-white"
            }`}
          >
            {isUser ? userInitials : botInitials}
          </AvatarFallback>
        </Avatar>

        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[75%]`}>
          {/* Status indicator (only for assistant messages while processing) */}
          {!isUser && isProcessing && !message.content && (
            <div className="mb-2 flex items-center gap-2.5 text-sm text-blue-500 font-medium">
              <Sparkles className="w-4 h-4 animate-[pulse_1.5s_ease-in-out_infinite] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="animate-pulse">{STATUS_WORDS[currentStatusIndex]}...</span>
            </div>
          )}

          {/* Message bubble */}
          <div
            className={`relative px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              isUser
                ? "bg-blue-500 text-white rounded-[18px] rounded-br-[4px]"
                : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-[18px] rounded-bl-[4px]"
            }`}
          >
            {/* Show typing bubbles only when streaming with no content yet */}
            {message.isStreaming && !message.content ? (
              <div className="flex items-center gap-1 py-1">
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-[bounce_1.4s_ease-in-out_0s_infinite]"></span>
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-[bounce_1.4s_ease-in-out_0.2s_infinite]"></span>
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-[bounce_1.4s_ease-in-out_0.4s_infinite]"></span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">
                {(message.content || "...").trim()}
              </p>
            )}
          </div>

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground mt-1 px-2">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
