'use client'

import { LiquidGlassHeader } from '../shared/LiquidGlassHeader'
import { NextArrow } from '../shared/NextArrow'
import { LevelFlow } from './LevelFlow'
import { useUser } from '@/context/UserContext'

interface FutureViewProps {
  onNavigateToPresent: () => void
  onLevelComplete?: () => void
}

export function FutureView({ onNavigateToPresent, onLevelComplete }: FutureViewProps) {
  const { state, dispatch } = useUser()

  const handleBack = () => {
    onNavigateToPresent()
  }

  const handleLevelComplete = () => {
    // Advance to next level
    dispatch({
      type: 'SET_CURRENT_LEVEL',
      payload: state.progress.currentLevel + 1
    })
    onLevelComplete?.()
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#FAF6F0',
    }}>
      <LiquidGlassHeader onBack={handleBack} />

      {/* Level Flow - takes over the screen (no chat bar) */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LevelFlow
          levelId={state.progress?.currentLevel || 1}
          onComplete={handleLevelComplete}
          onBack={handleBack}
        />
      </div>

      {/* Navigate left arrow */}
      <NextArrow
        direction="left"
        label="Chat"
        onClick={onNavigateToPresent}
      />

      {/* NO ChatInputBar - this is focus mode */}
    </div>
  )
}
