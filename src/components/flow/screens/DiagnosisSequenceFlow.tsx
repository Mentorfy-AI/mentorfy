'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClientMarkdown } from '@/components/shared/ClientMarkdown'
import { InlineWidget } from 'react-calendly'
import { GlassHeader } from '../shared/GlassHeader'
import { GlassBackButton } from '../shared/GlassBackButton'
import { COLORS } from '@/config/flow'
import { useAnalytics } from '@/hooks/useAnalytics'
import { getCalendlyUrlWithSession } from '@/lib/calendly'

function normalizeMarkdown(content: string): string {
  return content.replace(/([^\n])\n?(## )/g, '$1\n\n$2')
}

interface DiagnosisSequenceFlowProps {
  screens: string[]
  calendlyUrl?: string
  onBack?: () => void
  flowId?: string
  sessionId?: string
  generationDurationMs?: number
  availableCapital?: string
}

/**
 * DiagnosisSequenceFlow - A nested flow component for multi-screen diagnosis.
 *
 * ARCHITECTURE NOTE: This component implements a "nested flow" pattern where it
 * manages its own internal navigation state independently from the parent PhaseFlow.
 *
 * Key behaviors:
 * - Renders its own GlassHeader and StepProgress (parent hides theirs)
 * - Manages 8 screens with independent back/forward navigation
 * - Progress shows 1-8 instead of continuing from question count
 * - Typing animation on first visit, instant display on revisit
 * - Calendly embed appears on final screen
 *
 * This pattern was chosen to keep the diagnosis experience self-contained,
 * but adds complexity. Consider refactoring if more nested flows are needed.
 * See: bd issue for future refactoring considerations.
 */
export function DiagnosisSequenceFlow({ screens, calendlyUrl, onBack, flowId = 'growthoperator', sessionId, generationDurationMs = 0, availableCapital }: DiagnosisSequenceFlowProps) {
  // Analytics
  const analytics = useAnalytics({ session_id: sessionId || '', flow_id: flowId })
  const diagnosisStartTimeRef = useRef<number>(Date.now())
  const screenStartTimeRef = useRef<number>(Date.now())
  const previousScreenIndexRef = useRef<number | null>(null)
  const diagnosisStartedFiredRef = useRef(false)
  const diagnosisCompletedFiredRef = useRef(false)
  const ctaViewedFiredRef = useRef(false)
  const firedScrollThresholdsRef = useRef<Set<number>>(new Set())

  const [currentScreenIndex, setCurrentScreenIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [visitedScreens, setVisitedScreens] = useState<Set<number>>(new Set([0]))
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [typingComplete, setTypingComplete] = useState(false)

  const currentScreen = screens[currentScreenIndex] || ''
  const isLastScreen = currentScreenIndex === screens.length - 1
  const hasVisited = visitedScreens.has(currentScreenIndex)
  const totalScreens = screens.length || 8

  // Fire diagnosis_started on mount
  useEffect(() => {
    if (!diagnosisStartedFiredRef.current) {
      diagnosisStartedFiredRef.current = true
      diagnosisStartTimeRef.current = Date.now()
      analytics.trackDiagnosisStarted({
        generationDurationMs,
        totalQuestionsAnswered: 17,
      })
    }
  }, [])

  // Fire diagnosis_screen_viewed on screen change
  useEffect(() => {
    const timeOnPrevious = previousScreenIndexRef.current !== null
      ? Date.now() - screenStartTimeRef.current
      : null

    analytics.trackDiagnosisScreenViewed({
      screenIndex: currentScreenIndex,
      screenTotal: totalScreens,
      timeOnPreviousScreenMs: timeOnPrevious,
      isFinalScreen: currentScreenIndex === totalScreens - 1,
    })

    // Reset for next screen
    screenStartTimeRef.current = Date.now()
    previousScreenIndexRef.current = currentScreenIndex
    firedScrollThresholdsRef.current = new Set()

    // Fire diagnosis_completed and cta_viewed when reaching final screen
    if (currentScreenIndex === totalScreens - 1) {
      if (!diagnosisCompletedFiredRef.current) {
        diagnosisCompletedFiredRef.current = true
        const totalTime = Date.now() - diagnosisStartTimeRef.current
        analytics.trackDiagnosisCompleted({
          totalDiagnosisTimeMs: totalTime,
          screensViewed: totalScreens,
          averageTimePerScreenMs: Math.round(totalTime / totalScreens),
        })
      }
      if (!ctaViewedFiredRef.current) {
        ctaViewedFiredRef.current = true
        analytics.trackCtaViewed({
          ctaType: 'calendly_booking',
          timeSinceDiagnosisStartMs: Date.now() - diagnosisStartTimeRef.current,
          diagnosisScreensViewed: totalScreens,
        })
      }
    }
  }, [currentScreenIndex])

  // Scroll tracking handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const scrollHeight = el.scrollHeight - el.clientHeight
    if (scrollHeight <= 0) return // No scrollable content

    const scrollPercent = Math.round((el.scrollTop / scrollHeight) * 100)
    const thresholds = [25, 50, 75, 100] as const

    for (const threshold of thresholds) {
      if (scrollPercent >= threshold && !firedScrollThresholdsRef.current.has(threshold)) {
        firedScrollThresholdsRef.current.add(threshold)
        analytics.trackDiagnosisScreenScrolled({
          screenIndex: currentScreenIndex,
          scrollDepthPercent: threshold,
          timeToReachDepthMs: Date.now() - screenStartTimeRef.current,
        })
      }
    }
  }, [currentScreenIndex, analytics])

  useEffect(() => {
    if (hasVisited && currentScreenIndex !== 0) {
      setDisplayedText(currentScreen)
      setIsTyping(false)
      setTypingComplete(true)
    } else {
      setDisplayedText('')
      setIsTyping(true)
      setTypingComplete(false)
      setVisitedScreens(prev => new Set([...prev, currentScreenIndex]))
    }
  }, [currentScreenIndex, currentScreen])

  useEffect(() => {
    if (!isTyping || !currentScreen) return

    if (displayedText.length < currentScreen.length) {
      const typeSpeed = 6 + Math.random() * 6
      const charsToAdd = 3
      const timeout = setTimeout(() => {
        setDisplayedText(currentScreen.slice(0, displayedText.length + charsToAdd))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setIsTyping(false)
      setTypingComplete(true)
    }
  }, [isTyping, displayedText, currentScreen])

  const goToNextScreen = () => {
    if (currentScreenIndex < screens.length - 1) {
      setDirection(1)
      setCurrentScreenIndex(currentScreenIndex + 1)
    }
  }

  const goToPreviousScreen = () => {
    if (currentScreenIndex > 0) {
      setDirection(-1)
      setCurrentScreenIndex(currentScreenIndex - 1)
    }
  }

  const screenVariants = {
    initial: { opacity: 0, x: direction * 60 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } },
    exit: { opacity: 0, x: direction * -60, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const } }
  }

  return (
    <div
      onScroll={handleScroll}
      style={{
        backgroundColor: COLORS.BACKGROUND,
        minHeight: '100vh',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      {/* Glass Header - ALWAYS visible (avatar + pill) */}
      <GlassHeader flowId={flowId} />

      {/* Glass Back Button - only visible after first screen */}
      <GlassBackButton
        onClick={goToPreviousScreen}
        visible={currentScreenIndex > 0}
      />

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentScreenIndex}
          custom={direction}
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            padding: '120px 24px 120px',
          }}
        >
          <div className="diagnosis-markdown" style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}>
            <style>{`
              .diagnosis-markdown h1 { font-size: 28px; font-weight: 600; color: #000; line-height: 1.3; margin: 0 0 24px 0; }
              .diagnosis-markdown h2 { font-size: 22px; font-weight: 600; color: #000; line-height: 1.35; margin: 28px 0 16px 0; }
              .diagnosis-markdown h3 { font-size: 18px; font-weight: 600; color: #111; line-height: 1.4; margin: 24px 0 12px 0; }
              .diagnosis-markdown p { font-size: 17px; line-height: 1.75; color: #222; margin: 0 0 20px 0; }
              .diagnosis-markdown p:last-child { margin-bottom: 0; }
              .diagnosis-markdown strong { font-weight: 600; color: #000; }
              .diagnosis-markdown em { font-style: italic; color: #444; }
              .diagnosis-markdown ul, .diagnosis-markdown ol { font-size: 17px; line-height: 1.75; color: #222; margin: 0 0 16px 0; padding-left: 24px; }
              .diagnosis-markdown li { margin-bottom: 8px; }
              .diagnosis-markdown blockquote { border-left: 3px solid ${COLORS.ACCENT}; padding-left: 16px; margin: 16px 0; font-style: italic; color: #444; }
            `}</style>
            <ClientMarkdown>{normalizeMarkdown(displayedText)}</ClientMarkdown>
            {isTyping && <span className="typing-cursor" style={{ color: '#333' }} />}
          </div>

          {isLastScreen && typingComplete && calendlyUrl && availableCapital !== '<1k' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as const }}
              style={{
                width: '100%',
                margin: '32px 0',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              <InlineWidget
                url={getCalendlyUrlWithSession(calendlyUrl, sessionId)}
                styles={{ height: '700px', minWidth: '100%' }}
                pageSettings={{
                  backgroundColor: 'FAF6F0',
                  primaryColor: '10B981',
                  textColor: '1a1a1a',
                  hideEventTypeDetails: false,
                  hideLandingPageDetails: false,
                }}
              />
            </motion.div>
          )}

          {isLastScreen && typingComplete && availableCapital === '<1k' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                width: '100%',
                margin: '32px 0',
                padding: '32px 24px',
                backgroundColor: '#F5F0E8',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <p style={{
                fontFamily: "'Lora', Charter, Georgia, serif",
                fontSize: '18px',
                color: '#444',
                lineHeight: '1.6',
                margin: 0,
              }}>
                Based on what you shared, now might not be the right time for a call. Focus on building up some capital first, then come back when you're ready to invest in yourself.
              </p>
            </motion.div>
          )}

          {!isLastScreen && typingComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}
            >
              <motion.button
                onClick={goToNextScreen}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  backgroundColor: COLORS.ACCENT,
                  color: '#FFFFFF',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                Continue <span>→</span>
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
