"use client"

import type { ChatMessage as UseChatMessage } from "@/hooks/use-chat"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface ChatMessageProps {
  message: UseChatMessage
  userInitials?: string
}

export function ChatMessage({ message, userInitials = "U" }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback
          className={`text-xs font-medium ${isUser ? "bg-gray-500 text-white" : "bg-gray-500 text-white"}`}
        >
          {isUser ? userInitials : "BB"}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[75%]`}>
        <div
          className={`relative px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-blue-500 text-white rounded-[18px] rounded-br-[4px]"
              : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-[18px] rounded-bl-[4px]"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content.trim()}</p>
        </div>
        <span className="text-xs text-muted-foreground mt-1 px-2">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  )
}
