'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VideoEmbed } from '../shared/VideoEmbed'
import { Avatar } from '../shared/Avatar'
import { RafaelLabel } from '../shared/RafaelLabel'
import { ChatInputBar } from '../shared/ChatInputBar'
import { WhopCheckoutEmbed } from '@whop/checkout/react'
import { InlineWidget, useCalendlyEventListener } from 'react-calendly'
import { mentor } from '@/data/rafael-ai/mentor'
import { useUser } from '@/context/UserContext'
import { useAgent } from '@/hooks/useAgent'

const ACCENT_COLOR = '#10B981'

// Mock video response for pricing-related questions
const PRICING_KEYWORDS = ['pricing', 'charge', 'rates', 'money', 'price', 'cost']
const MOCK_VIDEO_RESPONSE = {
  message: `This is the question that changes everything.

Most artists think about pricing backwards — they look at what other people charge and try to fit somewhere in the middle. That's why they stay stuck.

I made a video that breaks down exactly how I think about this:

[VIDEO]

Skip to 2:47 if you want the part about handling the "that's too expensive" objection — that's probably where you're getting stuck.

But here's what I want you to sit with: price isn't about what you're worth. It's about who you want to attract.

When you charge $1k, you get $1k clients. When you charge $5k, you don't get fewer people — you get *different* people. People who value the work differently. People who show up differently.

So let me ask you: what would change in your business if every client who booked you was genuinely excited to pay your rate?`,
  videoUrl: 'https://rafaeltats.wistia.com/medias/4i06zkj7fg'
}

// Check if message contains pricing keywords
function containsPricingKeyword(message: string) {
  const lowerMessage = message.toLowerCase()
  return PRICING_KEYWORDS.some(keyword => lowerMessage.includes(keyword))
}

// Mock checkout response for "sell me" trigger
const SELL_ME_KEYWORDS = ['sell me']
const MOCK_CHECKOUT_RESPONSE = {
  message: `Here's the deal.

You've done Level 1. You know where you're stuck. You've seen the gap between where you are and where you want to be.

Level 2 is where we close that gap.

Inside, I'm going to show you exactly how to set your prices so the right clients find you — and pay without flinching. This isn't theory. This is the exact framework I used to go from $500 tattoos to $10k sessions.

You'll learn:
• Why undercharging is costing you the clients you actually want
• The positioning shift that makes price objections disappear
• How to raise your rates without losing your current bookings

This is $100. One session at your new rate will pay for it 10x over.

[CHECKOUT]

No risk. If you go through Level 2 and don't feel like it was worth 10x what you paid, message me. I'll make it right.

But I don't think that's going to happen. I think you're going to look back at this as the moment things started to shift.`,
  checkoutPlanId: 'plan_joNwbFAIES0hH'
}

// Check if message contains "sell me" keywords
function containsSellMeKeyword(message: string) {
  const lowerMessage = message.toLowerCase()
  return SELL_ME_KEYWORDS.some(keyword => lowerMessage.includes(keyword))
}

// Mock Calendly response for "book me" trigger
const BOOK_ME_KEYWORDS = ['book me', 'book a call', 'schedule a call', "let's talk"]
const MOCK_CALENDLY_RESPONSE = {
  message: `Let's do it.

Here's the deal with these calls: I don't do sales pitches. I'm going to look at where you are, where you want to be, and tell you exactly what I'd do if I were in your position.

If it makes sense to work together, I'll tell you. If it doesn't, I'll tell you that too — and point you in the right direction.

30 minutes. No fluff. Pick a time that works:

[CALENDLY]

Once you book, you'll get a confirmation with a link to join. Show up ready to talk specifics — the more context you give me, the more I can help.

See you soon.`,
  calendlyUrl: 'https://calendly.com/brady-mentorfy/30min'
}

// Check if message contains "book me" keywords
function containsBookMeKeyword(message: string) {
  const lowerMessage = message.toLowerCase()
  return BOOK_ME_KEYWORDS.some(keyword => lowerMessage.includes(keyword))
}

interface UserBubbleProps {
  children: ReactNode
}

// User message bubble - green, right-aligned
function UserBubble({ children }: UserBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', justifyContent: 'flex-end' }}
    >
      <div style={{
        backgroundColor: ACCENT_COLOR,
        color: '#FFFFFF',
        padding: '14px 18px',
        borderRadius: '18px 18px 6px 18px',
        maxWidth: '75%',
        fontSize: '15px',
        lineHeight: '1.5',
        fontFamily: "'Geist', -apple-system, sans-serif",
        boxShadow: '0 6px 28px rgba(16, 185, 129, 0.55)',
      }}>
        {children}
      </div>
    </motion.div>
  )
}

interface CopyButtonProps {
  content: string
}

// Copy button component
function CopyButton({ content }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '6px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        color: copied ? ACCENT_COLOR : '#999',
        fontSize: '12px',
        fontFamily: "'Geist', -apple-system, sans-serif",
        transition: 'all 0.15s ease',
      }}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontWeight: '500' }}>Copied</span>
        </>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </motion.button>
  )
}

interface RafaelMessageProps {
  children: ReactNode
  content?: string
  thinkingTime?: number
}

// Rafael message - no container, Lora font, full width
function RafaelMessage({ children, content, thinkingTime }: RafaelMessageProps) {
  // Format time as seconds with 2 decimal places
  const formatTime = (ms: number | undefined) => {
    if (!ms) return null
    return (ms / 1000).toFixed(2) + 's'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}
    >
      {children}
      {content && (
        <div style={{
          marginTop: '8px',
          marginLeft: '-8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <CopyButton content={content} />
          {thinkingTime && (
            <span style={{
              fontFamily: "'Geist', -apple-system, sans-serif",
              fontSize: '13px',
              color: '#999',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTime(thinkingTime)}
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}

interface ThinkingIndicatorProps {
  onTimeUpdate?: (ms: number) => void
}

// Thinking indicator with green shimmer animation and timer
function ThinkingIndicator({ onTimeUpdate }: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const ms = now - startTimeRef.current
      setElapsed(ms)
      onTimeUpdate?.(ms)
    }, 10) // Update every 10ms for smooth display

    return () => clearInterval(interval)
  }, [onTimeUpdate])

  // Format as seconds with 2 decimal places
  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + 's'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span
        style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: '17px',
          fontWeight: '600',
          color: '#111',
          display: 'inline-block',
          backgroundImage: `linear-gradient(90deg, #111 0%, #111 42%, ${ACCENT_COLOR} 46%, ${ACCENT_COLOR} 54%, #111 58%, #111 100%)`,
          backgroundSize: '300% 100%',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'shimmer 0.6s linear infinite',
        }}
      >
        Thinking...
      </span>
      <span
        style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '13px',
          color: '#999',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(elapsed)}
      </span>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: 0% 0;
          }
        }
      `}</style>
    </motion.div>
  )
}

interface InlineVideoEmbedProps {
  url: string
  isVisible: boolean
}

// Inline Video Embed component for streaming messages
function InlineVideoEmbed({ url, isVisible }: InlineVideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Extract video info from URL
  const getVideoInfo = (url: string) => {
    if (!url) return null

    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/)
    if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }

    // Wistia
    const wistiaMatch = url.match(/wistia\.com\/medias\/([^?/]+)/)
    if (wistiaMatch) return { provider: 'wistia', id: wistiaMatch[1] }

    return null
  }

  const video = getVideoInfo(url)
  if (!video) return null

  const thumbnailUrl = video.provider === 'youtube'
    ? `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`
    : `https://fast.wistia.com/embed/medias/${video.id}/swatch`

  const embedUrl = video.provider === 'youtube'
    ? `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`
    : `https://fast.wistia.net/embed/iframe/${video.id}?autoplay=1`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.97 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: '12px',
        overflow: 'hidden',
        margin: '20px 0',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
        cursor: isPlaying ? 'default' : 'pointer',
        position: 'relative',
        backgroundColor: '#000',
      }}
      onClick={() => !isPlaying && setIsPlaying(true)}
    >
      {isPlaying ? (
        <iframe
          src={embedUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Video"
        />
      ) : (
        <>
          {/* Thumbnail */}
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          {/* Dark overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            transition: 'background-color 0.2s ease',
          }} />
          {/* Play button */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.2s ease',
            }}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="#000"
                style={{ marginLeft: '3px' }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {/* Bottom gradient */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '80px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
          }} />
        </>
      )}
    </motion.div>
  )
}

interface InlineCheckoutEmbedProps {
  planId: string
  isVisible: boolean
  onComplete?: (planId: string, receiptId: string) => void
}

// Inline Checkout Embed component for streaming messages
function InlineCheckoutEmbed({ planId, isVisible, onComplete }: InlineCheckoutEmbedProps) {
  const [purchaseComplete, setPurchaseComplete] = useState(false)

  const handleComplete = (completedPlanId: string, receiptId: string) => {
    console.log('Purchase complete:', completedPlanId, receiptId)
    setPurchaseComplete(true)
    onComplete?.(completedPlanId, receiptId)
  }

  if (purchaseComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          width: '100%',
          margin: '20px 0',
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          textAlign: 'center',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '8px',
        }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT_COLOR}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: '18px',
            fontWeight: '600',
            color: ACCENT_COLOR,
          }}>
            Payment successful!
          </span>
        </div>
        <p style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '14px',
          color: '#666',
          margin: 0,
        }}>
          You now have access to Level 2. Let&apos;s get started.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.98 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        width: '100%',
        margin: '20px 0',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: '#FAF6F0',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Branded header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, #FDFBF8, #FAF6F0)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: ACCENT_COLOR,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 12px rgba(16, 185, 129, 0.4), 0 8px 24px rgba(16, 185, 129, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)`,
            transform: 'translateY(-1px)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: '15px',
              fontWeight: '600',
              color: '#111',
            }}>
              Level 2: Pricing Psychology
            </div>
            <div style={{
              fontFamily: "'Geist', -apple-system, sans-serif",
              fontSize: '12px',
              color: '#666',
              marginTop: '2px',
            }}>
              One-time purchase
            </div>
          </div>
        </div>
        <div style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '20px',
          fontWeight: '600',
          color: '#111',
        }}>
          $100
        </div>
      </div>

      {/* Checkout embed with warmer background */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '4px',
      }}>
        <WhopCheckoutEmbed
          planId={planId}
          theme="light"
          skipRedirect={true}
          onComplete={handleComplete}
        />
      </div>

      {/* Trust footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: 'linear-gradient(to top, #FDFBF8, #FAF6F0)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '11px',
          color: '#888',
          letterSpacing: '0.02em',
        }}>
          Secure checkout powered by Whop
        </span>
      </div>
    </motion.div>
  )
}

interface InlineCalendlyEmbedProps {
  url: string
  isVisible: boolean
  onEventScheduled?: (payload: any) => void
}

// Inline Calendly Embed component for streaming messages
function InlineCalendlyEmbed({ url, isVisible, onEventScheduled }: InlineCalendlyEmbedProps) {
  const [booked, setBooked] = useState(false)

  useCalendlyEventListener({
    onEventScheduled: (e) => {
      console.log('Call booked!', e.data.payload)
      setBooked(true)
      onEventScheduled?.(e.data.payload)
    },
  })

  if (booked) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          width: '100%',
          margin: '20px 0',
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          textAlign: 'center',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '8px',
        }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT_COLOR}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: '18px',
            fontWeight: '600',
            color: ACCENT_COLOR,
          }}>
            Call booked!
          </span>
        </div>
        <p style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '14px',
          color: '#666',
          margin: 0,
        }}>
          Check your email for the confirmation and meeting link.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.98 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        width: '100%',
        margin: '20px 0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <InlineWidget
        url={url}
        styles={{ height: '700px', minWidth: '100%' }}
        pageSettings={{
          backgroundColor: 'FAF6F0',
          primaryColor: '10B981',
          textColor: '1a1a1a',
          hideEventTypeDetails: false,
          hideLandingPageDetails: false,
        }}
      />
    </motion.div>
  )
}

// Parse inline markdown (bold, italic)
function parseInlineMarkdown(text: string): ReactNode[] {
  // Handle bold and italic
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: '600', color: '#111' }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

// Blinking cursor component
function BlinkingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      style={{
        display: 'inline-block',
        width: '2px',
        height: '1em',
        backgroundColor: ACCENT_COLOR,
        marginLeft: '2px',
        verticalAlign: 'text-bottom',
      }}
    />
  )
}

interface StreamingRafaelMessageProps {
  content: string
  videoUrl?: string
  checkoutPlanId?: string
  calendlyUrl?: string
  onComplete?: () => void
  onCheckoutComplete?: (planId: string, receiptId: string) => void
  onCalendlyBooked?: (payload: any) => void
}

// Streaming message component - shows text character by character
function StreamingRafaelMessage({ content, videoUrl, checkoutPlanId, calendlyUrl, onComplete, onCheckoutComplete, onCalendlyBooked }: StreamingRafaelMessageProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [videoVisible, setVideoVisible] = useState(false)
  const [checkoutVisible, setCheckoutVisible] = useState(false)
  const [calendlyVisible, setCalendlyVisible] = useState(false)
  const streamSpeed = 5 // ms per character
  const videoMarker = '[VIDEO]'
  const checkoutMarker = '[CHECKOUT]'
  const calendlyMarker = '[CALENDLY]'
  const videoShownRef = useRef(false)
  const checkoutShownRef = useRef(false)
  const calendlyShownRef = useRef(false)

  useEffect(() => {
    if (!content) return

    let index = 0
    let interval: NodeJS.Timeout | undefined
    let isPaused = false

    const startStreaming = () => {
      interval = setInterval(() => {
        if (isPaused) return

        if (index < content.length) {
          const currentText = content.slice(0, index + 1)

          // Check if we just revealed the video marker
          if (currentText.includes(videoMarker) && !videoShownRef.current) {
            setDisplayedText(currentText)
            isPaused = true
            clearInterval(interval)
            videoShownRef.current = true

            // Brief pause, then show video
            setTimeout(() => {
              setVideoVisible(true)
              // Continue streaming after video appears
              setTimeout(() => {
                isPaused = false
                index++
                startStreaming()
              }, 300) // 300ms pause after video appears
            }, 100)
            return
          }

          // Check if we just revealed the checkout marker
          if (currentText.includes(checkoutMarker) && !checkoutShownRef.current) {
            setDisplayedText(currentText)
            isPaused = true
            clearInterval(interval)
            checkoutShownRef.current = true

            // Brief pause, then show checkout
            setTimeout(() => {
              setCheckoutVisible(true)
              // Continue streaming after checkout appears
              setTimeout(() => {
                isPaused = false
                index++
                startStreaming()
              }, 300) // 300ms pause after checkout appears
            }, 100)
            return
          }

          // Check if we just revealed the calendly marker
          if (currentText.includes(calendlyMarker) && !calendlyShownRef.current) {
            setDisplayedText(currentText)
            isPaused = true
            clearInterval(interval)
            calendlyShownRef.current = true

            // Brief pause, then show calendly
            setTimeout(() => {
              setCalendlyVisible(true)
              // Continue streaming after calendly appears
              setTimeout(() => {
                isPaused = false
                index++
                startStreaming()
              }, 300) // 300ms pause after calendly appears
            }, 100)
            return
          }

          setDisplayedText(currentText)
          index++
        } else {
          clearInterval(interval)
          setIsComplete(true)
          onComplete?.()
        }
      }, streamSpeed)
    }

    startStreaming()

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [content, onComplete])

  // Parse the displayed text for rendering
  const blocks = displayedText.split('\n\n').filter(p => p.trim())

  const renderStreamingBlock = (block: string, index: number) => {
    const isFirst = index === 0
    const marginTop = isFirst ? 0 : '20px'
    const isLastBlock = index === blocks.length - 1

    // Check for video marker
    if (block.trim() === '[VIDEO]' || block.includes('[VIDEO]')) {
      return (
        <InlineVideoEmbed
          key={index}
          url={videoUrl || ''}
          isVisible={videoVisible}
        />
      )
    }

    // Check for checkout marker
    if (block.trim() === '[CHECKOUT]' || block.includes('[CHECKOUT]')) {
      return (
        <InlineCheckoutEmbed
          key={index}
          planId={checkoutPlanId || ''}
          isVisible={checkoutVisible}
          onComplete={onCheckoutComplete}
        />
      )
    }

    // Check for calendly marker
    if (block.trim() === '[CALENDLY]' || block.includes('[CALENDLY]')) {
      return (
        <InlineCalendlyEmbed
          key={index}
          url={calendlyUrl || ''}
          isVisible={calendlyVisible}
          onEventScheduled={onCalendlyBooked}
        />
      )
    }

    // Check for horizontal rule
    if (block.trim() === '---' || block.trim() === '***' || block.trim() === '___') {
      return (
        <hr key={index} style={{
          border: 'none',
          borderTop: '1px solid #E5E5E5',
          margin: '24px 0',
        }} />
      )
    }

    // Check for ## headline
    if (block.startsWith('## ')) {
      return (
        <h2 key={index} style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#000',
          lineHeight: '1.3',
          margin: 0,
          marginTop: isFirst ? 0 : '16px',
          marginBottom: '16px',
        }}>
          {block.slice(3)}
          {isLastBlock && !isComplete && <BlinkingCursor />}
        </h2>
      )
    }

    // Check for numbered list
    const lines = block.split('\n')
    const numberedItems = lines.filter(line => /^\d+\.\s/.test(line.trim()))
    if (numberedItems.length > 0 && numberedItems.length === lines.filter(l => l.trim()).length) {
      return (
        <ol key={index} style={{
          fontSize: '17px',
          lineHeight: '1.7',
          color: '#111',
          margin: 0,
          marginTop: '16px',
          paddingLeft: '8px',
          listStyle: 'none',
        }}>
          {numberedItems.map((item, i) => {
            const text = item.replace(/^\d+\.\s/, '')
            const isLastItem = isLastBlock && i === numberedItems.length - 1
            return (
              <li key={i} style={{ marginBottom: '10px', display: 'flex', gap: '12px' }}>
                <span style={{ color: ACCENT_COLOR, fontWeight: '600', flexShrink: 0 }}>{i + 1}.</span>
                <span>
                  {parseInlineMarkdown(text)}
                  {isLastItem && !isComplete && <BlinkingCursor />}
                </span>
              </li>
            )
          })}
        </ol>
      )
    }

    // Check for bullet list
    const bulletItems = lines.filter(line => /^[•\-]\s/.test(line.trim()))
    if (bulletItems.length > 0 && bulletItems.length === lines.filter(l => l.trim()).length) {
      return (
        <ul key={index} style={{
          fontSize: '17px',
          lineHeight: '1.7',
          color: '#111',
          margin: 0,
          marginTop: '16px',
          paddingLeft: '8px',
          listStyle: 'none',
        }}>
          {bulletItems.map((item, i) => {
            const text = item.replace(/^[•\-]\s/, '')
            const isLastItem = isLastBlock && i === bulletItems.length - 1
            return (
              <li key={i} style={{ marginBottom: '10px', display: 'flex', gap: '12px' }}>
                <span style={{ color: ACCENT_COLOR, fontWeight: '600', flexShrink: 0 }}>•</span>
                <span>
                  {parseInlineMarkdown(text)}
                  {isLastItem && !isComplete && <BlinkingCursor />}
                </span>
              </li>
            )
          })}
        </ul>
      )
    }

    // Regular paragraph
    return (
      <p key={index} style={{
        fontSize: '17px',
        lineHeight: '1.7',
        color: '#111',
        margin: 0,
        marginTop,
      }}>
        {parseInlineMarkdown(block)}
        {isLastBlock && !isComplete && <BlinkingCursor />}
      </p>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}
    >
      {blocks.map((block, i) => renderStreamingBlock(block, i))}
    </motion.div>
  )
}

interface RafaelContentProps {
  content: string
  videoUrl?: string
  checkoutPlanId?: string
  calendlyUrl?: string
  onCheckoutComplete?: (planId: string, receiptId: string) => void
  onCalendlyBooked?: (payload: any) => void
}

// Format Rafael's message content with proper styling
function RafaelContent({ content, videoUrl, checkoutPlanId, calendlyUrl, onCheckoutComplete, onCalendlyBooked }: RafaelContentProps) {
  const blocks = content.split('\n\n').filter(p => p.trim())

  const renderBlock = (block: string, index: number) => {
    const isFirst = index === 0
    const marginTop = isFirst ? 0 : '20px'

    // Check for video marker
    if (block.trim() === '[VIDEO]' || block.includes('[VIDEO]')) {
      return (
        <InlineVideoEmbed
          key={index}
          url={videoUrl || ''}
          isVisible={true}
        />
      )
    }

    // Check for checkout marker
    if (block.trim() === '[CHECKOUT]' || block.includes('[CHECKOUT]')) {
      return (
        <InlineCheckoutEmbed
          key={index}
          planId={checkoutPlanId || ''}
          isVisible={true}
          onComplete={onCheckoutComplete}
        />
      )
    }

    // Check for calendly marker
    if (block.trim() === '[CALENDLY]' || block.includes('[CALENDLY]')) {
      return (
        <InlineCalendlyEmbed
          key={index}
          url={calendlyUrl || ''}
          isVisible={true}
          onEventScheduled={onCalendlyBooked}
        />
      )
    }

    // Check for horizontal rule
    if (block.trim() === '---' || block.trim() === '***' || block.trim() === '___') {
      return (
        <hr key={index} style={{
          border: 'none',
          borderTop: '1px solid #E5E5E5',
          margin: '24px 0',
        }} />
      )
    }

    // Check for ## headline (markdown h2)
    if (block.startsWith('## ')) {
      return (
        <h2 key={index} style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#000',
          lineHeight: '1.3',
          margin: 0,
          marginTop: isFirst ? 0 : '16px',
          marginBottom: '16px',
        }}>
          {block.slice(3)}
        </h2>
      )
    }

    // Check for ### headline (markdown h3)
    if (block.startsWith('### ')) {
      return (
        <h3 key={index} style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#000',
          lineHeight: '1.35',
          margin: 0,
          marginTop: isFirst ? 0 : '12px',
          marginBottom: '12px',
        }}>
          {block.slice(4)}
        </h3>
      )
    }

    // Check for header (starts and ends with **)
    if (block.startsWith('**') && block.endsWith('**') && !block.includes('\n')) {
      return (
        <h2 key={index} style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#000',
          lineHeight: '1.35',
          margin: 0,
          marginTop,
        }}>
          {block.slice(2, -2)}
        </h2>
      )
    }

    // Check for numbered list (lines starting with 1. 2. 3. etc)
    const numberedListMatch = block.match(/^(\d+\.\s.+\n?)+$/m)
    if (numberedListMatch || block.split('\n').every(line => /^\d+\.\s/.test(line.trim()) || !line.trim())) {
      const items = block.split('\n').filter(line => /^\d+\.\s/.test(line.trim()))
      if (items.length > 0) {
        return (
          <ol key={index} style={{
            fontSize: '17px',
            lineHeight: '1.7',
            color: '#111',
            margin: 0,
            marginTop: '16px',
            paddingLeft: '8px',
            listStyle: 'none',
          }}>
            {items.map((item, i) => {
              const text = item.replace(/^\d+\.\s/, '')
              return (
                <li key={i} style={{ marginBottom: '10px', display: 'flex', gap: '12px' }}>
                  <span style={{ color: ACCENT_COLOR, fontWeight: '600', flexShrink: 0 }}>{i + 1}.</span>
                  <span>{parseInlineMarkdown(text)}</span>
                </li>
              )
            })}
          </ol>
        )
      }
    }

    // Check for bullet list (lines starting with • or -)
    const bulletLines = block.split('\n').filter(line => /^[•\-]\s/.test(line.trim()))
    if (bulletLines.length > 0 && bulletLines.length === block.split('\n').filter(l => l.trim()).length) {
      return (
        <ul key={index} style={{
          fontSize: '17px',
          lineHeight: '1.7',
          color: '#111',
          margin: 0,
          marginTop: '16px',
          paddingLeft: '8px',
          listStyle: 'none',
        }}>
          {bulletLines.map((item, i) => {
            const text = item.replace(/^[•\-]\s/, '')
            return (
              <li key={i} style={{ marginBottom: '10px', display: 'flex', gap: '12px' }}>
                <span style={{ color: ACCENT_COLOR, fontWeight: '600', flexShrink: 0 }}>•</span>
                <span>{parseInlineMarkdown(text)}</span>
              </li>
            )
          })}
        </ul>
      )
    }

    // Regular paragraph
    return (
      <p key={index} style={{
        fontSize: '17px',
        lineHeight: '1.7',
        color: '#111',
        margin: 0,
        marginTop,
      }}>
        {parseInlineMarkdown(block)}
      </p>
    )
  }

  // Only show fallback video at bottom if content doesn't have inline [VIDEO] marker
  const hasInlineVideo = content.includes('[VIDEO]')

  return (
    <>
      {blocks.map((block, i) => renderBlock(block, i))}

      {videoUrl && !hasInlineVideo && (
        <div style={{ marginTop: '20px' }}>
          <VideoEmbed url={videoUrl} maxWidth="100%" />
        </div>
      )}
    </>
  )
}

// Sample messages for demonstration
const SAMPLE_MESSAGES = [
  {
    role: 'user' as const,
    content: "What's the most important thing I should focus on first?"
  },
  {
    role: 'assistant' as const,
    content: `Your positioning.

Everything else — content, pricing, sales — gets 10x easier once you're positioned correctly. We need to make you the *only* choice for a specific type of client.`
  },
  {
    role: 'user' as const,
    content: 'How do I actually do that?'
  },
  {
    role: 'assistant' as const,
    content: `## Start with your signature work

Look at your best client results. Find the intersection of three things:

1. What people respond to most strongly
2. What people specifically ask you for
3. What you genuinely love doing

**That's your signature.** Don't overthink it — you probably already know what it is. The work that feels effortless to you but *remarkable* to others.

---

## Then narrow your audience

This feels counterintuitive, but **specificity creates demand**. Here's what to focus on:

• Pick one industry or niche you understand deeply
• Identify the specific problem you solve better than anyone
• Name the transformation — before and after

*The goal isn't to appeal to everyone. It's to be the obvious choice for someone.*`
  }
]

// Generate unique ID for messages
function uid() {
  return crypto.randomUUID?.() || String(Date.now() + Math.random())
}

// Add IDs to sample messages
const SAMPLE_MESSAGES_WITH_IDS = SAMPLE_MESSAGES.map(msg => ({ ...msg, id: uid() }))

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  _placeholder?: boolean
  videoUrl?: string
  checkoutPlanId?: string
  calendlyUrl?: string
  thinkingTime?: number
  _isBookingConfirmation?: boolean
}

interface ActiveChatProps {
  initialMessage?: string
  onBack?: () => void
}

export function ActiveChat({ initialMessage, onBack }: ActiveChatProps) {
  const { state, dispatch } = useUser()
  const { getResponse } = useAgent()
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES_WITH_IDS)
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null)
  const [turnFillPx, setTurnFillPx] = useState(0) // Min height for placeholder to create scroll space
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const streamingNodeRef = useRef<HTMLDivElement>(null)
  const messageNodeMapRef = useRef(new Map<string, HTMLDivElement>())
  const initialMessageSent = useRef(false)
  const thinkingTimeRef = useRef(0) // Track thinking time

  // Ref callback for message nodes - memoize per ID to avoid re-renders
  const refCallbacksRef = useRef(new Map<string, (node: HTMLDivElement | null) => void>())
  const getRefCallback = useCallback((id: string) => {
    if (!refCallbacksRef.current.has(id)) {
      refCallbacksRef.current.set(id, (node) => {
        if (node) messageNodeMapRef.current.set(id, node)
        else messageNodeMapRef.current.delete(id)
      })
    }
    return refCallbacksRef.current.get(id)
  }, [])

  // Effect A: Compute filler height after DOM commit
  useLayoutEffect(() => {
    if (!focusMessageId || !streamingMessageId) return

    const container = scrollContainerRef.current
    const promptNode = messageNodeMapRef.current.get(focusMessageId)
    if (!container || !promptNode) return

    const viewportH = container.clientHeight
    const promptH = promptNode.getBoundingClientRect().height
    const filler = Math.max(0, viewportH - promptH - 24)
    setTurnFillPx(filler)
  }, [focusMessageId, streamingMessageId, messages.length])

  // Effect B: Scroll user message to top after filler is applied
  useLayoutEffect(() => {
    if (turnFillPx <= 0 || !focusMessageId) return

    const promptNode = messageNodeMapRef.current.get(focusMessageId)
    if (!promptNode) return

    requestAnimationFrame(() => {
      promptNode.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
    })
  }, [turnFillPx, focusMessageId])

  // Effect C removed - no auto-scroll needed during streaming
  // User can scroll manually once content is in viewport


  const handleSendMessage = useCallback(async (content: string) => {
    // Reset filler from previous turn
    setTurnFillPx(0)

    // Create both messages with unique IDs
    const userMessage: Message = { id: uid(), role: 'user', content }
    const assistantTurn: Message = {
      id: uid(),
      role: 'assistant',
      content: '',
      _placeholder: true // Active turn container - keeps filler until next message
    }

    // Add BOTH in same setMessages call, clearing old placeholders
    setMessages(prev => [
      ...prev.map(msg => msg._placeholder ? { ...msg, _placeholder: false } : msg),
      userMessage,
      assistantTurn
    ])
    setFocusMessageId(userMessage.id)
    setStreamingMessageId(assistantTurn.id)
    setIsTyping(true)
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage })

    // Add artificial delay to see thinking animation (2.3 seconds)
    await new Promise(resolve => setTimeout(resolve, 2300))

    // Check for book me first (calendly), then sell me (checkout), then pricing (video)
    let response: any
    if (containsBookMeKeyword(content)) {
      response = MOCK_CALENDLY_RESPONSE
    } else if (containsSellMeKeyword(content)) {
      response = MOCK_CHECKOUT_RESPONSE
    } else if (containsPricingKeyword(content)) {
      response = MOCK_VIDEO_RESPONSE
    } else {
      // Get AI response
      response = await getResponse('chat', state, content)
    }

    // Capture the final thinking time
    const finalThinkingTime = thinkingTimeRef.current
    setIsTyping(false)

    // Update the assistant message content IN PLACE
    // KEEP _placeholder true - filler removal happens in ResizeObserver when content is tall enough
    setMessages(prev => prev.map(msg =>
      msg.id === assistantTurn.id
        ? {
            ...msg,
            content: response.message || response,
            videoUrl: response.videoUrl || (response.videoKey ? (mentor.videos as any)[response.videoKey]?.url : null),
            checkoutPlanId: response.checkoutPlanId || null,
            calendlyUrl: response.calendlyUrl || null,
            thinkingTime: finalThinkingTime
            // DO NOT set _placeholder: false here - that removes filler too early
          }
        : msg
    ))

    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: response.message || response } })

    // Add to memory if response contains insight
    if (content.length > 50) {
      dispatch({
        type: 'ADD_MEMORY',
        payload: content.substring(0, 100)
      })
    }
  }, [state, dispatch, getResponse])

  const handleStreamingComplete = useCallback(() => {
    // Clean up streaming state only
    setStreamingMessageId(null)

    // DON'T remove filler or _placeholder here - keep them so scroll position stays stable
    // They will be cleaned up when user sends next message
  }, [])

  // Handle checkout completion
  const handleCheckoutComplete = useCallback((planId: string, receiptId: string) => {
    console.log('Checkout complete:', planId, receiptId)
    // TODO: Unlock level, update UI, etc.
    // For now, just log the purchase details
  }, [])

  // Track if booking confirmation was already sent
  const bookingConfirmationSentRef = useRef(false)

  // Handle Calendly booking completion
  const handleCalendlyBooked = useCallback((payload: any) => {
    // Guard against double-firing
    if (bookingConfirmationSentRef.current) return
    bookingConfirmationSentRef.current = true

    console.log('Call booked:', payload)

    // Add a confirmation message from Rafael
    const confirmationMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Got it — I just got the notification.

Looking forward to our call. Come prepared with your biggest question or challenge, and I'll make sure you leave with a clear next step.

Talk soon.`,
      thinkingTime: undefined,
      _isBookingConfirmation: true
    }

    // Small delay so the "Call booked!" state shows first
    setTimeout(() => {
      setMessages(prev => [...prev, confirmationMessage])
      setStreamingMessageId(confirmationMessage.id)
    }, 800)
  }, [])

  // Update thinking time ref from ThinkingIndicator
  const handleThinkingTimeUpdate = useCallback((ms: number) => {
    thinkingTimeRef.current = ms
  }, [])

  // Handle initial message if provided (append to sample messages for now)
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true
      // Append user's message to existing conversation
      setTimeout(() => handleSendMessage(initialMessage), 100)
    }
  }, [initialMessage, handleSendMessage])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden', // Prevent body scroll - force scroll inside container
      backgroundColor: '#FAF6F0',
    }}>
      {/* Header - Sticky */}
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
        <button
          onClick={onBack}
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          onClick={onBack}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
          }}
        >
          <Avatar size={40} />
          <RafaelLabel size="large" />
        </div>

        {/* Profile/Account Button */}
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

      {/* Messages - Scroll Container (no padding here for sticky to work) */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {/* Inner wrapper with padding - extra top padding so content scrolls under header */}
        <div style={{ padding: '85px 20px 140px' }}>
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '28px',
            }}
          >
            <AnimatePresence mode="popLayout">
              {messages.map((message) => {
                const isStreaming = message.id === streamingMessageId
                const isPlaceholder = message._placeholder
                const isFocusedUser = message.role === 'user' && message.id === focusMessageId

                return (
                  <div
                    key={message.id}
                    ref={isStreaming ? streamingNodeRef : getRefCallback(message.id)}
                    style={{
                      // Apply turn filler to placeholder to create scroll space
                      // This pushes scrollHeight so user message can be scrolled to top
                      minHeight: isPlaceholder && turnFillPx > 0 ? turnFillPx : undefined,
                      // Add top margin for focused user message so it's not flush with header
                      marginTop: isFocusedUser ? 8 : undefined,
                      // CSS scroll-margin so scrollIntoView leaves space at top
                      scrollMarginTop: isFocusedUser ? 80 : undefined,
                    }}
                  >
                    {message.role === 'user' ? (
                      <UserBubble>
                        {message.content}
                      </UserBubble>
                    ) : isStreaming ? (
                      // Streaming assistant row - NEVER return null to keep DOM stable
                      isTyping ? (
                        <ThinkingIndicator onTimeUpdate={handleThinkingTimeUpdate} />
                      ) : (
                        // Always render StreamingRafaelMessage - it handles empty content gracefully
                        <StreamingRafaelMessage
                          content={message.content || ''}
                          videoUrl={message.videoUrl}
                          checkoutPlanId={message.checkoutPlanId}
                          calendlyUrl={message.calendlyUrl}
                          onComplete={handleStreamingComplete}
                          onCheckoutComplete={handleCheckoutComplete}
                          onCalendlyBooked={handleCalendlyBooked}
                        />
                      )
                    ) : message.content ? (
                      <RafaelMessage content={message.content} thinkingTime={message.thinkingTime}>
                        <RafaelContent
                          content={message.content}
                          videoUrl={message.videoUrl}
                          checkoutPlanId={message.checkoutPlanId}
                          calendlyUrl={message.calendlyUrl}
                          onCheckoutComplete={handleCheckoutComplete}
                          onCalendlyBooked={handleCalendlyBooked}
                        />
                      </RafaelMessage>
                    ) : null}
                  </div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Input */}
      <ChatInputBar
        placeholder="Message Rafael..."
        onSend={handleSendMessage}
        disabled={isTyping}
      />
    </div>
  )
}
