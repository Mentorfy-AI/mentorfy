'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useChat, UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ChatBar } from '../shared/ChatBar'
import { VideoEmbed } from '../shared/VideoEmbed'
import { WhopCheckoutEmbed } from '@whop/checkout/react'
import { InlineWidget, useCalendlyEventListener } from 'react-calendly'
import { useUserState, useSessionId } from '@/context/UserContext'
import { useAnalytics } from '@/hooks/useAnalytics'
import { COLORS, TIMING, LAYOUT, PHASE_NAMES } from '@/config/flow'
import { getFlow } from '@/data/flows'
import type { EmbedData } from '@/types'

/**
 * Extract text content from UIMessage parts
 */
function getMessageText(message: UIMessage): string {
  return message.parts
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('')
}

/**
 * Extract embed data from tool invocations in a message
 * Tool parts have type 'tool-{toolName}' with state and output properties
 */
function getEmbedFromMessage(message: UIMessage): EmbedData | null {
  for (const part of message.parts) {
    // Check for tool parts (showCheckout, showVideo, showBooking)
    if (
      (part.type === 'tool-showCheckout' ||
       part.type === 'tool-showVideo' ||
       part.type === 'tool-showBooking') &&
      part.state === 'output-available'
    ) {
      // Tool output is already in EmbedData format from server
      return part.output as EmbedData
    }
  }
  return null
}

// Data formatters for dynamic messages
const formatBookingStatus = (val: string): string => {
  const map: Record<string, string> = {
    'booked-3-months': 'fully booked out 3+ months',
    'booked-1-2-months': 'booked out 1-2 months',
    'booked-1-month': 'booked out about a month',
    'booked-1-2-weeks': 'booked out 1-2 weeks',
    'inconsistent': 'dealing with inconsistent bookings'
  }
  return map[val] || val || 'figuring out your booking situation'
}

const formatDayRate = (val: string): string => {
  const map: Record<string, string> = {
    '4k-plus': '$4k+',
    '3k-4k': '$3k-$4k',
    '2k-3k': '$2k-$3k',
    '1k-2k': '$1k-$2k',
    '500-1k': '$500-$1k',
    'under-500': 'under $500'
  }
  return map[val] || val || 'your current rate'
}

const formatGoal = (val: string): string => {
  const map: Record<string, string> = {
    '30-50k-months': 'hit $30k-$50k months consistently',
    'booked-1-2-months': 'get booked out 1-2 months in advance',
    'no-empty-days': 'eliminate empty chair days',
    'full-rate-clients': 'attract clients who pay your full rate',
    'brand-building': 'build a brand that brings clients to you'
  }
  return map[val] || val || 'level up your business'
}

const formatBlocker = (val: string): string => {
  const map: Record<string, string> = {
    'unpredictable-posting': 'unpredictable results from posting',
    'price-shoppers': 'DMs full of price shoppers who can\'t afford you',
    'no-time': 'no time because you\'re tattooing all day',
    'unknown-ideal-client': 'not knowing who your ideal client actually is',
    'invisible': 'being invisible despite good work'
  }
  return map[val] || val || 'something holding you back'
}

const formatCheckFirst = (val: string): string => {
  const map: Record<string, string> = {
    'views-likes': 'views and likes',
    'follower-count': 'follower count',
    'comments-dms': 'comments and DMs',
    'saves-shares': 'saves and shares',
    'avoid-looking': 'nothing — you avoid looking'
  }
  return map[val] || val || 'the numbers'
}

const formatHundredKFollowers = (val: string): string => {
  const map: Record<string, string> = {
    'consistent-bookings': 'you\'d finally have consistent bookings',
    'charge-more': 'you could charge more with that social proof',
    'brand-opportunities': 'brands would reach out with opportunities',
    'not-much': 'honestly, not much would change',
    'made-it': 'you\'d finally feel like you "made it"'
  }
  return map[val] || val || 'everything would change'
}

const formatHardestPart = (val: string): string => {
  const map: Record<string, string> = {
    'dont-know-what': 'never knowing what to post',
    'no-time': 'not having time because you\'re tattooing all day',
    'awkward-camera': 'feeling awkward on camera',
    'no-conversion': 'posting but nothing converting to bookings',
    'cant-stay-consistent': 'not being able to stay consistent'
  }
  return map[val] || val || 'the content struggle'
}

// Generate dynamic transition message (without mentioning phases/steps)
function generatePhaseCompleteMessage(currentPhase: number, state: any): string {
  const name = state.user?.name?.split(' ')[0] || 'there'
  const { situation, phase2, phase3 } = state

  // currentPhase is the NEXT phase (after completion, it increments)
  switch (currentPhase) {
    case 2: // Just completed diagnosis
      return `${name}, I see you.

You're ${formatBookingStatus(situation?.bookingStatus)}. Charging ${formatDayRate(situation?.dayRate)}. And the thing holding you back? ${formatBlocker(situation?.blocker)}.

When I asked you to be honest, you said:

*"${situation?.confession || 'Something real.'}"*

That's the block we're going to break.

**Here's what we're going to cover:**

- Getting booked without going viral
- A 30-minute content system
- Doubling your revenue

And then I have something to show you.

Ready?`

    case 3: // Just completed views mindset section
      return `You're seeing it now — chasing views is the wrong game.

You told me you check ${formatCheckFirst(phase2?.checkFirst)} after posting. And you thought if you had 100k followers, ${formatHundredKFollowers(phase2?.hundredKFollowers)}.

That belief was costing you. Now you know better.

**Next up:** I'm giving you the content system. 30 minutes a day, and you never run out of ideas.

Questions first, or ready to keep going?`

    case 4: // Just completed content system section
      return `You've got the system now.

You said the hardest part of content was ${formatHardestPart(phase3?.hardestPart)}. That ends today.

**One more thing to cover:** pricing. This is where everything clicks.

You ready to talk about money?`

    case 5: // Just completed pricing section (all done)
      return `You made it through everything, ${name}.

You came in ${formatBookingStatus(situation?.bookingStatus)} and charging ${formatDayRate(situation?.dayRate)}. You told me the thing holding you back was ${formatBlocker(situation?.blocker)}.

Now you have the diagnosis, the content system, and the pricing framework.

The question is: what are you going to do with it?

I'm here if you want to talk through next steps.`

    default:
      return `Hey ${name}, good to see you back.

I'm here whenever you want to chat. What's on your mind?`
  }
}

// Section divider component (no phase/step language)
function PhaseDivider({ phaseNumber }: { phaseNumber: number }) {
  const phaseName = PHASE_NAMES[phaseNumber] || 'Section'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0 8px',
      }}
    >
      <div style={{
        flex: 1,
        height: 1,
        background: 'linear-gradient(to right, transparent, #E5E0D8)',
      }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}>
        <div style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.ACCENT,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Complete
        </div>
        <div style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: 14,
          fontWeight: 500,
          color: '#666',
        }}>
          {phaseName}
        </div>
      </div>
      <div style={{
        flex: 1,
        height: 1,
        background: 'linear-gradient(to left, transparent, #E5E0D8)',
      }} />
    </motion.div>
  )
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
        backgroundColor: COLORS.ACCENT,
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

interface AssistantMessageProps {
  children: ReactNode
  content?: string
  thinkingTime?: number
}

// Assistant message with proper formatting
function AssistantMessage({ children, thinkingTime }: AssistantMessageProps) {
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
      {thinkingTime && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '13px',
            color: '#999',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatTime(thinkingTime)}
          </span>
        </div>
      )}
    </motion.div>
  )
}

interface ThinkingIndicatorProps {
  onTimeUpdate?: (ms: number) => void
}

// Thinking indicator with green shimmer
function ThinkingIndicator({ onTimeUpdate }: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const ms = now - startTimeRef.current
      setElapsed(ms)
      onTimeUpdate?.(ms)
    }, 10)
    return () => clearInterval(interval)
  }, [onTimeUpdate])

  const formatTime = (ms: number) => (ms / 1000).toFixed(2) + 's'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      <span style={{
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '17px',
        fontWeight: '600',
        color: '#111',
        display: 'inline-block',
        backgroundImage: `linear-gradient(90deg, #111 0%, #111 42%, ${COLORS.ACCENT} 46%, ${COLORS.ACCENT} 54%, #111 58%, #111 100%)`,
        backgroundSize: '300% 100%',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shimmer 0.6s linear infinite',
      }}>
        Thinking...
      </span>
      <span style={{
        fontFamily: "'Geist', -apple-system, sans-serif",
        fontSize: '13px',
        color: '#999',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(elapsed)}
      </span>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0% 0; }
        }
      `}</style>
    </motion.div>
  )
}

// Parse inline markdown
function parseInlineMarkdown(text: string): ReactNode[] {
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

// Blinking cursor
function BlinkingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      style={{
        display: 'inline-block',
        width: '2px',
        height: '1em',
        backgroundColor: COLORS.ACCENT,
        marginLeft: '2px',
        verticalAlign: 'text-bottom',
      }}
    />
  )
}

// Render a single block with proper formatting
function renderFormattedBlock(block: string, index: number, isFirst: boolean, isLastBlock = false, isComplete = true): ReactNode {
  const marginTop = isFirst ? 0 : '20px'

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
              <span style={{ color: COLORS.ACCENT, fontWeight: '600', flexShrink: 0 }}>{i + 1}.</span>
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
              <span style={{ color: COLORS.ACCENT, fontWeight: '600', flexShrink: 0 }}>•</span>
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

interface FormattedContentProps {
  content: string
}

// Normalize markdown to ensure ## headers are properly separated as blocks
function normalizeMarkdown(content: string): string {
  // Insert double newline before ## if not already preceded by newline
  return content.replace(/([^\n])\n?(## )/g, '$1\n\n$2')
}

// Format assistant message content with proper styling
function FormattedContent({ content }: FormattedContentProps) {
  const normalized = normalizeMarkdown(content)
  const blocks = normalized.split('\n\n').filter(p => p.trim())
  return <>{blocks.map((block, i) => renderFormattedBlock(block, i, i === 0, i === blocks.length - 1, true))}</>
}

interface StreamingAssistantMessageProps {
  content: string
  onComplete?: () => void
}

// Streaming message component - uses renderFormattedBlock for consistent formatting
function StreamingAssistantMessage({ content, onComplete }: StreamingAssistantMessageProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const streamSpeed = TIMING.STREAM_SPEED

  useEffect(() => {
    if (!content) return
    let index = 0

    const interval = setInterval(() => {
      if (index < content.length) {
        setDisplayedText(content.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
        setIsComplete(true)
        onComplete?.()
      }
    }, streamSpeed)

    return () => clearInterval(interval)
  }, [content, onComplete])

  const normalized = normalizeMarkdown(displayedText)
  const blocks = normalized.split('\n\n').filter(p => p.trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}
    >
      {blocks.map((block, i) =>
        renderFormattedBlock(block, i, i === 0, i === blocks.length - 1, isComplete)
      )}
    </motion.div>
  )
}


interface ChatCheckoutEmbedProps {
  planId: string
  onComplete?: () => void
}

// Checkout embed - exact copy from LevelFlow sales page
function ChatCheckoutEmbed({ planId, onComplete }: ChatCheckoutEmbedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      style={{
        width: '100%',
        margin: '24px 0',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: COLORS.BACKGROUND,
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
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: COLORS.ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px rgba(16, 185, 129, 0.4), 0 8px 24px rgba(16, 185, 129, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)`,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </motion.div>
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

      {/* Checkout embed */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '4px' }}>
        <WhopCheckoutEmbed
          planId={planId}
          theme="light"
          skipRedirect={true}
          onComplete={onComplete}
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

interface ChatVideoEmbedProps {
  url: string
}

// Video embed wrapper
function ChatVideoEmbed({ url }: ChatVideoEmbedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{ margin: '24px 0' }}
    >
      <VideoEmbed url={url} maxWidth="100%" />
    </motion.div>
  )
}

interface ChatBookingEmbedProps {
  url: string
  onBookingComplete?: () => void
}

// Booking embed - exact copy from LevelFlow (Calendly InlineWidget)
function ChatBookingEmbed({ url, onBookingComplete }: ChatBookingEmbedProps) {
  const bookingCompleteRef = useRef(false)

  useCalendlyEventListener({
    onEventScheduled: () => {
      if (bookingCompleteRef.current) return
      bookingCompleteRef.current = true
      onBookingComplete?.()
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      style={{
        width: '100%',
        margin: '24px 0',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        border: 'none',
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

interface RenderEmbedProps {
  embedData: any
  onCheckoutComplete?: () => void
  onBookingComplete?: () => void
  onEmbedShown?: (embedType: 'checkout' | 'booking' | 'video') => void
}

// Render embed based on type
function RenderEmbed({ embedData, onCheckoutComplete, onBookingComplete, onEmbedShown }: RenderEmbedProps) {
  const shownRef = useRef(false)

  useEffect(() => {
    if (!shownRef.current && embedData?.embedType) {
      shownRef.current = true
      onEmbedShown?.(embedData.embedType)
    }
  }, [embedData, onEmbedShown])

  switch (embedData.embedType) {
    case 'checkout':
      return <ChatCheckoutEmbed planId={embedData.checkoutPlanId} onComplete={onCheckoutComplete} />
    case 'video':
      return <ChatVideoEmbed url={embedData.videoUrl} />
    case 'booking':
      return <ChatBookingEmbed url={embedData.calendlyUrl} onBookingComplete={onBookingComplete} />
    default:
      return null
  }
}

interface StreamingEmbeddedMessageProps {
  embedData: any
  onComplete?: () => void
  onEmbedShown?: (embedType: 'checkout' | 'booking' | 'video') => void
  onBookingComplete?: () => void
}

// Message with embedded content (streaming)
function StreamingEmbeddedMessage({ embedData, onComplete, onEmbedShown, onBookingComplete }: StreamingEmbeddedMessageProps) {
  const { beforeText, afterText } = embedData
  const [phase, setPhase] = useState(0) // 0: before, 1: embed, 2: after, 3: complete
  const [displayedBefore, setDisplayedBefore] = useState('')
  const [displayedAfter, setDisplayedAfter] = useState('')
  const streamSpeed = TIMING.STREAM_SPEED

  // Stream before text
  useEffect(() => {
    if (phase !== 0) return
    let index = 0
    const interval = setInterval(() => {
      if (index < beforeText.length) {
        setDisplayedBefore(beforeText.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
        setTimeout(() => setPhase(1), 300)
      }
    }, streamSpeed)
    return () => clearInterval(interval)
  }, [phase, beforeText])

  // Show embed after before text
  useEffect(() => {
    if (phase !== 1) return
    setTimeout(() => setPhase(2), 800)
  }, [phase])

  // Stream after text
  useEffect(() => {
    if (phase !== 2) return
    let index = 0
    const interval = setInterval(() => {
      if (index < afterText.length) {
        setDisplayedAfter(afterText.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
        setPhase(3)
        onComplete?.()
      }
    }, streamSpeed)
    return () => clearInterval(interval)
  }, [phase, afterText, onComplete])

  const beforeBlocks = normalizeMarkdown(displayedBefore).split('\n\n').filter(p => p.trim())
  const afterBlocks = normalizeMarkdown(displayedAfter).split('\n\n').filter(p => p.trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}
    >
      {/* Before text */}
      {beforeBlocks.map((block, i) =>
        renderFormattedBlock(block, i, i === 0, phase === 0 && i === beforeBlocks.length - 1, phase > 0)
      )}

      {/* Embed */}
      {phase >= 1 && (
        <RenderEmbed embedData={embedData} onEmbedShown={onEmbedShown} onBookingComplete={onBookingComplete} />
      )}

      {/* After text */}
      {phase >= 2 && afterBlocks.map((block, i) =>
        renderFormattedBlock(block, `after-${i}` as any, false, phase === 2 && i === afterBlocks.length - 1, phase > 2)
      )}
    </motion.div>
  )
}

interface StaticEmbeddedMessageProps {
  embedData: any
  thinkingTime?: number
  onEmbedShown?: (embedType: 'checkout' | 'booking' | 'video') => void
  onBookingComplete?: () => void
}

// Static embedded message (non-streaming, already in state)
function StaticEmbeddedMessage({ embedData, thinkingTime, onEmbedShown, onBookingComplete }: StaticEmbeddedMessageProps) {
  const formatTime = (ms: number | undefined) => {
    if (!ms) return null
    return (ms / 1000).toFixed(2) + 's'
  }

  const beforeBlocks = normalizeMarkdown(embedData.beforeText).split('\n\n').filter((p: string) => p.trim())
  const afterBlocks = normalizeMarkdown(embedData.afterText).split('\n\n').filter((p: string) => p.trim())

  return (
    <div style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}>
      {/* Before text */}
      {beforeBlocks.map((block: string, i: number) =>
        renderFormattedBlock(block, i, i === 0, false, true)
      )}

      {/* Embed */}
      <RenderEmbed embedData={embedData} onEmbedShown={onEmbedShown} onBookingComplete={onBookingComplete} />

      {/* After text */}
      {afterBlocks.map((block: string, i: number) =>
        renderFormattedBlock(block, `after-${i}` as any, false, false, true)
      )}

      {/* Thinking time */}
      {thinkingTime && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '13px',
            color: '#999',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatTime(thinkingTime)}
          </span>
        </div>
      )}
    </div>
  )
}

// Generate unique ID
function uid() {
  return crypto.randomUUID?.() || String(Date.now() + Math.random())
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'divider'
  content: string
  _placeholder?: boolean
  embedData?: any
  thinkingTime?: number
  phaseNumber?: number
}

interface AIChatProps {
  onArrowReady?: () => void
  currentPhase: number
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  continueReady?: boolean
  onContinue?: () => void
  flowId: string
  phasesCompleted: number[]
}

export function AIChat({
  onArrowReady,
  currentPhase,
  scrollContainerRef: externalScrollRef,
  continueReady,
  onContinue,
  flowId,
  phasesCompleted,
}: AIChatProps) {
  const state = useUserState()
  const sessionId = useSessionId()
  const analytics = useAnalytics({ session_id: sessionId || '', flow_id: flowId })
  const messageCountRef = useRef(0)

  // useChat for API communication with tool support
  const {
    messages: chatMessages,
    sendMessage,
    status,
    setMessages: setChatMessages,
  } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isChatLoading = status === 'streaming' || status === 'submitted'

  // Local messages state for custom UI (dividers, phase messages, etc.)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null)
  const [turnFillPx, setTurnFillPx] = useState(0)
  // Use external scroll ref (Panel) if provided, otherwise fallback to internal
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = externalScrollRef || internalScrollRef
  const messageNodeMapRef = useRef(new Map<string, HTMLDivElement>())
  const thinkingTimeRef = useRef(0)

  // Track which phase completion messages we've already added
  const addedPhaseMessagesRef = useRef<Set<number>>(new Set())
  const initializedRef = useRef(false)

  // Ref callback for message nodes
  const handleMessageRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      messageNodeMapRef.current.set(id, node)
    } else {
      messageNodeMapRef.current.delete(id)
    }
  }, [])

  // Initialize once on mount - load existing conversation
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    // Chat messages start fresh each session (not persisted)
    setLocalMessages([])
  }, [])

  // Sync streaming content from useChat to local messages
  useEffect(() => {
    if (!streamingMessageId || chatMessages.length === 0) return

    // Find the latest assistant message from useChat
    const latestAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (!latestAssistant) return

    // Check for tool invocations (embeds)
    const embedData = getEmbedFromMessage(latestAssistant)

    // Update the streaming local message with content/embed from useChat
    const textContent = getMessageText(latestAssistant)
    setLocalMessages(prev => prev.map(msg =>
      msg.id === streamingMessageId
        ? {
            ...msg,
            content: textContent,
            embedData: embedData || msg.embedData,
          }
        : msg
    ))
  }, [chatMessages, streamingMessageId])

  // Track completed assistant messages for UI updates
  const lastPersistedCountRef = useRef(0)
  useEffect(() => {
    // Track when we have new completed messages
    const assistantMessages = chatMessages.filter(m => m.role === 'assistant')
    if (assistantMessages.length <= lastPersistedCountRef.current) return
    lastPersistedCountRef.current = assistantMessages.length
    // Chat messages no longer persisted to session - managed by useChat
  }, [chatMessages, isChatLoading])

  // Handle phase completion - add divider and streaming message when phase changes
  useEffect(() => {
    // Skip if we've already added a message for this phase
    if (addedPhaseMessagesRef.current.has(currentPhase)) {
      return
    }

    // Mark this phase as handled
    addedPhaseMessagesRef.current.add(currentPhase)

    // Reset turn filler from any previous user interaction
    // This prevents white space from appearing above the phase completion
    setTurnFillPx(0)
    setFocusMessageId(null)

    // The completed phase is currentPhase - 1 (since currentPhase is already incremented)
    const completedPhaseNumber = currentPhase - 1

    // Generate unique IDs upfront (capture in closure for scroll later)
    const timestamp = Date.now()
    const dividerId = `divider-${currentPhase}-${timestamp}`
    const messageId = `level-complete-${currentPhase}-${timestamp}`

    // Generate the completion message content
    const levelMessage = generatePhaseCompleteMessage(currentPhase, state)

    // Create divider message (only show if there are existing messages, i.e., not the first phase)
    const dividerMessage: Message = {
      id: dividerId,
      role: 'divider',
      content: '',
      phaseNumber: completedPhaseNumber
    }

    // Add placeholder message and start "thinking"
    const completionMessage: Message = {
      id: messageId,
      role: 'assistant',
      content: '',
      _placeholder: true
    }

    // Add divider + completion message for all phases (including Phase 1 for consistency)
    setLocalMessages(prev => {
      if (completedPhaseNumber >= 1) {
        return [...prev, dividerMessage, completionMessage]
      }
      return [...prev, completionMessage]
    })

    setStreamingMessageId(messageId)
    setIsTyping(true)

    // After brief thinking delay, start streaming the content
    setTimeout(() => {
      setIsTyping(false)
      setLocalMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: levelMessage, _placeholder: false }
          : msg
      ))
    }, TIMING.THINKING_DELAY)

    // Arrow ready after streaming would complete
    setTimeout(() => onArrowReady?.(), TIMING.ARROW_READY_DELAY)

    // Scroll to show the new divider at the TOP
    // Scroll while Level Complete is still showing so chat is ready when it fades
    const scrollToNewContent = (retryCount = 0) => {
      // Safety limit to prevent infinite loops
      if (retryCount >= TIMING.SCROLL_MAX_RETRIES) {
        console.warn('Scroll retry limit reached')
        return
      }

      const container = scrollContainerRef.current
      const targetElement = messageNodeMapRef.current.get(dividerId)
        || messageNodeMapRef.current.get(messageId)

      if (!container || !targetElement) {
        // Retry if refs not ready yet
        setTimeout(() => scrollToNewContent(retryCount + 1), TIMING.SCROLL_RETRY_INTERVAL)
        return
      }

      const elementRect = targetElement.getBoundingClientRect()

      // Check if element has rendered (has height)
      if (elementRect.height === 0) {
        setTimeout(() => scrollToNewContent(retryCount + 1), TIMING.SCROLL_RETRY_INTERVAL)
        return
      }

      // Scroll even if panel is off-screen - it will be in position when Level Complete fades
      targetElement.scrollIntoView({
        block: 'start',
        behavior: 'instant' as ScrollBehavior
      })
    }

    // Start scroll early so it's ready before Level Complete fades
    setTimeout(scrollToNewContent, TIMING.SCROLL_INITIAL_DELAY)
  }, [currentPhase, state, onArrowReady])

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
  }, [focusMessageId, streamingMessageId, localMessages.length])

  // Effect B: Scroll user message to top after filler is applied
  useLayoutEffect(() => {
    if (turnFillPx <= 0 || !focusMessageId) return

    const promptNode = messageNodeMapRef.current.get(focusMessageId)
    if (!promptNode) return

    requestAnimationFrame(() => {
      promptNode.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
    })
  }, [turnFillPx, focusMessageId])

  const handleSendMessage = useCallback(async (content: string) => {
    setTurnFillPx(0)

    const userMessageId = uid()
    const assistantMessageId = uid()

    const userMessage: Message = { id: userMessageId, role: 'user', content }
    const assistantTurn: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      _placeholder: true
    }

    // Track chat_message_sent
    messageCountRef.current += 1
    analytics.trackChatMessage({
      messageIndex: messageCountRef.current,
      messageLength: content.length,
      phasesCompleted,
      chatAfterPhase: currentPhase,
    })

    // Add to local state
    setLocalMessages(prev => [
      ...prev.map(msg => msg._placeholder ? { ...msg, _placeholder: false } : msg),
      userMessage,
      assistantTurn
    ])
    setFocusMessageId(userMessageId)
    setStreamingMessageId(assistantMessageId)
    setIsTyping(true)

    await new Promise(resolve => setTimeout(resolve, TIMING.RESPONSE_DELAY))

    try {
      // Use useChat's sendMessage - it handles streaming and tool invocations
      // agentId is derived from flowId for routing to correct chat agent
      await sendMessage(
        { text: content },
        { body: { sessionId, agentId: `${flowId}-chat` } }
      )

      setIsTyping(false)

      // The sync effect will handle updating localMessages with content/embed data
      // Mark streaming as complete
      setLocalMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, _placeholder: false, thinkingTime: thinkingTimeRef.current }
          : msg
      ))
    } catch (err: any) {
      setIsTyping(false)
      setLocalMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: err.message || 'Something went wrong. Please try again.', _placeholder: false }
          : msg
      ))
    }
  }, [sendMessage, sessionId, analytics])

  const handleStreamingComplete = useCallback(() => {
    setStreamingMessageId(null)
  }, [])

  const handleThinkingTimeUpdate = useCallback((ms: number) => {
    thinkingTimeRef.current = ms
  }, [])

  const handleEmbedShown = useCallback((embedType: 'checkout' | 'booking' | 'video') => {
    analytics.trackEmbedShown({ embedType, source: 'chat', phasesCompleted })
  }, [analytics, phasesCompleted])

  const handleBookingComplete = useCallback(() => {
    analytics.trackBookingClicked({ source: 'chat', phasesCompleted })
  }, [analytics, phasesCompleted])

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: externalScrollRef ? 'auto' : '100%',
      minHeight: externalScrollRef ? '100%' : undefined,
      overflow: externalScrollRef ? 'visible' : 'hidden',
      backgroundColor: COLORS.BACKGROUND,
    }}>
      {/* Header is now stationary in parent - no header here */}

      {/* Messages - scroll is handled by Panel (external ref) or this div (internal fallback) */}
      <div
        ref={externalScrollRef ? undefined : internalScrollRef}
        style={{
          flex: 1,
          overflowY: externalScrollRef ? 'visible' : 'auto',
        }}
      >
        <div style={{ padding: '85px 20px 0' }}>
          <div style={{
            maxWidth: '720px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
          }}>
            {localMessages.map((message) => {
              const isStreaming = message.id === streamingMessageId
              const isPlaceholder = message._placeholder
              const isFocusedUser = message.role === 'user' && message.id === focusMessageId
              const isDivider = message.role === 'divider'

              return (
                <div
                  key={message.id}
                  ref={(node) => handleMessageRef(message.id, node)}
                  data-message-id={message.id}
                  style={{
                    // Apply turn filler to placeholder to create scroll space
                    minHeight: isPlaceholder && turnFillPx > 0 ? turnFillPx : undefined,
                    // Add top margin for focused user message
                    marginTop: isFocusedUser ? 8 : undefined,
                    // CSS scroll-margin so scrollIntoView leaves space at top for header (header is ~70px)
                    scrollMarginTop: (isFocusedUser || isDivider) ? LAYOUT.SCROLL_MARGIN_TOP : undefined,
                  }}
                >
                  {message.role === 'divider' ? (
                    <PhaseDivider phaseNumber={message.phaseNumber || 1} />
                  ) : message.role === 'user' ? (
                    <UserBubble>{message.content}</UserBubble>
                  ) : isStreaming ? (
                    isTyping ? (
                      <ThinkingIndicator onTimeUpdate={handleThinkingTimeUpdate} />
                    ) : message.embedData ? (
                      <StreamingEmbeddedMessage
                        embedData={message.embedData}
                        onComplete={handleStreamingComplete}
                        onEmbedShown={handleEmbedShown}
                        onBookingComplete={handleBookingComplete}
                      />
                    ) : (
                      <StreamingAssistantMessage
                        content={message.content || ''}
                        onComplete={handleStreamingComplete}
                      />
                    )
                  ) : message.embedData ? (
                    <StaticEmbeddedMessage
                      embedData={message.embedData}
                      thinkingTime={message.thinkingTime}
                      onEmbedShown={handleEmbedShown}
                      onBookingComplete={handleBookingComplete}
                    />
                  ) : message.content ? (
                    <AssistantMessage content={message.content} thinkingTime={message.thinkingTime}>
                      <FormattedContent content={message.content} />
                    </AssistantMessage>
                  ) : null}
                </div>
              )
            })}

            {/* Spacer to ensure content can always scroll to top */}
            {/* Height = viewport - header - chatbar buffer to allow last item to reach top */}
            <div style={{ height: 'calc(100vh - 200px)', flexShrink: 0 }} />
          </div>
        </div>
      </div>

      {/* Chat input */}
      <ChatBar
        placeholder={`Message ${getFlow(flowId).mentor.name}...`}
        onSend={handleSendMessage}
        disabled={isTyping}
        continuePhase={currentPhase <= 4 ? currentPhase : undefined}
        continueReady={continueReady}
        onContinue={onContinue}
        sessionId={sessionId || undefined}
      />
    </div>
  )
}
