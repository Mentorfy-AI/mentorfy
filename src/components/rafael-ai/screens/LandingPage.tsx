'use client'

import { motion } from 'framer-motion'
import { VideoEmbed } from '../shared/VideoEmbed'
import { MentorAvatar } from '../shared/MentorAvatar'
import { MentorBadge } from '../shared/MentorBadge'
import { MentorfyWatermark } from '../shared/MentorfyWatermark'
import { mentor } from '@/data/rafael-ai/mentor'

const ACCENT_COLOR = '#10B981'
const BACKGROUND_COLOR = '#FAF6F0'

interface HeadlineWithAccentProps {
  text: string
}

// Helper to render headline with $2k-$10k in green
function HeadlineWithAccent({ text }: HeadlineWithAccentProps) {
  // Split on the dollar amount pattern
  const parts = text.split(/(\$2k-\$10k)/i)

  return (
    <>
      {parts.map((part, i) => {
        if (part.toLowerCase() === '$2k-$10k') {
          return (
            <span key={i} style={{ color: ACCENT_COLOR }}>
              {part}
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
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: BACKGROUND_COLOR,
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '24px 24px 0',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
      }}>
        {/* Avatar */}
        <div style={{ marginBottom: '10px' }}>
          <MentorAvatar size={64} />
        </div>

        {/* Name + Badge */}
        <div style={{ marginBottom: '14px' }}>
          <MentorBadge />
        </div>

        {/* Headline - $2k-$10k in green */}
        <h1 style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: '24px',
          fontWeight: '600',
          color: '#000000',
          lineHeight: '1.35',
          margin: '0 0 8px 0',
          maxWidth: '540px',
        }}>
          <HeadlineWithAccent text={mentor.welcome.headline} />
        </h1>

        {/* Subheadline */}
        <p style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: '15px',
          fontWeight: '400',
          color: '#666666',
          lineHeight: '1.5',
          margin: '0 0 20px 0',
        }}>
          {mentor.welcome.subheadline}
        </p>

        {/* Video */}
        <div style={{ marginBottom: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <VideoEmbed url={mentor.welcome.videoUrl} maxWidth="560px" />
        </div>

        {/* Button - Green with hover animation */}
        <motion.button
          onClick={onStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            backgroundColor: ACCENT_COLOR,
            color: '#FFFFFF',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '400px',
            fontFamily: "'Geist', -apple-system, sans-serif",
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          {mentor.welcome.buttonText} →
        </motion.button>

        {/* Social Proof */}
        <div style={{
          marginTop: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <span style={{ color: ACCENT_COLOR, fontSize: '13px', letterSpacing: '2px' }}>★★★★★</span>
          <span style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '13px',
            color: '#888888',
          }}>
            Trusted by 500+ tattoo artists
          </span>
        </div>

        {/* Watermark */}
        <MentorfyWatermark />
      </div>
    </div>
  )
}
