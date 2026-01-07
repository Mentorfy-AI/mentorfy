'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface LevelCompleteTransitionProps {
  level: number
  onComplete: () => void
}

export function LevelCompleteTransition({ level, onComplete }: LevelCompleteTransitionProps) {
  // Auto-dismiss after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: '#FAF6F0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}
    >
      {/* Subtle decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
        style={{
          width: '60px',
          height: '1px',
          backgroundColor: '#10B981',
          marginBottom: '8px',
        }}
      />

      {/* Level number */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#10B981',
        }}
      >
        Level {level}
      </motion.div>

      {/* Complete text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
        style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: '32px',
          fontWeight: 500,
          color: '#111',
          letterSpacing: '-0.01em',
        }}
      >
        Complete
      </motion.div>

      {/* Bottom decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.32, 0.72, 0, 1] }}
        style={{
          width: '60px',
          height: '1px',
          backgroundColor: '#10B981',
          marginTop: '8px',
        }}
      />
    </motion.div>
  )
}
