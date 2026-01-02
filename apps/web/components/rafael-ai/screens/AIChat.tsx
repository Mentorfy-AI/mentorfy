'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChatBar } from '../shared/ChatBar'
import { VideoEmbed } from '../shared/VideoEmbed'
import { WhopCheckoutEmbed } from '@whop/checkout/react'
import { InlineWidget } from 'react-calendly'
import { useUser } from '@/context/UserContext'
import { useAgent } from '@/hooks/useAgent'

const ACCENT_COLOR = '#10B981'

// Level completion messages based on current phase
const LEVEL_COMPLETE_MESSAGES: Record<number, string> = {
  // After Phase 1 (currentPhase = 2)
  2: `Nice work — you just finished Level 1.

You can keep chatting with me here if you want to go deeper on anything we covered. Or tap the arrow to start Level 2.

I'm here whenever you need me.`,

  // After Phase 2 (currentPhase = 3, no more phases)
  3: `Congratulations — you've completed Level 2.

There's no next level yet, but that doesn't mean we're done. Keep chatting with me here if you want to go deeper on anything we covered.

I'm here whenever you need me.`
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

interface RafaelMessageProps {
  children: ReactNode
  content?: string
  thinkingTime?: number
}

// Rafael message with proper formatting
function RafaelMessage({ children, thinkingTime }: RafaelMessageProps) {
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
        backgroundImage: `linear-gradient(90deg, #111 0%, #111 42%, ${ACCENT_COLOR} 46%, ${ACCENT_COLOR} 54%, #111 58%, #111 100%)`,
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
        backgroundColor: ACCENT_COLOR,
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

interface RafaelContentProps {
  content: string
}

// Format Rafael's message content with proper styling
function RafaelContent({ content }: RafaelContentProps) {
  const blocks = content.split('\n\n').filter(p => p.trim())
  return <>{blocks.map((block, i) => renderFormattedBlock(block, i, i === 0, i === blocks.length - 1, true))}</>
}

interface StreamingRafaelMessageProps {
  content: string
  onComplete?: () => void
}

// Streaming message component - uses renderFormattedBlock for consistent formatting
function StreamingRafaelMessage({ content, onComplete }: StreamingRafaelMessageProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const streamSpeed = 5

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

  const blocks = displayedText.split('\n\n').filter(p => p.trim())

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

// Demo command responses with embeds
const DEMO_COMMANDS: Record<string, any> = {
  'sell me': {
    beforeText: `Perfect timing. Let me show you exactly what you'll get when you join the inner circle.

This isn't just another course — it's a complete transformation system designed specifically for artists who are done playing small.`,
    embedType: 'checkout',
    checkoutPlanId: 'plan_joNwbFAIES0hH',
    afterText: `**What's included:**

• 12 weeks of intensive coaching
• Private community access
• Weekly live Q&A calls
• Done-for-you pricing templates
• Unlimited message support

One session at your new rate pays for it 10x over. And you'll get there faster than you think.

Are you ready to stop undercharging?`
  },
  'video': {
    beforeText: `I want to show you something that changed everything for one of my students.

Watch this 3-minute breakdown:`,
    embedType: 'video',
    videoUrl: 'https://rafaeltats.wistia.com/medias/4i06zkj7fg',
    afterText: `**Key takeaways from the video:**

1. Your pricing reflects your positioning, not your skill level
2. Premium clients don't want the cheapest option — they want the *best*
3. The artist who charges $5k gets more respect than the one charging $500

This is exactly what we'll be working on together.

What stood out most to you?`
  },
  'book me': {
    beforeText: `Let's get you on my calendar.

I have a few spots open this week for a strategy call. This is where we'll map out your exact path to $30k+ months.`,
    embedType: 'booking',
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
    afterText: `**What we'll cover on the call:**

• Your current pricing and positioning
• The #1 thing holding you back
• A custom roadmap for your first $10k month
• Whether the program is right for you

No pressure, no hard sell — just clarity.

Pick a time that works and I'll see you there.`
  }
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
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: ACCENT_COLOR,
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
}

// Booking embed - exact copy from LevelFlow (Calendly InlineWidget)
function ChatBookingEmbed({ url }: ChatBookingEmbedProps) {
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
}

// Render embed based on type
function RenderEmbed({ embedData, onCheckoutComplete }: RenderEmbedProps) {
  switch (embedData.embedType) {
    case 'checkout':
      return <ChatCheckoutEmbed planId={embedData.checkoutPlanId} onComplete={onCheckoutComplete} />
    case 'video':
      return <ChatVideoEmbed url={embedData.videoUrl} />
    case 'booking':
      return <ChatBookingEmbed url={embedData.calendlyUrl} />
    default:
      return null
  }
}

interface EmbeddedRafaelMessageProps {
  embedData: any
  onComplete?: () => void
}

// Message with embedded content
function EmbeddedRafaelMessage({ embedData, onComplete }: EmbeddedRafaelMessageProps) {
  const { beforeText, afterText } = embedData
  const [phase, setPhase] = useState(0) // 0: before, 1: embed, 2: after, 3: complete
  const [displayedBefore, setDisplayedBefore] = useState('')
  const [displayedAfter, setDisplayedAfter] = useState('')
  const streamSpeed = 5

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

  const beforeBlocks = displayedBefore.split('\n\n').filter(p => p.trim())
  const afterBlocks = displayedAfter.split('\n\n').filter(p => p.trim())

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
        <RenderEmbed embedData={embedData} />
      )}

      {/* After text */}
      {phase >= 2 && afterBlocks.map((block, i) =>
        renderFormattedBlock(block, `after-${i}` as any, false, phase === 2 && i === afterBlocks.length - 1, phase > 2)
      )}
    </motion.div>
  )
}

interface CompletedEmbeddedMessageProps {
  embedData: any
  thinkingTime?: number
}

// Completed embedded message (non-streaming, already in state)
function CompletedEmbeddedMessage({ embedData, thinkingTime }: CompletedEmbeddedMessageProps) {
  const formatTime = (ms: number | undefined) => {
    if (!ms) return null
    return (ms / 1000).toFixed(2) + 's'
  }

  const beforeBlocks = embedData.beforeText.split('\n\n').filter((p: string) => p.trim())
  const afterBlocks = embedData.afterText.split('\n\n').filter((p: string) => p.trim())

  return (
    <div style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}>
      {/* Before text */}
      {beforeBlocks.map((block: string, i: number) =>
        renderFormattedBlock(block, i, i === 0, false, true)
      )}

      {/* Embed */}
      <RenderEmbed embedData={embedData} />

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
  role: 'user' | 'assistant'
  content: string
  _placeholder?: boolean
  embedData?: any
  thinkingTime?: number
}

interface AIChatProps {
  onNavigateToPast?: () => void
  onStartNextLevel?: () => void
  initialMessage?: string
  onMessageHandled?: () => void
  onArrowReady?: () => void
  currentPhase: number
}

export function AIChat({
  onNavigateToPast,
  onStartNextLevel,
  initialMessage,
  onMessageHandled,
  onArrowReady,
  currentPhase
}: AIChatProps) {
  const { state, dispatch } = useUser()
  const { getResponse } = useAgent()
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null)
  const [turnFillPx, setTurnFillPx] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messageNodeMapRef = useRef(new Map<string, HTMLDivElement>())
  const initialMessageSent = useRef(false)
  const pendingMessageHandled = useRef(false)
  const thinkingTimeRef = useRef(0)
  const lastPhaseRef = useRef(currentPhase)

  // Ref callback for message nodes
  const handleMessageRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      messageNodeMapRef.current.set(id, node)
    } else {
      messageNodeMapRef.current.delete(id)
    }
  }, [])

  // Initialize with level completion message - resets when level changes
  useEffect(() => {
    // Check if level changed - reset the message
    if (lastPhaseRef.current !== currentPhase) {
      lastPhaseRef.current = currentPhase
      initialMessageSent.current = false
    }

    if (initialMessageSent.current) return
    initialMessageSent.current = true

    const existingMessages = (state.conversation || []).map((msg: any, i: number) => ({
      id: `existing-${i}`,
      role: msg.role,
      content: msg.content
    }))

    // Get message based on current level (defaults to level 2 message)
    const levelMessage = LEVEL_COMPLETE_MESSAGES[currentPhase] || LEVEL_COMPLETE_MESSAGES[2]

    const completionMessage: Message = {
      id: `level-complete-${currentPhase}`,
      role: 'assistant',
      content: levelMessage
    }

    setMessages([...existingMessages, completionMessage])
    setTimeout(() => onArrowReady?.(), 1500)
  }, [state.conversation, onArrowReady, currentPhase])

  // Handle incoming message from PastView
  useEffect(() => {
    if (initialMessage && !pendingMessageHandled.current) {
      pendingMessageHandled.current = true
      handleSendMessage(initialMessage)
      onMessageHandled?.()
    }
  }, [initialMessage])

  // Reset pending flag when initialMessage clears
  useEffect(() => {
    if (!initialMessage) {
      pendingMessageHandled.current = false
    }
  }, [initialMessage])

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

  const handleSendMessage = useCallback(async (content: string) => {
    setTurnFillPx(0)

    const userMessage: Message = { id: uid(), role: 'user', content }

    // Check for demo commands
    const normalizedContent = content.toLowerCase().trim()
    const demoCommand = DEMO_COMMANDS[normalizedContent]

    if (demoCommand) {
      // Handle demo command with embedded content
      const assistantTurn: Message = {
        id: uid(),
        role: 'assistant',
        content: '',
        _placeholder: true,
        embedData: demoCommand
      }

      setMessages(prev => [
        ...prev.map(msg => msg._placeholder ? { ...msg, _placeholder: false } : msg),
        userMessage,
        assistantTurn
      ])
      setFocusMessageId(userMessage.id)
      setStreamingMessageId(assistantTurn.id)
      setIsTyping(true)
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage })

      // Short thinking delay for demo commands
      await new Promise(resolve => setTimeout(resolve, 1200))
      const finalThinkingTime = thinkingTimeRef.current
      setIsTyping(false)

      // Update message to show embed content
      setMessages(prev => prev.map(msg =>
        msg.id === assistantTurn.id
          ? {
              ...msg,
              content: demoCommand.beforeText + '\n\n[EMBED]\n\n' + demoCommand.afterText,
              thinkingTime: finalThinkingTime,
              embedData: demoCommand
            }
          : msg
      ))

      dispatch({ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: demoCommand.beforeText } })
      return
    }

    // Regular message handling
    const assistantTurn: Message = {
      id: uid(),
      role: 'assistant',
      content: '',
      _placeholder: true
    }

    setMessages(prev => [
      ...prev.map(msg => msg._placeholder ? { ...msg, _placeholder: false } : msg),
      userMessage,
      assistantTurn
    ])
    setFocusMessageId(userMessage.id)
    setStreamingMessageId(assistantTurn.id)
    setIsTyping(true)
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage })

    await new Promise(resolve => setTimeout(resolve, 2300))

    const response = await getResponse('chat', state, content)
    const finalThinkingTime = thinkingTimeRef.current
    setIsTyping(false)

    setMessages(prev => prev.map(msg =>
      msg.id === assistantTurn.id
        ? {
            ...msg,
            content: response.message || response,
            thinkingTime: finalThinkingTime
          }
        : msg
    ))

    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: response.message || response } })
  }, [state, dispatch, getResponse])

  const handleStreamingComplete = useCallback(() => {
    setStreamingMessageId(null)
  }, [])

  const handleThinkingTimeUpdate = useCallback((ms: number) => {
    thinkingTimeRef.current = ms
  }, [])

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: '#FAF6F0',
    }}>
      {/* Header is now stationary in parent - no header here */}

      {/* Messages - with scroll behavior from ActiveChat */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '85px 20px 160px' }}>
          <div style={{
            maxWidth: '720px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
          }}>
            {messages.map((message) => {
              const isStreaming = message.id === streamingMessageId
              const isPlaceholder = message._placeholder
              const isFocusedUser = message.role === 'user' && message.id === focusMessageId

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
                    // CSS scroll-margin so scrollIntoView leaves space at top
                    scrollMarginTop: isFocusedUser ? 80 : undefined,
                  }}
                >
                  {message.role === 'user' ? (
                    <UserBubble>{message.content}</UserBubble>
                  ) : isStreaming ? (
                    isTyping ? (
                      <ThinkingIndicator onTimeUpdate={handleThinkingTimeUpdate} />
                    ) : message.embedData ? (
                      <EmbeddedRafaelMessage
                        embedData={message.embedData}
                        onComplete={handleStreamingComplete}
                      />
                    ) : (
                      <StreamingRafaelMessage
                        content={message.content || ''}
                        onComplete={handleStreamingComplete}
                      />
                    )
                  ) : message.embedData ? (
                    <CompletedEmbeddedMessage
                      embedData={message.embedData}
                      thinkingTime={message.thinkingTime}
                    />
                  ) : message.content ? (
                    <RafaelMessage content={message.content} thinkingTime={message.thinkingTime}>
                      <RafaelContent content={message.content} />
                    </RafaelMessage>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Chat input */}
      <ChatBar
        placeholder="Message Rafael..."
        onSend={handleSendMessage}
        disabled={isTyping}
      />
    </div>
  )
}
