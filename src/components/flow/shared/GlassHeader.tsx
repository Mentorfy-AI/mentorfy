'use client'

import { getFlow } from '@/data/flows'
import { useState } from 'react'
import { motion } from 'framer-motion'

const ACCENT_COLOR = '#10B981'

interface Props {
  flowId?: string
}

// New iMessage-style Glass Header
// Small avatar with glassmorphic pill underneath (name + verified badge inside)
export function GlassHeader({ flowId = 'growthoperator' }: Props) {
  const [imgError, setImgError] = useState(false)
  const flow = getFlow(flowId)

  const avatarSize = 68
  const pillOverlap = 8 // Avatar kisses the pill

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '14px',
      pointerEvents: 'none',
    }}>
      {/* Avatar */}
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
          zIndex: 2,
          pointerEvents: 'auto',
        }}
      >
        {imgError ? (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: avatarSize * 0.4,
            fontWeight: 500,
          }}>
            {flow.mentor.name[0]}
          </div>
        ) : (
          <img
            src={flow.mentor.avatar}
            alt={flow.mentor.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Glassmorphic Pill with Name + Badge */}
      <div
        style={{
          marginTop: -pillOverlap,
          paddingTop: 7,
          paddingBottom: 7,
          paddingLeft: 20,
          paddingRight: 20,
          borderRadius: 100,
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.7)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.4)',
          borderRight: '1px solid rgba(255, 255, 255, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: `
            0 2px 4px rgba(0, 0, 0, 0.04),
            0 6px 12px rgba(0, 0, 0, 0.08),
            0 12px 24px rgba(0, 0, 0, 0.08),
            0 24px 48px rgba(0, 0, 0, 0.06),
            inset 0 1px 2px rgba(255, 255, 255, 0.6),
            inset 0 -1px 2px rgba(0, 0, 0, 0.05)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          zIndex: 1,
          pointerEvents: 'auto',
        }}
      >
        <span style={{
          fontSize: 17,
          fontWeight: 700,
          color: '#000',
          fontFamily: "'Lora', Charter, Georgia, serif",
        }}>
          {flow.mentor.name}
        </span>

        {/* Verified Badge */}
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
          <g fill={ACCENT_COLOR}>
            <circle cx="12" cy="4.5" r="3.5" />
            <circle cx="17.3" cy="6.7" r="3.5" />
            <circle cx="19.5" cy="12" r="3.5" />
            <circle cx="17.3" cy="17.3" r="3.5" />
            <circle cx="12" cy="19.5" r="3.5" />
            <circle cx="6.7" cy="17.3" r="3.5" />
            <circle cx="4.5" cy="12" r="3.5" />
            <circle cx="6.7" cy="6.7" r="3.5" />
            <circle cx="12" cy="12" r="6" />
          </g>
          <path
            d="M9.5 12.5L11 14L14.5 10"
            stroke="#FFFFFF"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    </motion.div>
  )
}
