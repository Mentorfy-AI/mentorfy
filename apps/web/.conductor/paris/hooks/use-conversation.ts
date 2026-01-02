"use client"

import { useState, useEffect, useCallback } from "react"

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export interface ConversationDetails {
  id: string
  botId: string
  title: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ConversationState {
  conversation: ConversationDetails | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  isThinking: boolean
}

/**
 * Hook for loading and managing an existing conversation by ID
 * Used on the /chat/[conversationId] route
 */
export function useConversation(conversationId: string) {
  const [state, setState] = useState<ConversationState>({
    conversation: null,
    messages: [],
    isLoading: true,
    error: null,
    isThinking: false,
  })

  // Load conversation and messages on mount
  useEffect(() => {
    async function loadConversation() {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        // Fetch conversation details
        const conversationResponse = await fetch(`/api/conversations/${conversationId}`)
        const conversationData = await conversationResponse.json()

        if (!conversationData.success) {
          throw new Error(conversationData.error || 'Failed to load conversation')
        }

        // Fetch messages
        const messagesResponse = await fetch(`/api/conversations/${conversationId}/messages`)
        const messagesData = await messagesResponse.json()

        if (!messagesData.success) {
          throw new Error(messagesData.error || 'Failed to load messages')
        }

        const conversation: ConversationDetails = {
          id: conversationData.conversation.id,
          botId: conversationData.conversation.mentor_bot_id,
          title: conversationData.conversation.title,
          createdAt: new Date(conversationData.conversation.created_at),
          updatedAt: new Date(conversationData.conversation.updated_at),
        }

        const messages: ChatMessage[] = messagesData.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.created_at),
        }))

        // Check if we're waiting for AI response (user message without assistant reply)
        const lastMessage = messages[messages.length - 1]
        const isThinking = lastMessage?.role === 'user'

        setState({
          conversation,
          messages,
          isLoading: false,
          error: null,
          isThinking,
        })
      } catch (error) {
        console.error('Error loading conversation:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load conversation',
        }))
      }
    }

    if (conversationId) {
      loadConversation()
    }
  }, [conversationId])

  // Poll for new messages when thinking
  useEffect(() => {
    if (!state.isThinking || !conversationId) return

    const pollInterval = setInterval(async () => {
      try {
        const messagesResponse = await fetch(`/api/conversations/${conversationId}/messages`)
        const messagesData = await messagesResponse.json()

        if (messagesData.success) {
          const messages: ChatMessage[] = messagesData.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(msg.created_at),
          }))

          const lastMessage = messages[messages.length - 1]
          const stillThinking = lastMessage?.role === 'user'

          setState(prev => ({
            ...prev,
            messages,
            isThinking: stillThinking,
          }))

          // Stop polling when we get the assistant response
          if (!stillThinking) {
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error)
      }
    }, 1000) // Poll every second

    return () => clearInterval(pollInterval)
  }, [state.isThinking, conversationId])

  // Send a new message in the existing conversation
  const sendMessage = useCallback(async (content: string) => {
    if (!state.conversation) {
      console.error('No conversation loaded')
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isThinking: true,
    }))

    try {
      // Send message to chat API
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId: state.conversation.id,
          botId: state.conversation.botId,
          previousMessages: state.messages.map(m => ({
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
      await fetch(`/api/conversations/${state.conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content }),
      })

      // Save assistant message
      await fetch(`/api/conversations/${state.conversation.id}/messages`, {
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

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
        isThinking: false,
      }))
    } catch (error) {
      console.error('Error sending message:', error)
      setState(prev => ({
        ...prev,
        isThinking: false,
      }))
    }
  }, [state.conversation, state.messages])

  return {
    ...state,
    sendMessage,
  }
}
