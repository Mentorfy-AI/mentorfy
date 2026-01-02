'use client'

import { useState, useRef, MutableRefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserProvider, useUser } from '@/context/UserContext'
import { LandingPage } from '@/components/rafael-ai/screens/LandingPage'
import { PhaseFlow } from '@/components/rafael-ai/screens/PhaseFlow'
import { MentorAvatar } from '@/components/rafael-ai/shared/MentorAvatar'
import { MentorBadge } from '@/components/rafael-ai/shared/MentorBadge'
import { TimelineShell, Panel } from '@/components/rafael-ai/layouts/TimelineShell'
import { AIChat } from '@/components/rafael-ai/screens/AIChat'
import { COLORS, TIMING, LAYOUT, PHASE_NAMES } from '@/config/rafael-ai'

// Animated checkmark component
function AnimatedCheckmark() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
        delay: 0.2
      }}
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        backgroundColor: COLORS.ACCENT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 8px 32px ${COLORS.ACCENT_SHADOW}`,
      }}
    >
      <motion.svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <motion.path
          d="M20 6L9 17l-5-5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        />
      </motion.svg>
    </motion.div>
  )
}

// Level Complete interstitial screen
function LevelCompleteScreen({ phaseNumber }: { phaseNumber: number }) {
  const phaseName = PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FAF6F0',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <AnimatedCheckmark />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        style={{
          textAlign: 'center',
        }}
      >
        <div style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: 14,
          fontWeight: 500,
          color: COLORS.ACCENT,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}>
          Phase {phaseNumber} Complete
        </div>
        <div style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: 24,
          fontWeight: 600,
          color: '#111',
        }}>
          {phaseName}
        </div>
      </motion.div>
    </motion.div>
  )
}

function RafaelAIContent() {
  const { state, dispatch } = useUser()
  const [arrowReady, setArrowReady] = useState(false)
  const [showLevelComplete, setShowLevelComplete] = useState(false)
  const [completedPhaseNumber, setCompletedPhaseNumber] = useState<number | null>(null)

  // Ref for PhaseFlow's back handler - allows stationary header to control internal navigation
  const levelFlowBackRef = useRef<(() => void) | null>(null)

  // Ref for the Chat Panel's scroll container - passed to AIChat for scroll control
  const chatPanelScrollRef = useRef<HTMLDivElement>(null)

  // Screen states: 'welcome', 'level-flow', 'experience'
  const currentScreen = state.progress.currentScreen
  const currentPhaseNumber = state.progress.currentPhase
  const currentPanel = state.timeline?.currentPanel ?? 0

  const setPanel = (panel: number) => dispatch({ type: 'SET_PANEL', payload: panel })

  // Arrow becomes ready when AIChat loads
  const handleArrowReady = () => setArrowReady(true)

  // Handle the continue button click - Chat → PhaseFlow
  const handleContinueClick = () => {
    if (currentPanel === 0) {
      setPanel(1) // Chat → PhaseFlow
    }
  }

  // Welcome → Level Flow (fullscreen)
  const handleStartFromWelcome = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'level-flow' })
  }

  // Initial Level Complete (fullscreen Phase 1) → Show celebration → Experience Shell
  const handleInitialLevelComplete = () => {
    // Store which phase was just completed
    setCompletedPhaseNumber(currentPhaseNumber)
    // Show the level complete screen
    setShowLevelComplete(true)

    // After showing the celebration, transition to experience shell
    setTimeout(() => {
      // Set panel to 0 FIRST before changing screen
      setPanel(0)
      // Mark phase complete (this increments currentPhase)
      dispatch({ type: 'COMPLETE_PHASE', payload: currentPhaseNumber })
      // Reset arrow state for the new cycle
      setArrowReady(false)
      // Go to Experience Shell, Chat panel (panel 0)
      dispatch({ type: 'SET_SCREEN', payload: 'experience' })

      // Hide the level complete screen after chat is ready
      setTimeout(() => {
        setShowLevelComplete(false)
        setCompletedPhaseNumber(null)
      }, TIMING.LEVEL_COMPLETE_FADE)
    }, TIMING.LEVEL_COMPLETE_DURATION)
  }

  // Panel Level Complete (Panel 1 PhaseFlow) → Show completion screen → Chat
  const handlePanelLevelComplete = () => {
    // Store which phase was just completed
    setCompletedPhaseNumber(currentPhaseNumber)
    // Show the level complete screen
    setShowLevelComplete(true)

    // After showing the celebration, transition to chat
    setTimeout(() => {
      // Complete the phase (this increments currentPhase)
      dispatch({ type: 'COMPLETE_PHASE', payload: currentPhaseNumber })
      setArrowReady(false)
      // Switch to chat panel
      setPanel(0)

      // Hide the level complete screen after chat is ready
      setTimeout(() => {
        setShowLevelComplete(false)
        setCompletedPhaseNumber(null)
      }, TIMING.LEVEL_COMPLETE_FADE)
    }, TIMING.LEVEL_COMPLETE_DURATION)
  }

  // Back from PhaseFlow panel → Chat panel
  const handleBackFromPhaseFlow = () => {
    setPanel(0)
  }

  // Stationary header back button - behavior depends on current panel
  const handleHeaderBack = () => {
    if (currentPanel === 1) {
      // On PhaseFlow - use ref to call internal back handler
      if (levelFlowBackRef.current) {
        levelFlowBackRef.current()
      }
    }
    // Panel 0 (Chat) - back button is dimmed, no action
  }

  // Should the header back button be dimmed?
  const isHeaderBackDimmed = currentPanel === 0

  // Get button text based on current phase
  const getPhaseButtonText = (): string => {
    if (currentPhaseNumber > 4) return 'Journey Complete'
    return `Continue to Phase ${currentPhaseNumber}`
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Geist', sans-serif" }}>
      <AnimatePresence mode="wait">
        {/* LANDING PAGE */}
        {currentScreen === 'welcome' && (
          <LandingPage
            key="welcome"
            onStart={handleStartFromWelcome}
          />
        )}

        {/* PHASE FLOW (fullscreen - initial Phase 1) */}
        {currentScreen === 'level-flow' && (
          <PhaseFlow
            key={`level-${currentPhaseNumber}`}
            levelId={currentPhaseNumber}
            onComplete={handleInitialLevelComplete}
          />
        )}

        {/* EXPERIENCE SHELL (Chat + PhaseFlow, 2 panels) */}
        {currentScreen === 'experience' && (
          <div key="experience" style={{ position: 'relative' }}>
            {/* Stationary header - stays fixed while ALL panels slide */}
            <div style={{
              position: 'fixed',
              top: 6,
              left: 0,
              right: 0,
              zIndex: 100,
              display: 'flex',
              justifyContent: 'center',
              padding: '0 20px',
            }}>
              <div style={{
                width: '100%',
                maxWidth: '720px',
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              }}>
                {/* Back button - behavior changes based on panel */}
                <button
                  onClick={isHeaderBackDimmed ? undefined : handleHeaderBack}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    color: '#666',
                    background: '#F0EBE4',
                    border: '1px solid #E8E3DC',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    cursor: isHeaderBackDimmed ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isHeaderBackDimmed ? 0.3 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Center - Avatar + Label */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}>
                  <MentorAvatar size={40} />
                  <MentorBadge size="large" />
                </div>

                {/* Account button - dimmed */}
                <button
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    color: '#666',
                    background: '#F0EBE4',
                    border: '1px solid #E8E3DC',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    cursor: 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.35,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
              </div>
            </div>

            <TimelineShell
              currentPanel={currentPanel}
              onPanelChange={setPanel}
            >
              {/* Panel 0: AIChat (home base) */}
              <Panel scrollRef={chatPanelScrollRef}>
                <AIChat
                  onArrowReady={handleArrowReady}
                  currentPhase={currentPhaseNumber}
                  scrollContainerRef={chatPanelScrollRef}
                  continueReady={arrowReady}
                  onContinue={handleContinueClick}
                />
              </Panel>

              {/* Panel 1: PhaseFlow (the work) */}
              {/* Only render PhaseFlow if there's a valid phase (1-4), otherwise show placeholder */}
              <Panel>
                <AnimatePresence mode="wait">
                  {currentPhaseNumber <= 4 ? (
                    <motion.div
                      key="level-flow"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.2 } }}
                      style={{ minHeight: '100vh' }}
                    >
                      <PhaseFlow
                        levelId={currentPhaseNumber}
                        onComplete={handlePanelLevelComplete}
                        onBack={handleBackFromPhaseFlow}
                        backHandlerRef={levelFlowBackRef as MutableRefObject<(() => void) | null>}
                        hideHeader={true}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.3 } }}
                      style={{
                        backgroundColor: '#FAF6F0',
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        fontFamily: "'Lora', serif"
                      }}
                    >
                      More levels coming soon...
                    </motion.div>
                  )}
                </AnimatePresence>
              </Panel>
            </TimelineShell>


          </div>
        )}

      </AnimatePresence>

      {/* Level Complete interstitial - OUTSIDE screen blocks so it can show during transitions */}
      <AnimatePresence mode="wait">
        {showLevelComplete && completedPhaseNumber && (
          <LevelCompleteScreen key="level-complete-overlay" phaseNumber={completedPhaseNumber} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function RafaelAI() {
  return (
    <UserProvider>
      <RafaelAIContent />
    </UserProvider>
  )
}
