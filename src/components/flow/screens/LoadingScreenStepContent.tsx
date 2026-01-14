'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS } from '@/config/flow'
import { MentorAvatar } from '../shared/MentorAvatar'
import { MentorBadge } from '../shared/MentorBadge'

interface LoadingScreenStepContentProps {
  step: any
  onComplete: (diagnosisScreens: string[]) => void
  sessionId?: string
  flowId?: string
}

/**
 * Loading screen displayed while AI generates comprehensive diagnosis.
 * Features mentor avatar with pulsing animation and typing messages.
 */
export function LoadingScreenStepContent({ step, onComplete, sessionId, flowId = 'growthoperator' }: LoadingScreenStepContentProps) {
  // Message cycling state
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'paused' | 'done'>('typing')

  // Diagnosis state
  const [diagnosisReady, setDiagnosisReady] = useState(false)
  const [diagnosisScreens, setDiagnosisScreens] = useState<string[]>([])
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs to prevent double-calls
  const fetchedRef = useRef(false)
  const hasCalledComplete = useRef(false)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Messages from flow config (with fallbacks)
  const messages = step.loadingMessages || {}
  const initialMessages = messages.initial || [
    'Analyzing your responses...',
    'Identifying patterns in your journey...',
    'This is interesting...',
    'Connecting the dots...',
    'I see what happened here...',
    'Preparing your diagnosis...',
  ]
  const waitingLoopMessages = messages.waiting || [
    'Almost there...',
    'Just a moment longer...',
    'Putting the finishing touches...',
    'This is taking a bit longer than usual...',
    'Still working on it...',
    'Hang tight...',
  ]
  const readyMessage = messages.ready || "Alright it's ready... let's dive in."

  // Track if we're showing the ready message
  const [showingReadyMessage, setShowingReadyMessage] = useState(false)

  // Get current message based on index
  const getCurrentMessage = () => {
    if (showingReadyMessage) return readyMessage
    // First loop through initial messages
    if (currentMessageIndex < initialMessages.length) {
      return initialMessages[currentMessageIndex]
    }
    // After initial messages, loop through waiting messages
    const loopIndex = (currentMessageIndex - initialMessages.length) % waitingLoopMessages.length
    return waitingLoopMessages[loopIndex]
  }

  // Fetch diagnosis from API
  useEffect(() => {
    if (fetchedRef.current || !sessionId) return
    fetchedRef.current = true

    async function fetchDiagnosis() {
      try {
        const res = await fetch('/api/generate/diagnosis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, promptKey: 'diagnosis-comprehensive' })
        })

        if (!res.ok) {
          if (res.status === 400) {
            setError('Your session data is incomplete. Please restart the assessment.')
          } else if (res.status === 429) {
            setError('Too many requests. Please wait a moment and try again.')
          } else {
            setError('Failed to generate your diagnosis. Please try again.')
          }
          return
        }

        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          // Split on double newline (SSE event separator) or single newline
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            // SSE format: data: {...}
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6)
              if (jsonStr === '[DONE]') continue
              try {
                const data = JSON.parse(jsonStr)
                // AI SDK 6.0 format: {"type": "text", "value": "..."}
                if (data.type === 'text' && typeof data.value === 'string') {
                  fullText += data.value
                }
                // AI SDK 6.0 alternative: {"type": "text", "content": "..."}
                else if (data.type === 'text' && typeof data.content === 'string') {
                  fullText += data.content
                }
                // AI SDK 5.0 format: {"type": "text-delta", "delta": "..."}
                else if (data.type === 'text-delta' && typeof data.delta === 'string') {
                  fullText += data.delta
                }
              } catch { /* skip invalid JSON */ }
            }
            // Legacy UI stream format: 0:"text chunk"
            else if (trimmedLine.startsWith('0:')) {
              try {
                const textChunk = JSON.parse(trimmedLine.slice(2))
                if (typeof textChunk === 'string') {
                  fullText += textChunk
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const trimmedLine = buffer.trim()
          if (trimmedLine.startsWith('data: ')) {
            const jsonStr = trimmedLine.slice(6)
            if (jsonStr !== '[DONE]') {
              try {
                const data = JSON.parse(jsonStr)
                // AI SDK 6.0 format: {"type": "text", "value": "..."}
                if (data.type === 'text' && typeof data.value === 'string') {
                  fullText += data.value
                }
                // AI SDK 6.0 alternative: {"type": "text", "content": "..."}
                else if (data.type === 'text' && typeof data.content === 'string') {
                  fullText += data.content
                }
                // AI SDK 5.0 format: {"type": "text-delta", "delta": "..."}
                else if (data.type === 'text-delta' && typeof data.delta === 'string') {
                  fullText += data.delta
                }
              } catch { /* skip invalid JSON */ }
            }
          } else if (trimmedLine.startsWith('0:')) {
            try {
              const textChunk = JSON.parse(trimmedLine.slice(2))
              if (typeof textChunk === 'string') {
                fullText += textChunk
              }
            } catch { /* skip invalid JSON */ }
          }
        }

        const screens: string[] = []
        const regex = /<screen_(\d+)>([\s\S]*?)<\/screen_\d+>/g
        let match
        while ((match = regex.exec(fullText)) !== null) {
          screens[parseInt(match[1]) - 1] = match[2].trim()
        }

        // Filter out any undefined entries (in case of non-sequential screen numbers)
        const validScreens = screens.filter(s => s !== undefined)

        if (validScreens.length > 0) {
          setDiagnosisScreens(validScreens)
          setDiagnosisReady(true)
        } else {
          // Check if the response indicates an error
          if (fullText.length === 0 || fullText.includes('error') || fullText.includes('Overloaded')) {
            setError('Our AI is currently experiencing high demand. Please try again in a moment.')
          } else {
            setError('Failed to generate your diagnosis. Please try again.')
          }
        }
      } catch {
        setError('Something went wrong. Please try again.')
      }
    }

    fetchDiagnosis()
  }, [sessionId])

  // Typing animation - only handles typing characters
  useEffect(() => {
    if (phase !== 'typing') return

    const currentMessage = getCurrentMessage()
    if (!currentMessage) return

    if (displayedText.length < currentMessage.length) {
      const typeSpeed = 30 + Math.random() * 20
      const timeout = setTimeout(() => {
        setDisplayedText(prev => currentMessage.slice(0, prev.length + 1))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setPhase('paused')
    }
  }, [phase, displayedText, currentMessageIndex, showingReadyMessage])

  // Handle pause between messages - separate effect to avoid cleanup issues
  useEffect(() => {
    if (phase !== 'paused') return

    // If showing ready message and done typing, trigger transition
    if (showingReadyMessage) {
      const fadeTimer = setTimeout(() => {
        setIsTransitioning(true)
      }, 1500)
      return () => clearTimeout(fadeTimer)
    }

    // Wait then move to next message (or show ready message if API done)
    const pauseDuration = 2500 + Math.random() * 1000

    transitionTimeoutRef.current = setTimeout(() => {
      // Check if diagnosis is ready - if so, show ready message
      if (diagnosisReady && diagnosisScreens.length > 0) {
        setShowingReadyMessage(true)
        setDisplayedText('')
        setPhase('typing')
      } else {
        // Move to next waiting message (loops)
        setCurrentMessageIndex(prev => prev + 1)
        setDisplayedText('')
        setPhase('typing')
      }
    }, pauseDuration)

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [phase, showingReadyMessage, diagnosisReady, diagnosisScreens.length])

  // Call onComplete after fade out
  useEffect(() => {
    if (!isTransitioning || hasCalledComplete.current) return
    hasCalledComplete.current = true

    const completeTimer = setTimeout(() => {
      onComplete(diagnosisScreens)
    }, 600)

    return () => clearTimeout(completeTimer)
  }, [isTransitioning, diagnosisScreens, onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isTransitioning ? 0 : 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: COLORS.BACKGROUND,
      }}
    >
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '500px',
        margin: '0 auto',
        width: '100%',
        padding: '60px 24px 48px',
      }}>
        {/* Avatar with spinning circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          style={{
            marginBottom: '24px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '120px',
            height: '120px',
          }}
        >
          {/* Spinning gradient ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0deg, ${COLORS.ACCENT} 60deg, transparent 120deg)`,
              opacity: 0.8,
            }}
          />

          {/* Inner mask to create ring effect */}
          <div
            style={{
              position: 'absolute',
              width: '108px',
              height: '108px',
              borderRadius: '50%',
              backgroundColor: COLORS.BACKGROUND,
            }}
          />

          {/* Avatar */}
          <div
            style={{
              borderRadius: '50%',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <MentorAvatar size={100} flowId={flowId} />
          </div>
        </motion.div>

        {/* Name + Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
          style={{ marginBottom: '40px' }}
        >
          <MentorBadge flowId={flowId} />
        </motion.div>

        {/* Typing message or Error */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{
            minHeight: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: '16px',
          }}
        >
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'center' }}
            >
              <p style={{
                fontFamily: "'Lora', Charter, Georgia, serif",
                fontSize: '18px',
                color: '#666',
                marginBottom: '16px',
              }}>
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null)
                  fetchedRef.current = false
                  // Trigger re-fetch by changing a dependency
                  window.location.reload()
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: COLORS.ACCENT,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                  fontFamily: "'Lora', Charter, Georgia, serif",
                  fontSize: '20px',
                  fontWeight: '400',
                  color: '#222',
                  textAlign: 'center',
                  lineHeight: '1.6',
                  fontStyle: 'italic',
                }}
              >
                {displayedText}
                {phase === 'typing' && <span className="typing-cursor" style={{ color: '#222' }} />}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
