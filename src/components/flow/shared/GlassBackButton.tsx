'use client'

import { motion } from 'framer-motion'

interface Props {
  onClick: () => void
  visible?: boolean
}

// Floating glassmorphic back button
// Matches the glass pill styling, vertically centered with avatar
export function GlassBackButton({ onClick, visible = true }: Props) {
  if (!visible) return null

  // Avatar is 68px tall, starts at paddingTop 14px
  // Avatar center = 14 + 34 = 48px from top
  // Button is 40px tall, so top = 48 - 20 = 28px
  const buttonSize = 40

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={onClick}
      style={{
        position: 'fixed',
        top: 35,
        left: 20,
        zIndex: 101,
        width: buttonSize,
        height: buttonSize,
        borderRadius: '50%',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: `
          0 2px 4px rgba(0, 0, 0, 0.04),
          0 6px 12px rgba(0, 0, 0, 0.08),
          0 12px 24px rgba(0, 0, 0, 0.08),
          inset 0 1px 2px rgba(255, 255, 255, 0.6),
          inset 0 -1px 2px rgba(0, 0, 0, 0.05)
        `,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000',
        transition: 'transform 0.15s ease',
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </motion.button>
  )
}
