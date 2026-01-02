"use client"

import { useState, useEffect } from 'react'

export interface MentorBot {
  id: string
  name: string
  clerk_org_id: string
  system_prompt?: string
  response_length?: string
  creativity_level?: string
}

export function useBots() {
  const [bots, setBots] = useState<MentorBot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBots()
  }, [])

  const fetchBots = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/agent-console/bots')

      if (!response.ok) {
        throw new Error('Failed to fetch bots')
      }

      const data = await response.json()
      setBots(data.bots || [])
    } catch (err) {
      console.error('Error fetching bots:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch bots')
      setBots([])
    } finally {
      setLoading(false)
    }
  }

  return {
    bots,
    loading,
    error,
    refetch: fetchBots,
  }
}
