'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import posthog from 'posthog-js';

export interface StreamingChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isStreaming?: boolean;
  // File attachments (new multi-file support)
  files?: Array<{
    name: string;
    type: string;
    file_id?: string;
    size?: number;
  }>;
  // Legacy file attachment metadata (deprecated)
  fileType?: string; // MIME type (image/png, application/pdf, etc.)
  fileBase64?: string; // For images only - base64 data
  fileId?: string; // For documents only - Anthropic file ID
  fileName?: string; // Original filename for display
  // Performance metrics
  firstTokenTime?: number; // Time to first token in hundredths of a second
}

export interface UseStreamingChatOptions {
  conversationId: string;
  botId: string;
  initialMessages?: StreamingChatMessage[];
  needsFormGreeting?: boolean;
  onError?: (error: string) => void;
  onConversationCreated?: (conversationId: string) => void;
}

export interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'success' | 'error';
  fileId?: string;
  base64?: string;
  errorMessage?: string;
}

export interface UseStreamingChatReturn {
  messages: StreamingChatMessage[];
  isStreaming: boolean;
  toolStatus: string | null;
  sendMessage: (
    content: string,
    files?: UploadedFile[]
  ) => Promise<void>;
  cancelStreaming: () => void;
  error: string | null;
  /** Time to first token in hundredths of a second (null if no token received yet) */
  firstTokenTime: number | null;
  /** Whether the first token has been received in the current stream */
  hasFirstToken: boolean;
}

/**
 * Hook for streaming chat with SSE support.
 * Handles tool calls and real-time text streaming.
 */
export function useStreamingChat({
  conversationId,
  botId,
  initialMessages = [],
  needsFormGreeting,
  onError,
  onConversationCreated,
}: UseStreamingChatOptions): UseStreamingChatReturn {
  const [messages, setMessages] =
    useState<StreamingChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstTokenTime, setFirstTokenTime] = useState<number | null>(null);
  const [hasFirstToken, setHasFirstToken] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const lastConversationIdRef = useRef<string>(conversationId);
  const streamStartTimeRef = useRef<number | null>(null);
  const hasFirstTokenRef = useRef<boolean>(false); // Ref for synchronous checking in event handler
  const hasAutoStartedGreetingRef = useRef<boolean>(false); // Track if form greeting has been auto-triggered

  // Update messages when conversation changes (not on every initialMessages array recreation)
  // Exception: Don't reset when transitioning from 'temp' to real UUID (new chat flow)
  useEffect(() => {
    const previousId = lastConversationIdRef.current;
    const isNewChatTransition =
      previousId === 'temp' && conversationId !== 'temp';

    if (conversationId !== previousId && !isNewChatTransition) {
      setMessages(initialMessages);
    }

    lastConversationIdRef.current = conversationId;
  }, [conversationId, initialMessages]);

  // Memory cleanup: Remove base64 data from old messages to prevent memory bloat
  // Keep base64 only for the most recent 3 messages
  useEffect(() => {
    if (messages.length > 3) {
      setMessages((prev) =>
        prev.map((msg, idx) => {
          // Keep base64 for last 3 messages
          if (idx >= prev.length - 3) {
            return msg;
          }

          // Remove base64 from older messages
          if (msg.fileBase64) {
            const { fileBase64, ...rest } = msg;
            return rest as StreamingChatMessage;
          }

          return msg;
        })
      );
    }
  }, [messages.length]);

  const sendMessage = useCallback(
    async (
      content: string,
      files?: UploadedFile[]
    ) => {
      console.log('[STREAMING-HOOK] sendMessage called:', {
        content: content.substring(0, 50),
        filesCount: files?.length,
        files: files?.map(f => ({ id: f.id, name: f.file.name, status: f.status, hasBase64: !!f.base64, hasFileId: !!f.fileId }))
      })

      // Allow messages with files even if content is empty
      // Also allow empty messages for form greetings (backend will inject the greeting prompt)
      const hasFiles = files && files.length > 0 && files.some(f => f.status === 'success')
      const isFormGreeting = needsFormGreeting && messages.length === 0
      if ((!content.trim() && !hasFiles && !isFormGreeting) || isStreaming) {
        console.log('[STREAMING-HOOK] Message rejected:', { emptyContent: !content.trim(), noFiles: !hasFiles, isFormGreeting, alreadyStreaming: isStreaming })
        return;
      }

      // Add user message immediately with file metadata
      // Skip for form greetings - no user message to show
      const userMessage: StreamingChatMessage | null = isFormGreeting
        ? null
        : {
            id: `user-${Date.now()}`,
            content,
            role: 'user',
            timestamp: new Date(),
            files: files && files.length > 0
              ? files
                  .filter(f => f.status === 'success')
                  .map(f => ({
                    name: f.file.name,
                    type: f.file.type,
                    file_id: f.fileId,
                    size: f.file.size,
                  }))
              : undefined,
          };

      if (userMessage) {
        console.log('[STREAMING-HOOK] Adding user message to UI')
        setMessages((prev) => [...prev, userMessage]);
      } else {
        console.log('[STREAMING-HOOK] Skipping user message for form greeting')
      }
      setIsStreaming(true);
      setError(null);
      setHasFirstToken(false);
      setFirstTokenTime(null);
      hasFirstTokenRef.current = false;
      streamStartTimeRef.current = Date.now();

      // Create assistant message placeholder
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: StreamingChatMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Store current assistant message ID for cancellation
      currentAssistantMessageIdRef.current = assistantMessageId;

      try {
        // Close any existing EventSource
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();

        // If conversationId is 'temp', create a real conversation first
        let realConversationId = conversationId;
        if (conversationId === 'temp') {
          const response = await fetch('/api/conversations/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botId: botId,
              message: content,
            }),
          });

          const data = await response.json();
          if (!data.success || !data.conversationId) {
            throw new Error(data.error || 'Failed to create conversation');
          }

          realConversationId = data.conversationId;

          // Notify parent component to update URL and state
          if (onConversationCreated) {
            onConversationCreated(realConversationId);
          }
        }

        // Build file attachments array from uploaded files
        console.log('[STREAMING-HOOK] Building file attachments array')
        const fileAttachments: any[] = [];

        if (files && files.length > 0) {
          console.log('[STREAMING-HOOK] Processing', files.length, 'files')
          for (const uploadedFile of files) {
            if (uploadedFile.status !== 'success') {
              console.log('[STREAMING-HOOK] Skipping file with non-success status:', uploadedFile.status)
              continue;
            }

            if (uploadedFile.file.type.startsWith('image/')) {
              console.log('[STREAMING-HOOK] Adding image attachment:', uploadedFile.file.name)
              fileAttachments.push({
                type: 'image',
                base64: uploadedFile.base64,
                media_type: uploadedFile.file.type,
              });
            } else {
              console.log('[STREAMING-HOOK] Adding document attachment:', uploadedFile.file.name, 'fileId:', uploadedFile.fileId)
              fileAttachments.push({
                type: 'document',
                file_id: uploadedFile.fileId,
              });
            }
          }
        }

        console.log('[STREAMING-HOOK] Final file_attachments array:', fileAttachments.length, 'attachments')

        // Prepare request body
        const requestBody = {
          message: content,
          conversation_id: realConversationId,
          bot_id: botId,
          file_attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
          previous_messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        };

        console.log('[STREAMING-HOOK] Request body:', {
          ...requestBody,
          file_attachments: requestBody.file_attachments?.map(a => ({ type: a.type, hasBase64: !!a.base64, file_id: a.file_id })),
          previous_messages: `${requestBody.previous_messages.length} messages`
        })

        // Start streaming via fetch (we'll manually parse SSE)
        console.log('[STREAMING-HOOK] Sending request to /api/chat/stream')
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        console.log('[STREAMING-HOOK] Response status:', response.status, response.ok ? 'OK' : 'ERROR')

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[STREAMING-HOOK] HTTP error response:', errorText)
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';
        let currentEventType = 'message'; // Track current event type

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            // Add defensive check for undefined/null lines
            if (!line || typeof line !== 'string') continue;

            const trimmed = line.trim();

            // Track event type
            if (trimmed.startsWith('event: ')) {
              currentEventType = trimmed.slice(7);
              continue;
            }

            // Parse data line
            if (!trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6); // Remove "data: " prefix

            try {
              const parsed = JSON.parse(data);

              switch (currentEventType) {
                case 'thinking_start':
                case 'thinking_delta':
                case 'thinking_end':
                  // Ignore thinking events - we don't display them anymore
                  break;

                case 'tool_status':
                  setToolStatus(parsed.message || null);
                  break;

                case 'text_delta':
                  // Capture time to first token and store it in the message
                  // Use ref for synchronous check to avoid stale closure in useCallback
                  if (!hasFirstTokenRef.current && streamStartTimeRef.current) {
                    const elapsed = Date.now() - streamStartTimeRef.current;
                    const timeInHundredths = Math.floor(elapsed / 10);
                    setFirstTokenTime(timeInHundredths);
                    setHasFirstToken(true); // Update state for UI (thinking indicator)
                    hasFirstTokenRef.current = true; // Update ref for subsequent checks

                    // Store the time in the message itself
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: msg.content + (parsed.delta || ''),
                              firstTokenTime: timeInHundredths,
                            }
                          : msg
                      )
                    );
                  } else {
                    // Regular content update without timing
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: msg.content + (parsed.delta || ''),
                            }
                          : msg
                      )
                    );
                  }
                  break;

                case 'done':
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  );
                  setIsStreaming(false);
                  setToolStatus(null);

                  // Build file metadata for database
                  const filesMetadata = files && files.length > 0
                    ? files
                        .filter(f => f.status === 'success')
                        .map(f => ({
                          name: f.file.name,
                          type: f.file.type,
                          file_id: f.fileId,
                          size: f.file.size,
                        }))
                    : undefined;

                  // Save messages to database
                  // For form greetings, only save the assistant message (no user message)
                  const messagesToSave = userMessage
                    ? [
                        userMessage,
                        {
                          ...assistantMessage,
                          content: parsed.content,
                          isStreaming: false,
                        },
                      ]
                    : [
                        {
                          ...assistantMessage,
                          content: parsed.content,
                          isStreaming: false,
                        },
                      ];

                  await saveMessagesToDatabase(
                    realConversationId,
                    messagesToSave,
                    filesMetadata
                  );

                  // Track TTFT for performance monitoring
                  if (firstTokenTime !== null) {
                    posthog.capture('chat_response_complete', {
                      first_token_time_ms: firstTokenTime * 10,
                      bot_id: botId,
                      is_form_greeting: isFormGreeting,
                      conversation_id: realConversationId,
                    });
                  }
                  break;

                case 'error':
                  throw new Error(parsed.error || 'Unknown error');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      } catch (err) {
        // Check if this was an abort (user cancellation)
        if (err instanceof Error && err.name === 'AbortError') {
          // Keep the partial message instead of removing it
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
        } else {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to send message';
          setError(errorMessage);

          // Remove failed assistant message
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessageId)
          );

          if (onError) {
            onError(errorMessage);
          }
        }

        setIsStreaming(false);
        setToolStatus(null);
        currentAssistantMessageIdRef.current = null;
      }
    },
    [conversationId, botId, messages, isStreaming, needsFormGreeting, onError]
  );

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Auto-trigger form greeting when conversation loads with needs_form_greeting flag
  useEffect(() => {
    if (
      needsFormGreeting &&
      conversationId !== 'temp' &&
      messages.length === 0 &&
      !hasAutoStartedGreetingRef.current &&
      !isStreaming
    ) {
      hasAutoStartedGreetingRef.current = true;
      console.log('[STREAMING-HOOK] Auto-triggering form greeting for conversation:', conversationId);
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        sendMessage(''); // Empty message triggers form greeting on backend
      }, 100);
    }
  }, [needsFormGreeting, conversationId, messages.length, isStreaming, sendMessage]);

  // Cleanup on component unmount - cancel any active streams to prevent wasting backend resources
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    messages,
    isStreaming,
    toolStatus,
    sendMessage,
    cancelStreaming,
    error,
    firstTokenTime,
    hasFirstToken,
  };
}

/**
 * Save messages to the database
 */
async function saveMessagesToDatabase(
  conversationId: string,
  messages: StreamingChatMessage[],
  filesMetadata?: Array<{
    name: string;
    type: string;
    file_id?: string;
    size: number;
  }>
): Promise<void> {
  try {
    for (const message of messages) {
      // Only attach file metadata to user messages (first message in array)
      const isUserMessage = message.role === 'user';
      const file_metadata = isUserMessage && filesMetadata ? filesMetadata : undefined;

      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          file_metadata,
        }),
      });
    }
  } catch (error) {
    console.error('Failed to save messages:', error);
  }
}
