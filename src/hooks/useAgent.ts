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
  const getResponse = useCallback(async (
    promptKey: string,
    state: any,
    userMessage: string | null = null,
    onChunk?: (text: string) => void
  ): Promise<{ message: string }> => {
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
        body: JSON.stringify({ sessionId })
      })

      if (!res.ok) {
        if (res.status === 429) {
          return { message: "I need a moment to think. Try again shortly." }
        }
        throw new Error('Generation failed')
      }

      // Parse text stream
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

      setIsLoading(false)
      return { message: fullText }
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
