'use client'

import { useState, useCallback } from 'react'
import { mockResponses } from '@/data/rafael-ai/mockResponses'

export function useAgent() {
  const [isLoading, setIsLoading] = useState(false)

  const getResponse = useCallback(async (promptKey: string, state: any, userMessage: string | null = null) => {
    setIsLoading(true)

    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400))

    setIsLoading(false)

    const responseFn = mockResponses[promptKey]
    if (!responseFn) {
      console.warn(`No mock response for promptKey: ${promptKey}`)
      return { message: "I hear you. Let me think about that..." }
    }

    if (typeof responseFn === 'function') {
      return responseFn(state, userMessage)
    }

    return responseFn
  }, [])

  return { getResponse, isLoading }
}
