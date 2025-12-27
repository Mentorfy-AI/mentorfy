import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VideoEmbed } from '../shared/VideoEmbed'
import { mentor } from '../../../data/rafael-ai/mentor'
import { useUser } from '../../../context/rafael-ai/UserContext'
import { useAgent } from '../../../hooks/rafael-ai/useAgent'

const ACCENT_COLOR = '#10B981'

// Avatar component with black glow (consistent with rest of app)
function Avatar({ size = 32 }) {
  const [imgError, setImgError] = useState(false)
  const rgb = { r: 0, g: 0, b: 0 }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '9999px',
        overflow: 'hidden',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 6px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4), 0 0 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25), 0 0 32px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
      }}
    >
      {imgError ? (
        <span style={{ color: '#FFFFFF', fontSize: size * 0.4, fontWeight: '500' }}>R</span>
      ) : (
        <img
          src={mentor.avatar}
          alt="Rafael"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}

// Rafael label with verified badge
function RafaelLabel({ size = 'default' }) {
  const isLarge = size === 'large'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        fontSize: isLarge ? '19px' : '15px',
        fontWeight: '600',
        color: '#111',
        fontFamily: "'Geist', sans-serif",
      }}>
        {mentor.name}
      </span>
      <svg width={isLarge ? 20 : 16} height={isLarge ? 20 : 16} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
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
  )
}

// User message bubble - green, right-aligned
function UserBubble({ children }) {
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
      }}>
        {children}
      </div>
    </motion.div>
  )
}

// Rafael message - no container, Lora font, full width
function RafaelMessage({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}
    >
      {children}
    </motion.div>
  )
}

// Thinking indicator with shimmer animation
function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <span
        style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: '17px',
          fontWeight: '600',
          color: '#9CA3AF',
          position: 'relative',
          display: 'inline-block',
        }}
      >
        Thinking...
        {/* Shimmer overlay */}
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            pointerEvents: 'none',
          }}
        />
      </span>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </motion.div>
  )
}

// Streaming message component - shows text character by character
function StreamingRafaelMessage({ content, onComplete }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const streamSpeed = 5 // ms per character

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

  // Parse the displayed text for rendering
  const blocks = displayedText.split('\n\n').filter(p => p.trim())

  const renderStreamingBlock = (block, index) => {
    const isFirst = index === 0
    const marginTop = isFirst ? 0 : '20px'
    const isLastBlock = index === blocks.length - 1

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

// Chat input bar (same as ChatHome)
function ChatInputBar({ placeholder, onSend, disabled }) {
  const [value, setValue] = useState('')

  const hasText = value.trim().length > 0

  const handleSend = () => {
    if (hasText && !disabled) {
      onSend(value.trim())
      setValue('')
      const textarea = document.querySelector('textarea')
      if (textarea) textarea.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px 20px 24px',
      background: 'linear-gradient(to top, #FAFAFA 70%, rgba(250, 250, 250, 0))',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '720px',
        background: '#FFFFFF',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: '20px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.1)',
        opacity: disabled ? 0.6 : 1,
      }}>
        {/* Text Area */}
        <textarea
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            width: '100%',
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '15px',
            color: '#111',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            resize: 'none',
            lineHeight: '1.5',
            minHeight: '22px',
            maxHeight: '150px',
            padding: 0,
          }}
        />

        {/* Bottom row - buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left side - Plus icon */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '1.5px solid #E0E0E0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>

          {/* Right side - Mic + Send */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mic Icon */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1.5px solid #E0E0E0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </div>

            {/* Send Button */}
            <div
              onClick={handleSend}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: hasText && !disabled ? 'pointer' : 'default',
                backgroundColor: hasText ? ACCENT_COLOR : 'transparent',
                border: hasText ? 'none' : '1.5px solid #E0E0E0',
                boxShadow: hasText
                  ? `0 0 10px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.25)`
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke={hasText ? '#FFFFFF' : '#CCC'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'stroke 0.2s ease' }}
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Parse inline markdown (bold, italic)
function parseInlineMarkdown(text) {
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

// Format Rafael's message content with proper styling
function RafaelContent({ content, videoUrl }) {
  const blocks = content.split('\n\n').filter(p => p.trim())

  const renderBlock = (block, index) => {
    const isFirst = index === 0
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

  return (
    <>
      {blocks.map((block, i) => renderBlock(block, i))}

      {videoUrl && (
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
    role: 'user',
    content: "What's the most important thing I should focus on first?"
  },
  {
    role: 'assistant',
    content: `Your positioning.

Everything else — content, pricing, sales — gets 10x easier once you're positioned correctly. We need to make you the *only* choice for a specific type of client.`
  },
  {
    role: 'user',
    content: 'How do I actually do that?'
  },
  {
    role: 'assistant',
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

export function ActiveChat({ initialMessage, onBack }) {
  const { state, dispatch } = useUser()
  const { getResponse } = useAgent()
  const [messages, setMessages] = useState(SAMPLE_MESSAGES_WITH_IDS)
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState(null)
  const [focusMessageId, setFocusMessageId] = useState(null)
  const [turnFillPx, setTurnFillPx] = useState(0) // Min height for placeholder to create scroll space
  const scrollContainerRef = useRef(null)
  const streamingNodeRef = useRef(null)
  const messageNodeMapRef = useRef(new Map())
  const initialMessageSent = useRef(false)

  // Ref callback for message nodes - memoize per ID to avoid re-renders
  const refCallbacksRef = useRef(new Map())
  const getRefCallback = useCallback((id) => {
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
      promptNode.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }, [turnFillPx, focusMessageId])

  // Effect C removed - no auto-scroll needed during streaming
  // User can scroll manually once content is in viewport


  const handleSendMessage = useCallback(async (content) => {
    // Reset filler from previous turn
    setTurnFillPx(0)

    // Create both messages with unique IDs
    const userMessage = { id: uid(), role: 'user', content }
    const assistantTurn = {
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

    // Get AI response
    const response = await getResponse('chat', state, content)

    setIsTyping(false)

    // Update the assistant message content IN PLACE
    // KEEP _placeholder true - filler removal happens in ResizeObserver when content is tall enough
    setMessages(prev => prev.map(msg =>
      msg.id === assistantTurn.id
        ? {
            ...msg,
            content: response.message || response,
            videoUrl: response.videoKey ? mentor.videos[response.videoKey]?.url : null
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
      backgroundColor: '#FAFAFA',
    }}>
      {/* Header - Sticky */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid #F0F0F0',
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#FFFFFF',
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px',
            marginLeft: '-8px',
            color: '#666',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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

        <div style={{ width: '36px' }} /> {/* Spacer for centering */}
      </div>

      {/* Messages - Scroll Container (no padding here for sticky to work) */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {/* Inner wrapper with padding */}
        <div style={{ padding: '24px 20px 140px' }}>
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
                      scrollMarginTop: isFocusedUser ? 16 : undefined,
                    }}
                  >
                    {message.role === 'user' ? (
                      <UserBubble>
                        {message.content}
                      </UserBubble>
                    ) : isStreaming ? (
                      // Streaming assistant row - NEVER return null to keep DOM stable
                      isTyping ? (
                        <ThinkingIndicator />
                      ) : (
                        // Always render StreamingRafaelMessage - it handles empty content gracefully
                        <StreamingRafaelMessage
                          content={message.content || ''}
                          onComplete={handleStreamingComplete}
                        />
                      )
                    ) : message.content ? (
                      <RafaelMessage>
                        <RafaelContent
                          content={message.content}
                          videoUrl={message.videoUrl}
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
