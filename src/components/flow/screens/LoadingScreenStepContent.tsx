'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '@/config/flow'

interface LoadingScreenStepContentProps {
  step: any
  onComplete: (diagnosisScreens: string[]) => void
  sessionId?: string
}

/**
 * Loading screen displayed while AI generates comprehensive diagnosis.
 * Shows animated pulsing rings and cycles through loading messages.
 * Fetches diagnosis in background and waits for minimum display time.
 */
export function LoadingScreenStepContent({ step, onComplete, sessionId }: LoadingScreenStepContentProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [diagnosisReady, setDiagnosisReady] = useState(false)
  const [diagnosisScreens, setDiagnosisScreens] = useState<string[]>([])
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const fetchedRef = useRef(false)

  const messages = step.loadingMessages || [
    'Analyzing your responses...',
    'Identifying patterns...',
    'Generating your personalized diagnosis...',
  ]
  const minDuration = step.minDuration || 12000

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), minDuration)
    return () => clearTimeout(timer)
  }, [minDuration])

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
          console.error('Diagnosis fetch failed:', res.status)
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
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            // UI message stream format: text chunks start with "0:" followed by JSON string
            if (line.startsWith('0:')) {
              try {
                const textChunk = JSON.parse(line.slice(2))
                if (typeof textChunk === 'string') {
                  fullText += textChunk
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }

        const screens: string[] = []
        const regex = /<screen_(\d+)>([\s\S]*?)<\/screen_\d+>/g
        let match
        while ((match = regex.exec(fullText)) !== null) {
          screens[parseInt(match[1]) - 1] = match[2].trim()
        }

        setDiagnosisScreens(screens)
        setDiagnosisReady(true)
      } catch (err) {
        console.error('Diagnosis fetch error:', err)
      }
    }
    fetchDiagnosis()
  }, [sessionId])

  useEffect(() => {
    if (diagnosisReady && minTimeElapsed && diagnosisScreens.length > 0) {
      onComplete(diagnosisScreens)
    }
  }, [diagnosisReady, minTimeElapsed, diagnosisScreens, onComplete])

  useEffect(() => {
    const currentMessage = messages[currentMessageIndex]
    if (!currentMessage) return

    if (displayedText.length < currentMessage.length) {
      const typeSpeed = 30 + Math.random() * 20
      const timeout = setTimeout(() => {
        setDisplayedText(currentMessage.slice(0, displayedText.length + 1))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setIsTyping(false)
      const timeout = setTimeout(() => {
        const nextIndex = (currentMessageIndex + 1) % messages.length
        setCurrentMessageIndex(nextIndex)
        setDisplayedText('')
        setIsTyping(true)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [displayedText, currentMessageIndex, messages])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: COLORS.BACKGROUND,
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '500px',
        margin: '0 auto',
        width: '100%',
        padding: '100px 24px 48px',
      }}>
        <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '48px' }}>
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${COLORS.ACCENT}` }}
          />
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
            style={{ position: 'absolute', inset: '15px', borderRadius: '50%', border: `2px solid ${COLORS.ACCENT}` }}
          />
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: '30px',
              borderRadius: '50%',
              backgroundColor: COLORS.ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
              <path d="M12 11v6" />
              <path d="M8 15h8" />
              <circle cx="12" cy="19" r="2" />
              <path d="M9 6.5a2.5 2.5 0 0 0-5 0v2a2.5 2.5 0 0 0 5 0" />
              <path d="M15 6.5a2.5 2.5 0 0 1 5 0v2a2.5 2.5 0 0 1-5 0" />
            </svg>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: '22px',
            fontWeight: '500',
            color: '#222',
            textAlign: 'center',
            lineHeight: '1.5',
            minHeight: '66px',
          }}
        >
          {displayedText}
          {isTyping && <span className="typing-cursor" style={{ color: '#333' }} />}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1 }}
          style={{
            marginTop: '40px',
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '14px',
            color: '#999',
            textAlign: 'center',
          }}
        >
          This usually takes 10-15 seconds
        </motion.p>
      </div>
    </div>
  )
}
