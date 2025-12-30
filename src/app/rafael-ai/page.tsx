'use client'

import { useState, useRef, MutableRefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserProvider, useUser } from '@/context/UserContext'
import { WelcomeScreen } from '@/components/rafael-ai/screens/WelcomeScreen'
import { LevelFlow } from '@/components/rafael-ai/screens/LevelFlow'
import { ActiveChat } from '@/components/rafael-ai/screens/ActiveChat'
import { Avatar } from '@/components/rafael-ai/shared/Avatar'
import { RafaelLabel } from '@/components/rafael-ai/shared/RafaelLabel'

// Experience Shell with 3 panels (Past + Present + Future)
import { ExperienceShell, Panel } from '@/components/rafael-ai/layouts/ExperienceShell'
import { PastView } from '@/components/rafael-ai/screens/PastView'
import { PresentView } from '@/components/rafael-ai/screens/PresentView'

const ACCENT_COLOR = '#10B981'

function RafaelAIContent() {
  const { state, dispatch } = useUser()
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null)
  const [arrowReady, setArrowReady] = useState(false)

  // Ref for LevelFlow's back handler - allows stationary header to control internal navigation
  const levelFlowBackRef = useRef<(() => void) | null>(null)

  // Screen states: 'welcome', 'level-flow', 'experience', 'chat'
  const currentScreen = state.progress.currentScreen
  const currentLevelNumber = state.progress.currentLevel
  const currentPanel = state.timeline?.currentPanel ?? 0

  const setPanel = (panel: number) => dispatch({ type: 'SET_PANEL', payload: panel })

  // Arrow becomes ready when PastView typing completes or PresentView loads
  const handleArrowReady = () => setArrowReady(true)

  // Handle the stationary arrow click based on current panel
  const handleArrowClick = () => {
    if (currentPanel === 0) {
      // On Past panel → go to Present panel
      setPanel(1)
    } else if (currentPanel === 1) {
      // On Present panel → go to Future panel (Level Flow)
      setPanel(2)
    }
    // No arrow action on panel 2 (Level Flow has its own flow)
  }

  // Welcome → Level Flow (fullscreen)
  const handleStartFromWelcome = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'level-flow' })
  }

  // Initial Level Complete (fullscreen Level 1) → Transition to Experience Shell
  const handleInitialLevelComplete = () => {
    // Mark level complete (this increments currentLevel)
    dispatch({ type: 'COMPLETE_LEVEL', payload: currentLevelNumber })
    // Reset arrow state for the new cycle
    setArrowReady(false)
    // Go to Experience Shell, Past view (panel 0)
    setPanel(0)
    dispatch({ type: 'SET_SCREEN', payload: 'experience' })
  }

  // Panel Level Complete (Panel 2) → Stay in Experience, go to Past view
  const handlePanelLevelComplete = () => {
    // Mark level complete (this increments currentLevel)
    dispatch({ type: 'COMPLETE_LEVEL', payload: currentLevelNumber })
    // Reset arrow state for the new cycle
    setArrowReady(false)
    // Go back to Past view (panel 0) - already in experience screen
    setPanel(0)
  }

  // Back from Level Flow panel → Present panel
  const handleBackFromLevelFlow = () => {
    setPanel(1)
  }

  // Stationary header back button - behavior depends on current panel
  const handleHeaderBack = () => {
    if (currentPanel === 1) {
      setPanel(0) // Present → Past
    } else if (currentPanel === 2) {
      // On Level Flow - use ref to call internal back handler
      if (levelFlowBackRef.current) {
        levelFlowBackRef.current()
      }
    }
    // Panel 0 (Past) - back button is dimmed, no action
  }

  // Should the header back button be dimmed?
  const isHeaderBackDimmed = currentPanel === 0

  // Navigate between panels
  const handleNavigateToPast = () => setPanel(0)
  const handleNavigateToPresent = () => setPanel(1)
  const handleNavigateToFuture = () => setPanel(2)

  // Chat handlers - typing from Past navigates to Present panel
  const handleStartChatFromPast = (message: string) => {
    setPendingChatMessage(message)
    setPanel(1) // Go to Present panel
  }

  const handleCloseChat = () => {
    setPendingChatMessage(null)
    dispatch({ type: 'SET_SCREEN', payload: 'experience' })
    setPanel(1) // Return to Present
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Geist', sans-serif" }}>
      <AnimatePresence mode="wait">
        {/* WELCOME SCREEN */}
        {currentScreen === 'welcome' && (
          <WelcomeScreen
            key="welcome"
            onStart={handleStartFromWelcome}
          />
        )}

        {/* LEVEL FLOW (fullscreen - initial Level 1) */}
        {currentScreen === 'level-flow' && (
          <LevelFlow
            key={`level-${currentLevelNumber}`}
            levelId={currentLevelNumber}
            onComplete={handleInitialLevelComplete}
          />
        )}

        {/* EXPERIENCE SHELL (Past + Present + Future, 3 panels) */}
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
                  <Avatar size={40} />
                  <RafaelLabel size="large" />
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

            <ExperienceShell
              currentPanel={currentPanel}
              onPanelChange={setPanel}
            >
              {/* Panel 0: Past (Journey) */}
              <Panel>
                <PastView
                  onNavigateToPresent={handleNavigateToPresent}
                  onStartChat={handleStartChatFromPast}
                  onArrowReady={handleArrowReady}
                  currentLevel={currentLevelNumber}
                />
              </Panel>

              {/* Panel 1: Present (Chat) */}
              <Panel>
                <PresentView
                  onNavigateToPast={handleNavigateToPast}
                  onStartNextLevel={handleNavigateToFuture}
                  initialMessage={pendingChatMessage}
                  onMessageHandled={() => setPendingChatMessage(null)}
                  onArrowReady={handleArrowReady}
                  currentLevel={currentLevelNumber}
                />
              </Panel>

              {/* Panel 2: Future (Level Flow) - stationary header controls navigation via ref */}
              {/* Only render LevelFlow if there's a valid level (1 or 2), otherwise show empty panel */}
              <Panel>
                <AnimatePresence mode="wait">
                  {currentLevelNumber <= 2 ? (
                    <motion.div
                      key="level-flow"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.2 } }}
                      style={{ minHeight: '100vh' }}
                    >
                      <LevelFlow
                        levelId={currentLevelNumber}
                        onComplete={handlePanelLevelComplete}
                        onBack={handleBackFromLevelFlow}
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
            </ExperienceShell>

            {/* Stationary arrow button - only visible on panels 0 and 1 */}
            {currentPanel < 2 && (() => {
              // Check if there are more levels (only levels 1 and 2 exist)
              const noMoreLevels = currentLevelNumber > 2
              // Arrow is active unless on Chat panel with no more levels
              const isArrowActive = arrowReady && !(currentPanel === 1 && noMoreLevels)

              return (
              <div style={{
                position: 'fixed',
                bottom: 130,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 50,
              }}>
                <div style={{
                  width: '100%',
                  maxWidth: '720px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '0 20px',
                }}>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: isArrowActive ? 1 : 0.3,
                      scale: 1,
                    }}
                    onClick={isArrowActive ? handleArrowClick : undefined}
                    disabled={!isArrowActive}
                    whileTap={isArrowActive ? { scale: 0.95 } : {}}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: isArrowActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #E8E3DC',
                      background: isArrowActive ? ACCENT_COLOR : '#F0EBE4',
                      boxShadow: isArrowActive
                        ? '0 4px 20px rgba(16, 185, 129, 0.5), 0 2px 8px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                        : '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                      cursor: isArrowActive ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.4s ease',
                      animation: isArrowActive ? 'glowPulse 2s infinite' : 'none',
                      pointerEvents: 'auto',
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isArrowActive ? '#FFFFFF' : '#999'}
                      strokeWidth={2.5}
                      style={{ transition: 'stroke 0.4s ease' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </div>
              </div>
              )
            })()}

            {/* CSS for glow animation */}
            <style>{`
              @keyframes glowPulse {
                0%, 100% {
                  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5), 0 2px 8px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }
                50% {
                  box-shadow: 0 4px 28px rgba(16, 185, 129, 0.7), 0 2px 12px rgba(16, 185, 129, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }
              }
            `}</style>
          </div>
        )}

        {/* ACTIVE CHAT (fullscreen) */}
        {currentScreen === 'chat' && (
          <ActiveChat
            key="chat"
            initialMessage={pendingChatMessage ?? undefined}
            onBack={handleCloseChat}
          />
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
