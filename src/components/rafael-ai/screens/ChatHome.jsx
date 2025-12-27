import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { VideoEmbed } from '../shared/VideoEmbed'
import { mentor } from '../../../data/rafael-ai/mentor'
import { useUser } from '../../../context/rafael-ai/UserContext'
import { useAgent } from '../../../hooks/rafael-ai/useAgent'

const ACCENT_COLOR = '#10B981'

function Avatar({ size = 80 }) {
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

function RafaelLabel() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{
        fontSize: '13px',
        fontWeight: '600',
        color: '#444444',
        fontFamily: "'Lora', Charter, Georgia, serif",
      }}>
        Rafael Tats
      </span>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
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

function ChatInputBar({ placeholder, onSend, isDesktop = false }) {
  const [value, setValue] = useState('')

  const hasText = value.trim().length > 0

  const handleSend = () => {
    if (hasText) {
      onSend(value.trim())
      setValue('')
      // Reset textarea height
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

  // Auto-resize textarea
  const handleInput = (e) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  // Desktop: inline, not fixed
  // Mobile: fixed at bottom
  const wrapperStyle = isDesktop
    ? {}
    : {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px 24px',
        background: 'linear-gradient(to top, #FAFAFA 70%, rgba(250, 250, 250, 0))',
      }

  return (
    <div style={wrapperStyle}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: '20px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Text Area - full width at top */}
        <textarea
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
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

            {/* Send Button - glows green when active */}
            <div
              onClick={handleSend}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: hasText ? 'pointer' : 'default',
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

function parseMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: '600', color: '#111' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function ChatHome({ onStartLevel, onStartChat }) {
  const { state } = useUser()
  const { getResponse, isLoading } = useAgent()
  const [homeData, setHomeData] = useState(null)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    async function fetchHomeMessage() {
      const result = await getResponse('chat-home', state)
      setHomeData(result)
    }
    fetchHomeMessage()
  }, [state, getResponse])

  const videoUrl = homeData?.videoKey ? mentor.videos[homeData.videoKey]?.url : null

  // Desktop Layout
  if (isDesktop) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#FAFAFA',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px',
      }}>
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Avatar size={96} />
        </motion.div>

        {/* Name + Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          style={{ marginTop: '16px', marginBottom: '32px' }}
        >
          <RafaelLabel />
        </motion.div>

        {/* Chat Input - Centered on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ width: '100%', maxWidth: '600px', marginBottom: '40px' }}
        >
          <ChatInputBar
            placeholder="Message Rafael..."
            onSend={(message) => onStartChat(message)}
            isDesktop={true}
          />
        </motion.div>

        {/* Message Content - Below chat input */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{
            width: '100%',
            maxWidth: '480px',
            textAlign: 'left',
            fontFamily: "'Lora', Charter, Georgia, serif",
          }}
        >
          {isLoading || !homeData ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '2px solid #E5E5E5',
                borderTopColor: '#000',
                animation: 'spin 1s linear infinite',
              }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <>
              {homeData.message.split('\n\n').filter(p => p.trim()).map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: '18px',
                    lineHeight: '1.75',
                    color: '#222',
                    margin: 0,
                    marginTop: i > 0 ? '18px' : 0,
                  }}
                >
                  {parseMarkdown(paragraph)}
                </p>
              ))}

              {/* Video if present */}
              {videoUrl && (
                <div style={{ marginTop: '24px' }}>
                  <VideoEmbed url={videoUrl} maxWidth="480px" />
                </div>
              )}

              {/* CTA Button */}
              <button
                onClick={() => onStartLevel(state.progress.currentLevel)}
                style={{
                  width: '100%',
                  backgroundColor: '#000',
                  color: '#fff',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {homeData.buttonText} <span>→</span>
              </button>
            </>
          )}
        </motion.div>
      </div>
    )
  }

  // Mobile Layout
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FAFAFA',
    }}>
      {/* Scrollable Content Area */}
      <div style={{
        padding: '32px 20px',
        paddingBottom: '120px', // Space for fixed chat bar
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Avatar size={72} />
        </motion.div>

        {/* Name + Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          style={{ marginTop: '12px', marginBottom: '24px' }}
        >
          <RafaelLabel />
        </motion.div>

        {/* Message - LEFT ALIGNED */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            width: '100%',
            maxWidth: '360px',
            textAlign: 'left',
            fontFamily: "'Lora', Charter, Georgia, serif",
          }}
        >
          {isLoading || !homeData ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '2px solid #E5E5E5',
                borderTopColor: '#000',
                animation: 'spin 1s linear infinite',
              }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <>
              {homeData.message.split('\n\n').filter(p => p.trim()).map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: '17px',
                    lineHeight: '1.7',
                    color: '#222',
                    margin: 0,
                    marginTop: i > 0 ? '16px' : 0,
                  }}
                >
                  {parseMarkdown(paragraph)}
                </p>
              ))}

              {/* Video if present */}
              {videoUrl && (
                <div style={{ marginTop: '20px' }}>
                  <VideoEmbed url={videoUrl} maxWidth="360px" />
                </div>
              )}

              {/* CTA Button - Full Width */}
              <button
                onClick={() => onStartLevel(state.progress.currentLevel)}
                style={{
                  width: '100%',
                  backgroundColor: '#000',
                  color: '#fff',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '500',
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {homeData.buttonText} <span>→</span>
              </button>
            </>
          )}
        </motion.div>
      </div>

      {/* Fixed Input Area - Mobile only */}
      <ChatInputBar
        placeholder="Message Rafael..."
        onSend={(message) => onStartChat(message)}
      />
    </div>
  )
}
