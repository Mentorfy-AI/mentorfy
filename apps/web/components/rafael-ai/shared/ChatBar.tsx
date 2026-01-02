'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ACCENT_COLOR = '#10B981'

interface AudioWaveformProps {
  analyserNode: AnalyserNode | null
  isRecording: boolean
}

// Audio Waveform Visualizer component
function AudioWaveform({ analyserNode, isRecording }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const historyRef = useRef<number[]>([])
  const lastUpdateRef = useRef(0)

  const BAR_COUNT = 50
  const UPDATE_INTERVAL = 50

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyserNode.frequencyBinCount
    dataArrayRef.current = new Uint8Array(bufferLength)

    if (historyRef.current.length === 0) {
      historyRef.current = new Array(BAR_COUNT).fill(0)
    }

    const draw = (timestamp: number) => {
      if (!isRecording) return

      animationRef.current = requestAnimationFrame(draw)
      analyserNode.getByteTimeDomainData(dataArrayRef.current!)

      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArrayRef.current![i] - 128) / 128
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

interface VoiceRecordingBarProps {
  onCancel: () => void
  onSend: () => void
  analyserNode: AnalyserNode | null
}

// Voice Recording Bar component
function VoiceRecordingBar({ onCancel, onSend, analyserNode }: VoiceRecordingBarProps) {
  const [recordingTime, setRecordingTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
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

interface ChatBarProps {
  placeholder?: string
  onSend: (message: string) => void
  disabled?: boolean
}

// Chat input bar with liquid glass style
export function ChatBar({ placeholder = "Message Rafael...", onSend, disabled }: ChatBarProps) {
  const [value, setValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const hasText = value.trim().length > 0

  const handleSend = () => {
    if (hasText && !disabled) {
      onSend(value.trim())
      setValue('')
      const textarea = document.querySelector('textarea')
      if (textarea) (textarea as HTMLTextAreaElement).style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
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

  const transcribeAudio = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
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
