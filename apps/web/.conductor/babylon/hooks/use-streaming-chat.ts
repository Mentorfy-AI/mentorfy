"use client"

import { useState, useCallback, useRef } from "react"

export interface StreamingChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isStreaming?: boolean
  fileId?: string // Anthropic file ID for documents
  fileType?: string // MIME type
  fileName?: string // Original file name
  fileBase64?: string // Base64 data for images
}

export interface UseStreamingChatOptions {
  conversationId: string
  botId: string
  initialMessages?: StreamingChatMessage[]
  onError?: (error: string) => void
}

export interface UseStreamingChatReturn {
  messages: StreamingChatMessage[]
  isStreaming: boolean
  toolStatus: string | null
  sendMessage: (content: string, file?: File, existingFileId?: string, existingFileType?: string) => Promise<void>
  error: string | null
}

/**
 * Hook for streaming chat with SSE support.
 * Handles tool calls and real-time text streaming.
 */
export function useStreamingChat({
  conversationId,
  botId,
  initialMessages = [],
  onError,
}: UseStreamingChatOptions): UseStreamingChatReturn {
  const [messages, setMessages] = useState<StreamingChatMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const sendMessage = useCallback(
    async (content: string, file?: File, existingFileId?: string, existingFileType?: string) => {
      console.log('[SEND-MESSAGE] Called with:', content, 'file:', file?.name, 'existingFileId:', existingFileId, 'existingFileType:', existingFileType, 'isStreaming:', isStreaming);
      if (!content.trim() || isStreaming) {
        console.log('[SEND-MESSAGE] Blocked - empty or already streaming');
        return;
      }

      console.log('[SEND-MESSAGE] Proceeding to send message');

      // Add user message immediately (with file metadata if present)
      const userMessage: StreamingChatMessage = {
        id: `user-${Date.now()}`,
        content,
        role: "user",
        timestamp: new Date(),
        fileId: existingFileId,
        fileType: existingFileType || file?.type,
        fileName: file?.name,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setError(null)

      // Create assistant message placeholder
      const assistantMessageId = `assistant-${Date.now()}`
      const assistantMessage: StreamingChatMessage = {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, assistantMessage])

      try {
        // Close any existing EventSource
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
        }

        // Handle file attachments differently based on type
        let fileId: string | undefined = existingFileId;
        let fileType: string | undefined = existingFileType;
        let fileBase64: string | undefined;

        if (file && !existingFileId) {
          fileType = file.type;

          // For images: convert to base64 directly (Files API doesn't support retrieval)
          // For documents: upload to Anthropic Files API
          if (file.type.startsWith('image/')) {
            console.log('[SEND-MESSAGE] Converting image to base64:', file.name);
            const reader = new FileReader();
            fileBase64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]; // Remove data:image/...;base64, prefix
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            console.log('[SEND-MESSAGE] Image converted to base64');

            // Update user message with base64 data for display
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === userMessage.id
                  ? { ...msg, fileBase64 }
                  : msg
              )
            );
          } else {
            console.log('[SEND-MESSAGE] Uploading document to Anthropic:', file.name);
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            });

            const uploadResult = await uploadResponse.json();
            if (!uploadResult.success) {
              throw new Error(uploadResult.error || 'Failed to upload file');
            }

            fileId = uploadResult.file_id;
            console.log('[SEND-MESSAGE] Document uploaded, file_id:', fileId);

            // Update user message with fileId
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === userMessage.id
                  ? { ...msg, fileId }
                  : msg
              )
            );
          }
        } else if (existingFileId) {
          console.log('[SEND-MESSAGE] Using existing file_id:', existingFileId, 'type:', existingFileType);
        }

        // Prepare request body
        const requestBody = {
          message: content,
          conversation_id: conversationId,
          bot_id: botId,
          file_id: fileId,
          file_type: fileType,
          file_base64: fileBase64, // Include base64 data for images
          previous_messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }

        // Start streaming via fetch (we'll manually parse SSE)
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error("No response body")
        }

        let buffer = ""
        let currentEventType = "message" // Track current event type

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim()

            // Track event type
            if (trimmed.startsWith("event: ")) {
              currentEventType = trimmed.slice(7)
              continue
            }

            // Parse data line
            if (!trimmed.startsWith("data: ")) continue

            const data = trimmed.slice(6) // Remove "data: " prefix

            try {
              const parsed = JSON.parse(data)

              switch (currentEventType) {
                case "thinking_start":
                case "thinking_delta":
                case "thinking_end":
                  // Ignore thinking events - we don't display them anymore
                  break

                case "tool_status":
                  setToolStatus(parsed.message || null)
                  break

                case "text_delta":
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + (parsed.delta || "") }
                        : msg
                    )
                  )
                  break

                case "done":
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  )
                  setIsStreaming(false)
                  setToolStatus(null)

                  // Save messages to database
                  await saveMessagesToDatabase(conversationId, [
                    userMessage,
                    { ...assistantMessage, content: parsed.content, isStreaming: false },
                  ])
                  break

                case "error":
                  throw new Error(parsed.error || "Unknown error")
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError)
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to send message"
        setError(errorMessage)
        setIsStreaming(false)
        setToolStatus(null)

        // Remove failed assistant message
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId))

        if (onError) {
          onError(errorMessage)
        }
      }
    },
    [conversationId, botId, messages, isStreaming, onError]
  )

  return {
    messages,
    isStreaming,
    toolStatus,
    sendMessage,
    error,
  }
}

/**
 * Save messages to the database
 */
async function saveMessagesToDatabase(
  conversationId: string,
  messages: StreamingChatMessage[]
): Promise<void> {
  try {
    for (const message of messages) {
      // Include file metadata in message payload
      const metadata: any = {};
      if (message.fileId) metadata.fileId = message.fileId;
      if (message.fileType) metadata.fileType = message.fileType;
      if (message.fileName) metadata.fileName = message.fileName;
      if (message.fileBase64) metadata.fileBase64 = message.fileBase64;

      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      })
    }
  } catch (error) {
    console.error("Failed to save messages:", error)
  }
}
