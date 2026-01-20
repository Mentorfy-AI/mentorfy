'use client'

import { motion } from 'framer-motion'
import { GlassHeader } from '../shared/GlassHeader'
import { MentorfyWatermark } from '../shared/MentorfyWatermark'
import { getFlow } from '@/data/flows'

const DEFAULT_ACCENT_COLOR = '#10B981'
const BACKGROUND_COLOR = '#FAF6F0'

interface TextWithAccentProps {
  text: string
  patterns?: string[] // Phrases to highlight
  accentColor?: string
}

// Helper to render text with {{green:...}} syntax highlighted
function TextWithAccent({ text, accentColor = DEFAULT_ACCENT_COLOR }: TextWithAccentProps) {
  // Parse {{green:...}} syntax
  const parts = text.split(/(\{\{green:[^}]+\}\})/)

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\{\{green:([^}]+)\}\}/)
        if (match) {
          return (
            <span key={i} style={{ color: accentColor, whiteSpace: 'nowrap' }}>
              {match[1]}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

interface LandingPageProps {
  onStart: () => void
  flowId?: string
}

export function LandingPage({ onStart, flowId = 'rafael-tats' }: LandingPageProps) {
  const flow = getFlow(flowId)
  const mentor = flow.mentor
  const accentColor = flow.accentColor || DEFAULT_ACCENT_COLOR

  // Stagger animation variants
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
    },
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: BACKGROUND_COLOR,
    }}>
      {/* Glass Header - ALWAYS visible (avatar + pill) */}
      <GlassHeader flowId={flowId} />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '100px 24px 0', // Extra top padding for header
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >

        {/* Callout (optional - the hook) - italic, black, bold */}
        {mentor.welcome.callout && (
          <motion.p
            variants={item}
            style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: 'clamp(16px, 4.5vw, 21px)',
              fontWeight: '600',
              fontStyle: 'italic',
              color: '#000000',
              lineHeight: '1.45',
              margin: '0 0 8px 0',
              padding: '0 8px',
            }}
          >
            <TextWithAccent
              text={mentor.welcome.callout}
              accentColor={accentColor}
            />
          </motion.p>
        )}

        {/* Headline - Large bold text, responsive sizing */}
        <motion.h1
          variants={item}
          style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: 'clamp(24px, 6vw, 30px)',
            fontWeight: '600',
            color: '#000000',
            lineHeight: '1.3',
            margin: '0 0 24px 0',
            maxWidth: '480px',
            padding: '0 8px',
            whiteSpace: 'pre-line',
          }}
        >
          <TextWithAccent
            text={mentor.welcome.headline}
            accentColor={accentColor}
          />
        </motion.h1>

        {/* Subheadline - responsive sizing */}
        {mentor.welcome.subheadline && (
          <motion.p
            variants={item}
            style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: 'clamp(16px, 4.5vw, 21px)',
              fontWeight: '400',
              color: '#666666',
              lineHeight: '1.5',
              margin: '0 0 20px 0',
              padding: '0 8px',
            }}
          >
            {mentor.welcome.subheadline}
          </motion.p>
        )}

        {/* Button - 3D raised style matching quiz buttons */}
        <motion.button
          variants={item}
          onClick={onStart}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{
            background: 'linear-gradient(to bottom, #12c48a 0%, #10B981 50%, #0ea572 100%)', // Subtle gradient for depth
            color: '#FFFFFF',
            padding: '18px 48px',
            borderRadius: '14px',
            fontSize: '17px',
            fontWeight: '600',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            cursor: 'pointer',
            fontFamily: "'Geist', -apple-system, sans-serif",
            // Stronger shadow to match quiz buttons' floating effect
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.22), 0 4px 8px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          {mentor.welcome.buttonText} →
        </motion.button>

        {/* Estimated Time - Typeform style */}
        {mentor.welcome.estimatedTime && (
          <motion.div
            variants={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '14px',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999999"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{
              fontFamily: "'Geist', -apple-system, sans-serif",
              fontSize: '13px',
              color: '#999999',
            }}>
              Takes {mentor.welcome.estimatedTime}
            </span>
          </motion.div>
        )}

        {/* Disclaimer (optional) - subtle */}
        {mentor.welcome.disclaimer && (
          <motion.p
            variants={item}
            style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '400',
              fontStyle: 'italic',
              color: '#888888',
              lineHeight: '1.5',
              margin: '24px 0 0 0',
              maxWidth: '480px',
              textAlign: 'center',
              padding: '0 8px',
            }}
          >
            {mentor.welcome.disclaimer}
          </motion.p>
        )}

        {/* Social Proof - only show if flow has socialProof configured */}
        {mentor.welcome.socialProof && (
          <motion.div
            variants={item}
            style={{
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: accentColor, fontSize: '13px', letterSpacing: '2px' }}>★★★★★</span>
            <span style={{
              fontFamily: "'Geist', -apple-system, sans-serif",
              fontSize: '13px',
              color: '#888888',
            }}>
              {mentor.welcome.socialProof}
            </span>
          </motion.div>
        )}

        {/* Watermark */}
        <motion.div variants={item}>
          <MentorfyWatermark />
        </motion.div>
      </motion.div>
    </div>
  )
}
