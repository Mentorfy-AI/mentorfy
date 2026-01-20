'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS } from '@/config/flow'
import { VideoEmbed } from '../shared/VideoEmbed'
import { getFlow } from '@/data/flows'
import { useAnalytics } from '@/hooks/useAnalytics'

interface LoadingScreenStepContentProps {
  step: any
  onComplete: (diagnosisScreens: string[]) => void
  sessionId?: string
  flowId?: string
}

/**
 * Loading screen displayed while AI generates comprehensive diagnosis.
 * When step.videoKey is present, shows video + loading messages.
 * Otherwise shows the legacy avatar spinner.
 */
export function LoadingScreenStepContent({ step, onComplete, sessionId, flowId = 'growthoperator' }: LoadingScreenStepContentProps) {
  // Analytics
  const analytics = useAnalytics({ session_id: sessionId || '', flow_id: flowId })
  const loadingStartTimeRef = useRef<number>(Date.now())
  const loadingCompletedFiredRef = useRef(false)

  // Intro animation sequence state
  const [introPhase, setIntroPhase] = useState<'typing-intro' | 'showing-video' | 'loading-messages'>('typing-intro')
  const [introDisplayedText, setIntroDisplayedText] = useState('')

  // Message cycling state
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'paused' | 'done'>('typing')

  // Diagnosis state
  const [diagnosisReady, setDiagnosisReady] = useState(false)
  const [diagnosisScreens, setDiagnosisScreens] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Refs to prevent double-calls
  const fetchedRef = useRef(false)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get video URL if videoKey is provided
  const flow = getFlow(flowId)
  const video = step.videoKey ? (flow.mentor as any).videos?.[step.videoKey] : null
  const hasVideo = !!video?.url

  // Fire loading_started on mount
  useEffect(() => {
    analytics.trackLoadingStarted()
    loadingStartTimeRef.current = Date.now()
  }, [])

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

  // Get current message based on index
  const getCurrentMessage = () => {
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
          body: JSON.stringify({ sessionId, promptKey: step.promptKey || 'diagnosis-comprehensive' })
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

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6)
              if (jsonStr === '[DONE]') continue
              try {
                const data = JSON.parse(jsonStr)
                if (data.type === 'text' && typeof data.value === 'string') {
                  fullText += data.value
                } else if (data.type === 'text' && typeof data.content === 'string') {
                  fullText += data.content
                } else if (data.type === 'text-delta' && typeof data.delta === 'string') {
                  fullText += data.delta
                }
              } catch { /* skip invalid JSON */ }
            } else if (trimmedLine.startsWith('0:')) {
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
                if (data.type === 'text' && typeof data.value === 'string') {
                  fullText += data.value
                } else if (data.type === 'text' && typeof data.content === 'string') {
                  fullText += data.content
                } else if (data.type === 'text-delta' && typeof data.delta === 'string') {
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

        const validScreens = screens.filter(s => s !== undefined)

        if (validScreens.length > 0) {
          setDiagnosisScreens(validScreens)
          setDiagnosisReady(true)
          setPhase('done')
          if (!loadingCompletedFiredRef.current) {
            loadingCompletedFiredRef.current = true
            analytics.trackLoadingCompleted({
              loadingDurationMs: Date.now() - loadingStartTimeRef.current,
              generationSuccess: true,
              errorMessage: null,
            })
          }
        } else {
          const errorMsg = fullText.length === 0 || fullText.includes('error') || fullText.includes('Overloaded')
            ? 'Our AI is currently experiencing high demand. Please try again in a moment.'
            : 'Failed to generate your diagnosis. Please try again.'
          setError(errorMsg)
          if (!loadingCompletedFiredRef.current) {
            loadingCompletedFiredRef.current = true
            analytics.trackLoadingCompleted({
              loadingDurationMs: Date.now() - loadingStartTimeRef.current,
              generationSuccess: false,
              errorMessage: errorMsg,
            })
          }
        }
      } catch (e) {
        const errorMsg = 'Something went wrong. Please try again.'
        setError(errorMsg)
        if (!loadingCompletedFiredRef.current) {
          loadingCompletedFiredRef.current = true
          analytics.trackLoadingCompleted({
            loadingDurationMs: Date.now() - loadingStartTimeRef.current,
            generationSuccess: false,
            errorMessage: e instanceof Error ? e.message : errorMsg,
          })
        }
      }
    }

    fetchDiagnosis()
  }, [sessionId])

  // Typing animation - only handles typing characters (only when not done)
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
  }, [phase, displayedText, currentMessageIndex])

  // Handle pause between messages (only when not done)
  useEffect(() => {
    if (phase !== 'paused' || diagnosisReady) return

    const pauseDuration = 2500 + Math.random() * 1000

    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentMessageIndex(prev => prev + 1)
      setDisplayedText('')
      setPhase('typing')
    }, pauseDuration)

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [phase, diagnosisReady])

  // Intro text typing animation (for video layout)
  useEffect(() => {
    if (!hasVideo || introPhase !== 'typing-intro' || !step.introText) return

    const introText = step.introText
    if (introDisplayedText.length < introText.length) {
      const typeSpeed = 8 + Math.random() * 8
      const timeout = setTimeout(() => {
        setIntroDisplayedText(introText.slice(0, introDisplayedText.length + 1))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      // Done typing intro, show video after a brief pause
      const pauseTimeout = setTimeout(() => {
        setIntroPhase('showing-video')
      }, 500)
      return () => clearTimeout(pauseTimeout)
    }
  }, [hasVideo, introPhase, introDisplayedText, step.introText])

  // Transition from video to loading messages
  useEffect(() => {
    if (!hasVideo || introPhase !== 'showing-video') return

    // Wait for video to fade in, then start loading messages
    const timeout = setTimeout(() => {
      setIntroPhase('loading-messages')
    }, 1500)
    return () => clearTimeout(timeout)
  }, [hasVideo, introPhase])

  // Handle continue button click
  const handleContinue = () => {
    onComplete(diagnosisScreens)
  }

  // Video layout with loading messages below
  if (hasVideo) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
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
          maxWidth: '600px',
          margin: '0 auto',
          width: '100%',
          padding: '140px 24px 48px',
        }}>
          {/* Intro text - types in first (matches question styling) */}
          {step.introText && (
            <div style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: '18px',
              fontWeight: '500',
              color: '#000',
              textAlign: 'left',
              lineHeight: '1.5',
              marginBottom: '24px',
              width: '100%',
            }}>
              {introDisplayedText}
              {introPhase === 'typing-intro' && <span className="typing-cursor" />}
            </div>
          )}

          {/* Video - fades in after intro text */}
          <AnimatePresence>
            {(introPhase === 'showing-video' || introPhase === 'loading-messages') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                  width: '100%',
                  marginBottom: '32px',
                }}
              >
                <VideoEmbed url={video.url} maxWidth="100%" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading messages or Ready state - appears after video */}
          <AnimatePresence>
            {introPhase === 'loading-messages' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{
                  minHeight: '100px',
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
            ) : diagnosisReady ? (
              // Ready state with Continue button
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                }}
              >
                <p style={{
                  fontFamily: "'Lora', Charter, Georgia, serif",
                  fontSize: '20px',
                  fontWeight: '400',
                  fontStyle: 'italic',
                  color: '#222',
                  textAlign: 'center',
                }}>
                  Alright, it's ready.
                </p>
                <motion.button
                  onClick={handleContinue}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: '16px 48px',
                    backgroundColor: COLORS.ACCENT,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '17px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'Geist', -apple-system, sans-serif",
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  Continue
                </motion.button>
              </motion.div>
            ) : (
              // Loading state with typing messages
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMessageIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{
                    fontFamily: "'Lora', Charter, Georgia, serif",
                    fontSize: '18px',
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
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    )
  }

  // Legacy layout (no video) - kept for backward compatibility
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
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
        {/* Simple loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, rotate: 360 }}
          transition={{
            opacity: { duration: 0.3 },
            rotate: { duration: 1, repeat: Infinity, ease: 'linear' }
          }}
          style={{
            marginBottom: '40px',
            width: '60px',
            height: '60px',
            border: `3px solid ${COLORS.ACCENT}20`,
            borderTopColor: COLORS.ACCENT,
            borderRadius: '50%',
          }}
        />

        {/* Typing message or Error */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
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
          ) : diagnosisReady ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <p style={{
                fontFamily: "'Lora', Charter, Georgia, serif",
                fontSize: '20px',
                fontWeight: '400',
                fontStyle: 'italic',
                color: '#222',
              }}>
                Alright, it's ready.
              </p>
              <motion.button
                onClick={handleContinue}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '16px 48px',
                  backgroundColor: COLORS.ACCENT,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '17px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
                Continue
              </motion.button>
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

        {/* Time estimate */}
        {!error && !diagnosisReady && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{
              fontFamily: "'Geist', -apple-system, sans-serif",
              fontSize: '14px',
              color: '#999',
              textAlign: 'center',
              marginTop: '24px',
            }}
          >
            This usually takes around 90 seconds.
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
