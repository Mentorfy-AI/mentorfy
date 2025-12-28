import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { mentor } from '../../../data/rafael-ai/mentor'
import { useUser } from '../../../context/rafael-ai/UserContext'

const ACCENT_COLOR = '#10B981'

// Avatar component with black glow (consistent with ActiveChat)
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

// Rafael label with verified badge (matching ActiveChat)
function RafaelLabel({ size = 'large' }) {
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

// Audio Waveform Visualizer component
function AudioWaveform({ analyserNode, isRecording }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const dataArrayRef = useRef(null)
  const historyRef = useRef([])
  const lastUpdateRef = useRef(0)

  const BAR_COUNT = 50
  const UPDATE_INTERVAL = 50

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bufferLength = analyserNode.frequencyBinCount
    dataArrayRef.current = new Uint8Array(bufferLength)

    if (historyRef.current.length === 0) {
      historyRef.current = new Array(BAR_COUNT).fill(0)
    }

    const draw = (timestamp) => {
      if (!isRecording) return

      animationRef.current = requestAnimationFrame(draw)
      analyserNode.getByteTimeDomainData(dataArrayRef.current)

      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArrayRef.current[i] - 128) / 128
        sum += value * value
      }
      const rms = Math.sqrt(sum / bufferLength)
      const amplitude = Math.min(1, rms * 3)

      if (timestamp - lastUpdateRef.current > UPDATE_INTERVAL) {
        historyRef.current.push(amplitude)
        if (historyRef.current.length > BAR_COUNT) {
          historyRef.current.shift()
        }
        lastUpdateRef.current = timestamp
      }

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

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, 1.5)
        ctx.fill()
      }
    }

    if (isRecording) {
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
      style={{ display: 'block' }}
    />
  )
}

// Voice Recording Bar component
function VoiceRecordingBar({ onCancel, onSend, analyserNode }) {
  const [recordingTime, setRecordingTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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
        {/* Cancel Button */}
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

        {/* Send Button */}
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

// Chat input bar (matching ActiveChat's liquid glass style)
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

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      setAnalyserNode(analyser)

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

  const handleCancelRecording = () => {
    stopRecording()
    audioChunksRef.current = []
  }

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

export function ChatHome({ onStartLevel, onStartChat }) {
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
