'use client'

import { motion } from 'framer-motion'
import { Avatar } from '../shared/Avatar'
import { RafaelLabel } from '../shared/RafaelLabel'
import { ChatInputBar } from '../shared/ChatInputBar'
import { useUser } from '@/context/UserContext'

const ACCENT_COLOR = '#10B981'

// Static content for Chat Home
const HOME_CONTENT = {
  opener: "Nice work, you've just completed Level 1.",
  headline: "You're closer than you think.",
  aboveFold: [
    "You came in charging $1k-$2k, dreaming about $5k-$10k sessions and a calendar booked months out. That gap feels massive from where you're standing.",
    "But here's what I see: the gap isn't skill. Your work is already good enough.",
    "The gap is the story you've been telling yourself about why you can't have what they have.",
    "Level 2 is where we break that story."
  ],
  buttonText: 'Continue to Level 2 →',
  subtleText: "Or talk to me — I'm here whenever you need.",
  sections: [
    {
      title: "What I see in you",
      paragraphs: [
        "Most artists who come to me describe their problem as \"pricing\" or \"getting more clients.\" But that's the surface. Here's what I actually see when I look at your situation:",
        "You've been creating to impress other artists — not to attract the clients who'd pay $5k to book you. That's why your results feel random. You're optimizing for the wrong audience.",
        "You told me you watch artists charging $5k-$10k and think they've \"cracked some code\" you can't see. Here's the truth: there's no code. They just decided they were worth it before they felt ready. The fear you feel? They felt it too. They just moved anyway.",
        "You're not behind. You're not missing something. You're standing at a door you haven't walked through yet.",
        "That's different."
      ]
    },
    {
      title: "The shift that's already happening",
      paragraphs: [
        "When you started this, you thought the problem was pricing.",
        "Now you're starting to see it's something deeper — it's how you see yourself and how you let the right people see you.",
        "That reframe? That's not small. That's the foundation everything else gets built on.",
        "You're not the same person who started Level 1. You just might not feel it yet.",
        "Keep going. The feeling catches up."
      ]
    }
  ]
}

interface ChatHomeProps {
  onStartLevel: (level: number) => void
  onStartChat: (message: string) => void
}

export function ChatHome({ onStartLevel, onStartChat }: ChatHomeProps) {
  const { state } = useUser()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#FAF6F0',
    }}>
      {/* Header - Liquid Glass (matching ActiveChat) */}
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
          {/* Back Arrow - Dimmed/Disabled */}
          <div
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
              opacity: 0.3,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>

          {/* Center - Avatar + Rafael Label */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <Avatar size={40} />
            <RafaelLabel size="large" />
          </div>

          {/* Account Icon */}
          <button
            onClick={() => console.log('Account clicked')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              color: '#666',
              background: '#F0EBE4',
              border: '1px solid #E8E3DC',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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

      {/* Scrollable Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '120px 20px 200px' }}>
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ============ ABOVE THE FOLD ============ */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                fontFamily: "'Lora', Charter, Georgia, serif",
              }}
            >
              {/* Opener - body text */}
              <p style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#111',
                margin: 0,
                marginBottom: '20px',
                fontFamily: "'Lora', Charter, Georgia, serif",
              }}>
                {HOME_CONTENT.opener}
              </p>

              {/* Main Headline */}
              <h1 style={{
                fontSize: '22px',
                lineHeight: '1.35',
                color: '#000',
                margin: 0,
                fontWeight: '600',
                fontFamily: "'Lora', Charter, Georgia, serif",
              }}>
                {HOME_CONTENT.headline}
              </h1>

              {/* Above fold paragraphs */}
              {HOME_CONTENT.aboveFold.map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: '17px',
                    lineHeight: '1.7',
                    color: '#111',
                    margin: 0,
                    marginTop: '20px',
                  }}
                >
                  {paragraph}
                </p>
              ))}

              {/* CTA Button - Green */}
              <motion.button
                onClick={() => onStartLevel(state.progress.currentLevel)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  width: '100%',
                  marginTop: '32px',
                  padding: '16px 24px',
                  borderRadius: '14px',
                  background: ACCENT_COLOR,
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4), 0 2px 8px rgba(16, 185, 129, 0.3)',
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                {HOME_CONTENT.buttonText}
              </motion.button>

              {/* Subtle Text Below Button - Lora font, warm */}
              <p style={{
                fontSize: '15px',
                lineHeight: '1.5',
                color: '#888',
                margin: 0,
                marginTop: '16px',
                textAlign: 'center',
                fontFamily: "'Lora', Charter, Georgia, serif",
              }}>
                {HOME_CONTENT.subtleText}
              </p>
            </motion.div>

            {/* ============ BELOW THE FOLD ============ */}
            {HOME_CONTENT.sections.map((section, sectionIndex) => (
              <motion.div
                key={sectionIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + sectionIndex * 0.1, duration: 0.4 }}
                style={{
                  fontFamily: "'Lora', Charter, Georgia, serif",
                }}
              >
                {/* Divider before each section */}
                <hr style={{
                  border: 'none',
                  borderTop: '1px solid #E5E0D8',
                  margin: '48px 0',
                }} />

                {/* Section Header */}
                <h3 style={{
                  fontSize: '19px',
                  lineHeight: '1.35',
                  color: '#000',
                  margin: 0,
                  fontWeight: '600',
                  fontFamily: "'Lora', Charter, Georgia, serif",
                }}>
                  {section.title}
                </h3>

                {/* Section paragraphs */}
                {section.paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: '17px',
                      lineHeight: '1.7',
                      color: '#111',
                      margin: 0,
                      marginTop: '20px',
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Input Bar - Fixed at bottom, Liquid Glass */}
      <ChatInputBar
        placeholder="Message Rafael..."
        onSend={(message) => onStartChat(message)}
      />
    </div>
  )
}
