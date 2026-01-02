"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import { useAuth as useClerkAuth } from '@clerk/nextjs'

export interface Conversation {
  id: string
  user_id: string
  mentor_bot_id: string
  title: string
  created_at: string
  updated_at: string
  message_count?: number
  last_message_at?: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata: {
    sources?: string[]
  }
  created_at: string
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      setConversations([])
      setLoading(false)
      return
    }

    const fetchConversations = async () => {
      try {
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
          .from('conversation')
          .select(`
            id,
            user_id,
            mentor_bot_id,
            title,
            created_at,
            updated_at,
            message:message(count)
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })

        if (error) {
          throw error
        }

        // Process the data to add message count
        const processedConversations = (data || []).map((conv: any) => ({
          ...conv,
          message_count: conv.message?.[0]?.count || 0
        }))

        setConversations(processedConversations)

      } catch (err: any) {
        console.error('Error fetching conversations:', err)
        setError(err.message || 'Failed to fetch conversations')
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [user])

  return { conversations, loading, error }
}

export function useConversationMessages(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    const fetchMessages = async () => {
      try {
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
          .from('message')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (error) {
          throw error
        }

        setMessages(data || [])

      } catch (err: any) {
        console.error('Error fetching messages:', err)
        setError(err.message || 'Failed to fetch messages')
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [conversationId])

  return { messages, loading, error, setMessages }
}

export function useCreateConversation() {
  const { user } = useAuth()
  const { orgId } = useClerkAuth()

  const createConversation = async (title?: string) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    if (!orgId) {
      throw new Error('No active organization')
    }

    const supabase = createClient()

    // Get agent for the organization
    const { data: mentorBot, error: botError } = await supabase
      .from('mentor_bot')
      .select('id')
      .eq('clerk_org_id', orgId)
      .limit(1)
      .single()

    if (botError || !mentorBot) {
      throw new Error('No agent found')
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversation')
      .insert({
        user_id: user.id,
        mentor_bot_id: mentorBot.id,
        title: title || `New Conversation ${new Date().toLocaleDateString()}`
      })
      .select('*')
      .single()

    if (convError) {
      throw convError
    }

    return conversation
  }

  return { createConversation }
}