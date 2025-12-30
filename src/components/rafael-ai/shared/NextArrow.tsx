'use client'

import { motion } from 'framer-motion'

const ACCENT_COLOR = '#10B981'

interface Props {
  direction?: 'left' | 'right'
  onClick?: () => void
  label?: string
}

export function NextArrow({ direction = 'right', onClick, label }: Props) {
  const isLeft = direction === 'left'
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: 'absolute',
        [isLeft ? 'left' : 'right']: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        padding: '12px 20px',
        borderRadius: '14px',
        background: ACCENT_COLOR,
        border: 'none',
        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
        fontSize: '15px',
        fontWeight: '500',
        fontFamily: "'Geist', -apple-system, sans-serif",
        color: '#FFFFFF',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 10,
      }}
    >
      {isLeft && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      )}
      {label}
      {!isLeft && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </motion.button>
  )
}
