'use client'

import { useState, useCallback, useRef } from 'react'
import { useSessionId } from '@/context/UserContext'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export function useAgent() {
  const sessionId = useSessionId()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<Message[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  // Stream chat message with real-time text updates
  const sendMessage = useCallback(async (
    content: string,
    onChunk?: (text: string) => void
  ): Promise<string> => {
    if (!sessionId) {
      throw new Error('No session - please refresh the page')
    }

    setIsLoading(true)
    setError(null)

    // Add user message to history
    messagesRef.current = [...messagesRef.current, { role: 'user', content }]

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: messagesRef.current,
          agentId: 'rafael-chat'
        }),
        signal: abortControllerRef.current.signal
      })

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After')
          throw new Error(`Slow down - try again in ${retryAfter || 'a few'} seconds`)
        }
        if (res.status === 404) {
          throw new Error('Session expired - please refresh')
        }
        throw new Error('Something went wrong')
      }

      // Parse SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        onChunk?.(fullText)
      }

      // Add assistant message to history
      messagesRef.current = [...messagesRef.current, { role: 'assistant', content: fullText }]

      setIsLoading(false)
      return fullText
    } catch (err: any) {
      setIsLoading(false)
      if (err.name === 'AbortError') {
        return ''
      }
      const errorMsg = err.message || 'Failed to get response'
      setError(errorMsg)
      throw err
    }
  }, [sessionId])

  // Legacy getResponse for backward compatibility (PhaseFlow AI moments)
  // Returns message text and optional embed data if AI called a tool
  const getResponse = useCallback(async (
    promptKey: string,
    state: any,
    userMessage: string | null = null,
    onChunk?: (text: string, embedData?: any) => void
  ): Promise<{ message: string; embedData?: any }> => {
    // For chat, use the new sendMessage
    if (promptKey === 'chat' && userMessage) {
      const text = await sendMessage(userMessage, onChunk)
      return { message: text }
    }

    // For phase prompts, call diagnosis generation
    if (!sessionId) {
      return { message: "I'm still getting ready. One moment..." }
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/generate/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, promptKey })
      })

      if (!res.ok) {
        if (res.status === 429) {
          return { message: "I need a moment to think. Try again shortly." }
        }
        throw new Error('Generation failed')
      }

      // Parse stream - could be plain text or UI message format with tool results
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let fullText = ''
      let embedData: any = undefined
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse stream - supports AI SDK v6 format (data: JSON) and legacy formats
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          // AI SDK v6 format: data: {"type":"text-delta","delta":"..."}
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'text-delta' && data.delta) {
                fullText += data.delta
                onChunk?.(fullText, embedData)
              } else if (data.type === 'tool-output-available' && data.output?.embedType) {
                // AI SDK v6 tool output format
                embedData = data.output
                onChunk?.(fullText, embedData)
              } else if (data.type === 'tool-result' && data.output?.embedType) {
                // AI SDK v6 tool result format
                embedData = data.output
                onChunk?.(fullText, embedData)
              }
            } catch {
              // Invalid JSON, skip
            }
          } else if (line.startsWith('0:')) {
            // Legacy format: 0:"text content"
            try {
              const text = JSON.parse(line.slice(2))
              fullText += text
              onChunk?.(fullText, embedData)
            } catch {
              fullText += line
              onChunk?.(fullText, embedData)
            }
          } else if (line.startsWith('9:')) {
            // Legacy format: 9:[{...tool results...}]
            try {
              const toolData = JSON.parse(line.slice(2))
              if (Array.isArray(toolData)) {
                for (const item of toolData) {
                  if (item.result?.embedType) {
                    embedData = item.result
                    onChunk?.(fullText, embedData)
                  }
                }
              }
            } catch (e) {
              console.error('Failed to parse tool result:', e)
            }
          } else if (!line.startsWith('d:') && !line.startsWith('e:') && !line.startsWith(':') && line.trim()) {
            // Plain text (backward compatible) - skip SSE comments starting with :
            fullText += line
            onChunk?.(fullText, embedData)
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        if (buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6))
            if (data.type === 'text-delta' && data.delta) {
              fullText += data.delta
            }
          } catch { /* skip */ }
        } else if (buffer.startsWith('0:')) {
          try {
            fullText += JSON.parse(buffer.slice(2))
          } catch {
            fullText += buffer
          }
        } else if (!buffer.startsWith('d:') && !buffer.startsWith('e:') && !buffer.startsWith(':')) {
          fullText += buffer
        }
        onChunk?.(fullText, embedData)
      }

      setIsLoading(false)
      return { message: fullText, embedData }
    } catch (err) {
      setIsLoading(false)
      console.error('Generation error:', err)
      return { message: "Let me think about this differently..." }
    }
  }, [sessionId, sendMessage])

  // Cancel ongoing request
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
  }, [])

  // Clear conversation history
  const clearHistory = useCallback(() => {
    messagesRef.current = []
  }, [])

  return {
    sendMessage,
    getResponse,
    isLoading,
    error,
    cancel,
    clearHistory,
    messages: messagesRef.current
  }
}
