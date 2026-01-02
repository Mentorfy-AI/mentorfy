"use client"

import { useState, useCallback } from "react"

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isChatMode: boolean
  isThinking: boolean
  conversationId: string | null
  botId: string | null
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    isChatMode: false,
    isThinking: false,
    conversationId: null,
    botId: null,
  })

  const startChat = useCallback(async (initialMessage?: string, botId?: string) => {
    console.log("[v0] Starting chat mode", { initialMessage, botId })

    setState((prev) => ({
      ...prev,
      isChatMode: true,
      botId: botId || null,
      messages: initialMessage
        ? [
            {
              id: Date.now().toString(),
              content: initialMessage,
              role: "user",
              timestamp: new Date(),
            },
          ]
        : [],
      isThinking: !!initialMessage,
      isLoading: !!initialMessage,
    }))

    // Send initial message if provided
    if (initialMessage) {
      try {
        // Create conversation and send message
        const conversationResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId, title: initialMessage.slice(0, 50) }),
        })

        const conversationData = await conversationResponse.json()
        if (!conversationData.success) {
          throw new Error(conversationData.error || 'Failed to create conversation')
        }

        const conversationId = conversationData.conversation.id

        // Send message to chat API
        const chatResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: initialMessage,
            conversationId,
            botId,
          }),
        })

        const chatData = await chatResponse.json()
        if (chatData.error) {
          throw new Error(chatData.error)
        }

        // Save user message
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'user', content: initialMessage }),
        })

        // Save assistant message
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: chatData.response }),
        })

        setState((prev) => ({
          ...prev,
          conversationId,
          isThinking: false,
          isLoading: false,
          messages: [
            ...prev.messages,
            {
              id: (Date.now() + 1).toString(),
              content: chatData.response,
              role: "assistant",
              timestamp: new Date(),
            },
          ],
        }))
      } catch (error) {
        console.error('Error starting chat:', error)
        setState((prev) => ({
          ...prev,
          isThinking: false,
          isLoading: false,
        }))
      }
    }
  }, [])

  const sendMessage = useCallback(async (content: string, botId?: string) => {
    console.log("[v0] Sending message", { content })

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    }

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isThinking: true,
      isLoading: true,
    }))

    try {
      // Get current state to access conversationId
      const currentState = state

      // If no conversation exists, create one
      let conversationId = currentState.conversationId
      if (!conversationId) {
        const conversationResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId: botId || currentState.botId, title: content.slice(0, 50) }),
        })

        const conversationData = await conversationResponse.json()
        if (!conversationData.success) {
          throw new Error(conversationData.error || 'Failed to create conversation')
        }

        conversationId = conversationData.conversation.id
      }

      // Send message to chat API
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId,
          botId: botId || currentState.botId,
          previousMessages: currentState.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const chatData = await chatResponse.json()
      if (chatData.error) {
        throw new Error(chatData.error)
      }

      // Save user message
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content }),
      })

      // Save assistant message
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'assistant', content: chatData.response }),
      })

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: chatData.response,
        role: "assistant",
        timestamp: new Date(),
      }

      setState((prev) => ({
        ...prev,
        conversationId,
        messages: [...prev.messages, aiMessage],
        isThinking: false,
        isLoading: false,
      }))
    } catch (error) {
      console.error('Error sending message:', error)
      setState((prev) => ({
        ...prev,
        isThinking: false,
        isLoading: false,
      }))
    }
  }, [state])

  const newChat = useCallback(() => {
    console.log("[v0] Starting new chat - returning to home")
    setState({
      messages: [],
      isLoading: false,
      isChatMode: false, // Return to home instead of staying in chat
      isThinking: false,
      conversationId: null,
      botId: null,
    })
  }, [])

  const exitChat = useCallback(() => {
    console.log("[v0] Exiting chat mode")
    setState({
      messages: [],
      isLoading: false,
      isChatMode: false,
      isThinking: false,
      conversationId: null,
      botId: null,
    })
  }, [])

  const setBotId = useCallback((botId: string | null) => {
    setState((prev) => ({
      ...prev,
      botId,
    }))
  }, [])

  return {
    ...state,
    startChat,
    sendMessage,
    newChat,
    exitChat,
    setBotId,
  }
}
