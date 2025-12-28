import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VideoEmbed } from '../shared/VideoEmbed'
import { mentor } from '../../../data/rafael-ai/mentor'
import { useUser } from '../../../context/rafael-ai/UserContext'
import { useAgent } from '../../../hooks/rafael-ai/useAgent'

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
function containsPricingKeyword(message) {
  const lowerMessage = message.toLowerCase()
  return PRICING_KEYWORDS.some(keyword => lowerMessage.includes(keyword))
}

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
        fontFamily: "'Lora', Charter, Georgia, serif",
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
        boxShadow: '0 6px 28px rgba(16, 185, 129, 0.55)',
      }}>
        {children}
      </div>
    </motion.div>
  )
}

// Copy button component
function CopyButton({ content }) {
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

// Rafael message - no container, Lora font, full width
function RafaelMessage({ children, content, thinkingTime }) {
  // Format time as seconds with 2 decimal places
  const formatTime = (ms) => {
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

// Thinking indicator with green shimmer animation and timer
function ThinkingIndicator({ onTimeUpdate }) {
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
  const formatTime = (ms) => {
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

// Inline Video Embed component for streaming messages
function InlineVideoEmbed({ url, isVisible }) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Extract video info from URL
  const getVideoInfo = (url) => {
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
              e.target.style.display = 'none'
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

// Streaming message component - shows text character by character
function StreamingRafaelMessage({ content, videoUrl, onComplete }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [videoVisible, setVideoVisible] = useState(false)
  const streamSpeed = 5 // ms per character
  const videoMarker = '[VIDEO]'
  const videoShownRef = useRef(false)

  useEffect(() => {
    if (!content) return

    let index = 0
    let interval
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

  const renderStreamingBlock = (block, index) => {
    const isFirst = index === 0
    const marginTop = isFirst ? 0 : '20px'
    const isLastBlock = index === blocks.length - 1

    // Check for video marker
    if (block.trim() === '[VIDEO]' || block.includes('[VIDEO]')) {
      return (
        <InlineVideoEmbed
          key={index}
          url={videoUrl}
          isVisible={videoVisible}
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

// Audio Waveform Visualizer component - scrolling waveform like Claude
function AudioWaveform({ analyserNode, isRecording }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const dataArrayRef = useRef(null)
  const historyRef = useRef([]) // Rolling history of amplitude values
  const lastUpdateRef = useRef(0)

  const BAR_COUNT = 50
  const UPDATE_INTERVAL = 50 // ms between adding new samples

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bufferLength = analyserNode.frequencyBinCount
    dataArrayRef.current = new Uint8Array(bufferLength)

    // Initialize history with zeros (silent)
    if (historyRef.current.length === 0) {
      historyRef.current = new Array(BAR_COUNT).fill(0)
    }

    const draw = (timestamp) => {
      if (!isRecording) return

      animationRef.current = requestAnimationFrame(draw)
      analyserNode.getByteTimeDomainData(dataArrayRef.current)

      // Calculate current amplitude (RMS)
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArrayRef.current[i] - 128) / 128
        sum += value * value
      }
      const rms = Math.sqrt(sum / bufferLength)
      const amplitude = Math.min(1, rms * 3) // Normalize and boost

      // Add new sample to history at regular intervals (pushes from right)
      if (timestamp - lastUpdateRef.current > UPDATE_INTERVAL) {
        historyRef.current.push(amplitude)
        // Remove oldest sample from the left
        if (historyRef.current.length > BAR_COUNT) {
          historyRef.current.shift()
        }
        lastUpdateRef.current = timestamp
      }

      // Draw
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      const barWidth = 3
      const barGap = 2
      const totalWidth = BAR_COUNT * (barWidth + barGap) - barGap
      const startX = (width - totalWidth) / 2

      for (let i = 0; i < historyRef.current.length; i++) {
        const value = historyRef.current[i]
        const minHeight = 3
        const maxHeight = height * 0.85
        const barHeight = Math.max(minHeight, value * maxHeight)

        const x = startX + i * (barWidth + barGap)
        const y = (height - barHeight) / 2

        // Draw rounded bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, 1.5)
        ctx.fill()
      }
    }

    if (isRecording) {
      // Reset history when starting
      historyRef.current = new Array(BAR_COUNT).fill(0)
      lastUpdateRef.current = 0
      draw(0)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [analyserNode, isRecording])

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={40}
      style={{
        display: 'block',
      }}
    />
  )
}

// Voice Recording Bar component
function VoiceRecordingBar({ onCancel, onSend, analyserNode }) {
  const [recordingTime, setRecordingTime] = useState(0)

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Format time as M:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 20px 24px',
        background: 'transparent',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ backgroundColor: 'rgba(255, 255, 255, 0.25)' }}
        animate={{ backgroundColor: ACCENT_COLOR }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          maxWidth: '720px',
          borderRadius: '20px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: `0 4px 30px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.2)`,
          minHeight: '68px',
        }}
      >
        {/* Cancel Button - Left */}
        <motion.button
          onClick={onCancel}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </motion.button>

        {/* Center - Waveform + Timer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <AudioWaveform analyserNode={analyserNode} isRecording={true} />
          <span style={{
            fontFamily: "'Geist', -apple-system, sans-serif",
            fontSize: '15px',
            fontWeight: '500',
            color: 'rgba(255, 255, 255, 0.9)',
            minWidth: '40px',
          }}>
            {formatTime(recordingTime)}
          </span>
        </motion.div>

        {/* Send Button - Right */}
        <motion.button
          onClick={onSend}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

// Chat input bar (same as ChatHome)
function ChatInputBar({ placeholder, onSend, disabled }) {
  const [value, setValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [analyserNode, setAnalyserNode] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)

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

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up Web Audio API for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      setAnalyserNode(analyser)

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
    }
  }

  // Stop recording and cleanup
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    setIsRecording(false)
    setAnalyserNode(null)
  }

  // Cancel recording
  const handleCancelRecording = () => {
    stopRecording()
    audioChunksRef.current = []
  }

  // Transcribe audio using OpenAI Whisper API
  const transcribeAudio = async (audioBlob) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Transcription failed')
    }

    const data = await response.json()
    return data.text
  }

  // Send voice recording - transcribe and send as message
  const handleSendRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        try {
          const transcribedText = await transcribeAudio(audioBlob)
          if (transcribedText && transcribedText.trim()) {
            onSend(transcribedText.trim())
          }
        } catch (error) {
          console.error('Transcription error:', error)
        } finally {
          audioChunksRef.current = []
        }
      }
    }
    stopRecording()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording()
      }
    }
  }, [])

  return (
    <AnimatePresence mode="wait">
      {isRecording ? (
        <VoiceRecordingBar
          key="recording"
          onCancel={handleCancelRecording}
          onSend={handleSendRecording}
          analyserNode={analyserNode}
        />
      ) : (
        <motion.div
          key="input"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 20px 24px',
            background: 'transparent',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '720px',
            background: 'rgba(255, 255, 255, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '20px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
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
                background: '#F0EBE4',
                border: '1px solid #E8E3DC',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>

              {/* Center - Subtle watermark */}
              <div style={{
                fontFamily: "'Lora', Charter, Georgia, serif",
                fontSize: '9px',
                fontWeight: '500',
                letterSpacing: '0.1em',
                color: 'rgba(0, 0, 0, 0.12)',
                textTransform: 'uppercase',
              }}>
                Mentorfy AI Experience
              </div>

              {/* Right side - Mic + Send */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Mic Icon */}
                <motion.div
                  onClick={!disabled ? startRecording : undefined}
                  whileHover={!disabled ? { scale: 1.05 } : {}}
                  whileTap={!disabled ? { scale: 0.95 } : {}}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#F0EBE4',
                    border: '1px solid #E8E3DC',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    cursor: disabled ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                  </svg>
                </motion.div>

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
                    backgroundColor: hasText ? ACCENT_COLOR : '#F0EBE4',
                    border: hasText ? 'none' : '1px solid #E8E3DC',
                    boxShadow: hasText
                      ? `0 0 10px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.25)`
                      : '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={hasText ? '#FFFFFF' : '#666'}
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
        </motion.div>
      )}
    </AnimatePresence>
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

    // Check for video marker
    if (block.trim() === '[VIDEO]' || block.includes('[VIDEO]')) {
      return (
        <InlineVideoEmbed
          key={index}
          url={videoUrl}
          isVisible={true}
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
  const thinkingTimeRef = useRef(0) // Track thinking time

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

    // Add artificial delay to see thinking animation (2.3 seconds)
    await new Promise(resolve => setTimeout(resolve, 2300))

    // Check for pricing keywords - use mock response if found
    let response
    if (containsPricingKeyword(content)) {
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
            videoUrl: response.videoUrl || (response.videoKey ? mentor.videos[response.videoKey]?.url : null),
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

  // Update thinking time ref from ThinkingIndicator
  const handleThinkingTimeUpdate = useCallback((ms) => {
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
                          onComplete={handleStreamingComplete}
                        />
                      )
                    ) : message.content ? (
                      <RafaelMessage content={message.content} thinkingTime={message.thinkingTime}>
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
