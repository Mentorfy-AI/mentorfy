'use client'

import { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassHeader } from '../shared/GlassHeader'
import { StepProgress } from '../shared/StepProgress'
import { ThinkingAnimation } from '../shared/ThinkingAnimation'
import { WhopCheckoutEmbed } from '@whop/checkout/react'
import { InlineWidget, useCalendlyEventListener } from 'react-calendly'
import { phases } from '@/data/rafael-ai/phases'
import { mentor } from '@/data/rafael-ai/mentor'
import { useUser } from '@/context/UserContext'
import { useAgent } from '@/hooks/useAgent'
import { COLORS, TIMING } from '@/config/rafael-ai'

interface MultipleChoiceStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: string) => void
}

function MultipleChoiceStepContent({ step, onAnswer }: MultipleChoiceStepContentProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = (option: { value: string; label: string }) => {
    setSelected(option.value)
    // Brief delay to show selection, then advance
    setTimeout(() => {
      onAnswer(step.stateKey, option.value)
    }, 200)
  }

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      padding: '140px 24px 48px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Progress is now persistent in parent */}

      {/* Question - Main Focus (no avatar) */}
      <div style={{
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '24px',
        fontWeight: '600',
        color: '#000',
        textAlign: 'center',
        lineHeight: '1.4',
        marginBottom: '32px',
      }}>
        {step.question}
      </div>

      {/* Options - Raised button styling like back button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {step.options.map((option: { value: string; label: string }) => (
          <motion.button
            key={option.value}
            onClick={() => handleSelect(option)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%',
              padding: '18px 20px',
              borderRadius: '14px',
              backgroundColor: selected === option.value ? 'rgba(16, 185, 129, 0.12)' : '#F0EBE4',
              border: selected === option.value ? `2px solid ${COLORS.ACCENT}` : '1px solid #E8E3DC',
              cursor: 'pointer',
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: '17px',
              fontWeight: '500',
              color: '#111',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxShadow: selected === option.value
                ? `0 0 0 2px ${COLORS.ACCENT}, 0 4px 12px rgba(16, 185, 129, 0.25)`
                : '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            }}
          >
            {option.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

interface LongAnswerStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: string) => void
}

function LongAnswerStepContent({ step, onAnswer }: LongAnswerStepContentProps) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const isValid = value.trim().length >= 3

  const handleSubmit = () => {
    if (isValid) {
      onAnswer(step.stateKey, value.trim())
    }
  }

  return (
    <div style={{
      maxWidth: '540px',
      margin: '0 auto',
      padding: '140px 24px 48px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Progress is now persistent in parent */}

      {/* Question - Main Focus (no avatar) */}
      <div style={{
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '24px',
        fontWeight: '600',
        color: '#000',
        textAlign: 'center',
        lineHeight: '1.4',
        marginBottom: '32px',
      }}>
        {step.question}
      </div>

      {/* Text Area - Inner shadow styling (typing into the page) */}
      <div style={{
        backgroundColor: '#E8E3DC',
        border: isFocused ? `2px solid ${COLORS.ACCENT}` : '1px solid #DDD8D0',
        borderRadius: '14px',
        padding: '16px',
        minHeight: '160px',
        marginBottom: '20px',
        boxShadow: isFocused
          ? `inset 0 2px 6px rgba(0, 0, 0, 0.12), inset 0 1px 2px rgba(0, 0, 0, 0.08), 0 0 0 3px rgba(16, 185, 129, 0.15)`
          : 'inset 0 2px 6px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.15s ease',
      }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={step.placeholder}
          style={{
            width: '100%',
            height: '128px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: '16px',
            color: '#111',
            lineHeight: '1.7',
            backgroundColor: 'transparent',
          }}
        />
      </div>

      {/* Continue Button - Green */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid}
          whileHover={isValid ? { scale: 1.02 } : {}}
          whileTap={isValid ? { scale: 0.98 } : {}}
          style={{
            backgroundColor: isValid ? COLORS.ACCENT : 'rgba(0, 0, 0, 0.06)',
            color: isValid ? '#FFFFFF' : '#999',
            padding: '14px 28px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '500',
            border: 'none',
            cursor: isValid ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Geist', -apple-system, sans-serif",
            boxShadow: isValid ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          Continue <span>→</span>
        </motion.button>
      </div>
    </div>
  )
}

interface ContactInfoStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: Record<string, string>) => void
}

function ContactInfoStepContent({ step, onAnswer }: ContactInfoStepContentProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const isValid = step.fields.every((field: any) => {
    const val = values[field.key]?.trim()
    if (!val) return false
    if (field.type === 'email') return val.includes('@') && val.includes('.')
    return val.length >= 2
  })

  const handleSubmit = () => {
    if (isValid) {
      onAnswer(step.stateKey, values)
    }
  }

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      padding: '140px 24px 48px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Progress is now persistent in parent */}

      {/* Question - Main Focus (no avatar) */}
      <div style={{
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '24px',
        fontWeight: '600',
        color: '#000',
        textAlign: 'center',
        lineHeight: '1.4',
        marginBottom: '32px',
      }}>
        {step.question}
      </div>

      {/* Input Fields - Inner shadow styling (typing into the page) */}
      <style>{`
        .contact-input:-webkit-autofill,
        .contact-input:-webkit-autofill:hover,
        .contact-input:-webkit-autofill:focus,
        .contact-input:-webkit-autofill:active {
          -webkit-box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(0, 0, 0, 0.06), 0 0 0 1000px #E8E3DC inset !important;
          -webkit-text-fill-color: #111 !important;
          background-color: #E8E3DC !important;
          caret-color: #111;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        {step.fields.map((field: any) => (
          <input
            key={field.key}
            id={field.key}
            name={field.key}
            type={field.type}
            autoComplete={field.autoComplete || 'off'}
            className="contact-input"
            value={values[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onFocus={() => setFocusedField(field.key)}
            onBlur={() => setFocusedField(null)}
            placeholder={field.placeholder}
            style={{
              width: '100%',
              padding: '18px 20px',
              backgroundColor: '#E8E3DC',
              border: focusedField === field.key ? `2px solid ${COLORS.ACCENT}` : '1px solid #DDD8D0',
              borderRadius: '14px',
              fontSize: '16px',
              fontFamily: "'Lora', Charter, Georgia, serif",
              color: '#111',
              outline: 'none',
              boxShadow: focusedField === field.key
                ? `inset 0 2px 6px rgba(0, 0, 0, 0.12), inset 0 1px 2px rgba(0, 0, 0, 0.08), 0 0 0 3px rgba(16, 185, 129, 0.15)`
                : 'inset 0 2px 6px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.15s ease',
            }}
          />
        ))}
      </div>

      {/* Continue Button - Green */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid}
          whileHover={isValid ? { scale: 1.02 } : {}}
          whileTap={isValid ? { scale: 0.98 } : {}}
          style={{
            backgroundColor: isValid ? COLORS.ACCENT : 'rgba(0, 0, 0, 0.06)',
            color: isValid ? '#FFFFFF' : '#999',
            padding: '14px 28px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '500',
            border: 'none',
            cursor: isValid ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Geist', -apple-system, sans-serif",
            boxShadow: isValid ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          Continue <span>→</span>
        </motion.button>
      </div>
    </div>
  )
}

interface ThinkingStepContentProps {
  step: any
  onComplete: () => void
}

function ThinkingStepContent({ step, onComplete }: ThinkingStepContentProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '400px',
        margin: '0 auto',
        width: '100%',
        padding: '100px 24px 48px',
      }}>
        <div style={{ width: '100%' }}>
          <ThinkingAnimation
            messages={step.messages}
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  )
}

interface AIMomentStepContentProps {
  step: any
  state: any
  onContinue: () => void
}

function AIMomentStepContent({ step, state, onContinue }: AIMomentStepContentProps) {
  const { getResponse } = useAgent()
  const [response, setResponse] = useState<string | null>(null)

  // Thinking animation state
  const [displayText, setDisplayText] = useState('')
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  // If skipThinking is true, start directly in 'waiting' phase (wait for response, then stream)
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting' | 'transitioning' | 'waiting' | 'streaming'>(step.skipThinking ? 'waiting' : 'typing')

  // Streaming state
  const [streamedHeadline, setStreamedHeadline] = useState('')
  const [streamedParagraphs, setStreamedParagraphs] = useState<string[]>([])
  const [currentStreamParagraph, setCurrentStreamParagraph] = useState(0)
  const [streamingComplete, setStreamingComplete] = useState(false)

  const thinkingMessages = [
    { text: "Give me a second...", pauseAfter: 800 },
    { text: "I'm thinking about what you shared with me...", pauseAfter: 1200 },
    { text: "Crafting a response for your situation...", pauseAfter: 1500, transitionToResponse: true }
  ]

  const typeSpeed = 45
  const deleteSpeed = 12
  const streamSpeed = 30

  // Fetch response in background
  useEffect(() => {
    async function fetchResponse() {
      const result = await getResponse(step.promptKey, state)
      const text = typeof result === 'string' ? result : (result.message || result)
      setResponse(text)
    }
    fetchResponse()
  }, [step.promptKey, state, getResponse])

  // Parse response into headline and paragraphs
  const parsedResponse = useCallback(() => {
    if (!response) return { headline: '', paragraphs: [] as string[] }
    const lines = response.split('\n').filter((l: string) => l.trim())
    const headline = lines[0] || ''
    const paragraphs = lines.slice(1)
    return { headline, paragraphs }
  }, [response])

  // Parse text with bold markers (**text**)
  const parseTextWithBold = (text: string) => {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: '600', color: '#000' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  // Thinking + Streaming animation
  useEffect(() => {
    let timeout: NodeJS.Timeout

    if (phase === 'typing') {
      const currentMessage = thinkingMessages[currentMessageIndex]
      if (displayText.length < currentMessage.text.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentMessage.text.slice(0, displayText.length + 1))
        }, typeSpeed + (Math.random() * 30 - 15))
      } else {
        setPhase('pausing')
      }
    } else if (phase === 'pausing') {
      const currentMessage = thinkingMessages[currentMessageIndex]
      timeout = setTimeout(() => {
        if ((currentMessage as any).transitionToResponse) {
          setPhase('transitioning')
        } else {
          setPhase('deleting')
        }
      }, currentMessage.pauseAfter)
    } else if (phase === 'deleting') {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, deleteSpeed)
      } else {
        setCurrentMessageIndex(currentMessageIndex + 1)
        setPhase('typing')
      }
    } else if (phase === 'transitioning') {
      timeout = setTimeout(() => {
        setDisplayText('')
        if (response) {
          setPhase('streaming')
        }
      }, 400)
    } else if (phase === 'streaming' && response) {
      const { headline, paragraphs } = parsedResponse()

      // Stream headline first
      if (streamedHeadline.length < headline.length) {
        timeout = setTimeout(() => {
          const chunkSize = Math.floor(Math.random() * 3) + 2
          setStreamedHeadline(headline.slice(0, streamedHeadline.length + chunkSize))
        }, streamSpeed)
      }
      // Then stream paragraphs
      else if (currentStreamParagraph < paragraphs.length) {
        const currentPara = paragraphs[currentStreamParagraph]
        const streamedPara = streamedParagraphs[currentStreamParagraph] || ''

        if (streamedPara.length < currentPara.length) {
          timeout = setTimeout(() => {
            const chunkSize = Math.floor(Math.random() * 4) + 3
            setStreamedParagraphs(prev => {
              const newParagraphs = [...prev]
              newParagraphs[currentStreamParagraph] = currentPara.slice(0, streamedPara.length + chunkSize)
              return newParagraphs
            })
          }, streamSpeed)
        } else {
          setCurrentStreamParagraph(currentStreamParagraph + 1)
        }
      } else {
        setStreamingComplete(true)
      }
    }

    return () => clearTimeout(timeout)
  }, [displayText, phase, currentMessageIndex, response, streamedHeadline, streamedParagraphs, currentStreamParagraph, parsedResponse])

  // If transitioning or waiting but no response yet, wait
  useEffect(() => {
    if ((phase === 'transitioning' || phase === 'waiting') && !response) {
      // Keep waiting
    } else if (phase === 'transitioning' && response) {
      const timeout = setTimeout(() => {
        setDisplayText('')
        setPhase('streaming')
      }, 100)
      return () => clearTimeout(timeout)
    } else if (phase === 'waiting' && response) {
      // Skip thinking, go straight to streaming
      setPhase('streaming')
    }
  }, [phase, response])

  const isInThinkingPhase = phase === 'typing' || phase === 'pausing' || phase === 'deleting' || phase === 'transitioning'
  const isInWaitingPhase = phase === 'waiting'
  const isInStreamingPhase = phase === 'streaming'
  const { headline, paragraphs } = parsedResponse()

  return (
    <>
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '140px 24px 48px',
      }}>
        {/* Progress is now persistent in parent */}

        {/* Thinking Phase - Centered typing */}
        {isInThinkingPhase && (
          <div style={{
            textAlign: 'center',
            opacity: phase === 'transitioning' ? 0 : 1,
            transition: 'opacity 0.3s ease-out',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <p style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: '20px',
              fontWeight: '400',
              color: '#333333',
              lineHeight: '1.5',
              margin: 0,
              display: 'inline',
            }}>
              {displayText}
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '1.2em',
                backgroundColor: '#333333',
                marginLeft: '2px',
                verticalAlign: 'text-bottom',
                animation: 'cursorBlink 1s step-end infinite',
              }} />
            </p>
          </div>
        )}

        {/* Waiting Phase - Just a blinking cursor while loading */}
        {isInWaitingPhase && (
          <div style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            minHeight: '200px',
          }}>
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '1.2em',
              backgroundColor: '#333333',
              animation: 'cursorBlink 1s step-end infinite',
            }} />
          </div>
        )}

        {/* Streaming Phase - Left-aligned response */}
        {isInStreamingPhase && (
          <div style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}>
            {/* Headline */}
            {streamedHeadline && (
              <h1 style={{
                fontSize: '28px',
                fontWeight: '600',
                color: '#000',
                lineHeight: '1.3',
                margin: 0,
                marginBottom: '24px',
              }}>
                {streamedHeadline}
                {streamedHeadline.length < headline.length && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '0.9em',
                    backgroundColor: '#333333',
                    marginLeft: '3px',
                    verticalAlign: 'baseline',
                    animation: 'cursorBlink 1s step-end infinite',
                  }} />
                )}
              </h1>
            )}

            {/* Paragraphs */}
            {streamedParagraphs.map((para, i) => (
              <p key={i} style={{
                fontSize: '17px',
                lineHeight: '1.75',
                color: '#222',
                margin: 0,
                marginTop: i > 0 ? '20px' : 0,
              }}>
                {para}
                {i === streamedParagraphs.length - 1 &&
                 (para.length < paragraphs[i]?.length ||
                  currentStreamParagraph < paragraphs.length) && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1em',
                    backgroundColor: '#333333',
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    animation: 'cursorBlink 1s step-end infinite',
                  }} />
                )}
              </p>
            ))}

            {/* Cursor after headline if no paragraphs yet */}
            {streamedHeadline.length >= headline.length &&
             streamedParagraphs.length === 0 && paragraphs.length > 0 && (
              <p style={{
                fontSize: '17px',
                lineHeight: '1.75',
                color: '#222',
                margin: 0,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '2px',
                  height: '1em',
                  backgroundColor: '#333333',
                  animation: 'cursorBlink 1s step-end infinite',
                }} />
              </p>
            )}
          </div>
        )}

        {/* Continue Button - Green */}
        {streamingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}
          >
            <motion.button
              onClick={onContinue}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                backgroundColor: COLORS.ACCENT,
                color: '#FFFFFF',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: "'Geist', -apple-system, sans-serif",
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              Continue <span>→</span>
            </motion.button>
          </motion.div>
        )}
      </div>
    </>
  )
}

interface VideoStepContentProps {
  step: any
  onContinue: () => void
}

function VideoStepContent({ step, onContinue }: VideoStepContentProps) {
  const video = (mentor.videos as any)[step.videoKey]

  // Sequential animation states
  const [streamedText, setStreamedText] = useState('')
  const [textComplete, setTextComplete] = useState(!step.introText)
  const [videoVisible, setVideoVisible] = useState(!step.introText)
  const [buttonVisible, setButtonVisible] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const streamSpeed = 25

  // Stream text first
  useEffect(() => {
    if (!step.introText) {
      setTextComplete(true)
      return
    }

    let timeout: NodeJS.Timeout
    if (streamedText.length < step.introText.length) {
      timeout = setTimeout(() => {
        const chunkSize = Math.floor(Math.random() * 4) + 2
        setStreamedText(step.introText.slice(0, streamedText.length + chunkSize))
      }, streamSpeed)
    } else {
      setTextComplete(true)
    }

    return () => clearTimeout(timeout)
  }, [streamedText, step.introText])

  // After text complete, show video
  useEffect(() => {
    if (textComplete && !videoVisible) {
      const timeout = setTimeout(() => setVideoVisible(true), 300)
      return () => clearTimeout(timeout)
    }
  }, [textComplete, videoVisible])

  // After video visible, show button
  useEffect(() => {
    if (videoVisible && !buttonVisible) {
      const timeout = setTimeout(() => setButtonVisible(true), 500)
      return () => clearTimeout(timeout)
    }
  }, [videoVisible, buttonVisible])

  // Split streamed text into paragraphs for display
  const displayParagraphs = streamedText.split('\n\n')

  // Video embed info
  const getVideoInfo = (url: string) => {
    if (!url) return null
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/)
    if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }
    const wistiaMatch = url.match(/wistia\.com\/medias\/([^?/]+)/)
    if (wistiaMatch) return { provider: 'wistia', id: wistiaMatch[1] }
    return null
  }

  const videoInfo = getVideoInfo(video?.url)
  const thumbnailUrl = videoInfo?.provider === 'youtube'
    ? `https://img.youtube.com/vi/${videoInfo.id}/maxresdefault.jpg`
    : videoInfo?.provider === 'wistia'
      ? `https://fast.wistia.com/embed/medias/${videoInfo.id}/swatch`
      : null
  const embedUrl = videoInfo?.provider === 'youtube'
    ? `https://www.youtube.com/embed/${videoInfo.id}?autoplay=1&rel=0`
    : videoInfo?.provider === 'wistia'
      ? `https://fast.wistia.net/embed/iframe/${videoInfo.id}?autoplay=1`
      : null

  return (
    <>
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '140px 24px 48px',
      }}>
        {/* Progress is now persistent in parent */}

        {/* Intro Text with streaming animation */}
        {step.introText && (
          <div style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            marginBottom: '32px',
          }}>
            {displayParagraphs.map((paragraph, i) => (
              <p key={i} style={{
                fontSize: '17px',
                lineHeight: '1.75',
                color: '#222',
                margin: 0,
                marginTop: i > 0 ? '20px' : 0,
              }}>
                {paragraph}
                {/* Show cursor on the last paragraph while streaming */}
                {i === displayParagraphs.length - 1 && !textComplete && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1em',
                    backgroundColor: '#333333',
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    animation: 'cursorBlink 1s step-end infinite',
                  }} />
                )}
              </p>
            ))}
          </div>
        )}

        {/* Video - Animated entrance matching ActiveChat */}
        {videoInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: videoVisible ? 1 : 0, scale: videoVisible ? 1 : 0.97 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
              cursor: isPlaying ? 'default' : 'pointer',
              position: 'relative',
              backgroundColor: '#000',
            }}
            onClick={() => !isPlaying && setIsPlaying(true)}
          >
            {isPlaying ? (
              <iframe
                src={embedUrl || ''}
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
                  src={thumbnailUrl || ''}
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
              </>
            )}
          </motion.div>
        )}

        {/* Continue Button - Animated entrance after video */}
        <AnimatePresence>
          {buttonVisible && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}
            >
              <motion.button
                onClick={onContinue}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  backgroundColor: COLORS.ACCENT,
                  color: '#FFFFFF',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                Continue <span>→</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

interface SalesPageStepContentProps {
  step: any
  onContinue: () => void
  onSkip?: () => void
}

// Sales Page Step Content - Dynamic sales page with typing animation
function SalesPageStepContent({ step, onContinue, onSkip }: SalesPageStepContentProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [actionComplete, setActionComplete] = useState(false)
  const bookingConfirmationSentRef = useRef(false)

  // Determine variant: 'checkout' (default) or 'calendly'
  const isCalendlyVariant = step.variant === 'calendly'

  // Animation state
  const [streamedText, setStreamedText] = useState('')
  const [phase, setPhase] = useState<'typing-above' | 'video' | 'typing-below' | 'checkout' | 'complete'>('typing-above')
  const [videoVisible, setVideoVisible] = useState(false)
  const [checkoutVisible, setCheckoutVisible] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  const streamSpeed = 8 // ms per character

  // Video embed info
  const getVideoInfo = (url: string) => {
    if (!url) return null
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/)
    if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }
    const wistiaMatch = url.match(/wistia\.com\/medias\/([^?/]+)/)
    if (wistiaMatch) return { provider: 'wistia', id: wistiaMatch[1] }
    return null
  }

  const video = step.videoKey ? (mentor.videos as any)[step.videoKey] : null
  const videoInfo = video ? getVideoInfo(video.url) : null
  const thumbnailUrl = videoInfo?.provider === 'youtube'
    ? `https://img.youtube.com/vi/${videoInfo.id}/maxresdefault.jpg`
    : videoInfo?.provider === 'wistia'
      ? `https://fast.wistia.com/embed/medias/${videoInfo.id}/swatch`
      : null
  const embedUrl = videoInfo?.provider === 'youtube'
    ? `https://www.youtube.com/embed/${videoInfo.id}?autoplay=1&rel=0`
    : videoInfo?.provider === 'wistia'
      ? `https://fast.wistia.net/embed/iframe/${videoInfo.id}?autoplay=1`
      : null

  const handleCheckoutComplete = (planId: string, receiptId: string) => {
    console.log('Purchase complete:', planId, receiptId)
    setActionComplete(true)
    setTimeout(() => onContinue?.(), 1500)
  }

  // Handle Calendly booking
  useCalendlyEventListener({
    onEventScheduled: (e) => {
      if (bookingConfirmationSentRef.current) return
      bookingConfirmationSentRef.current = true
      console.log('Call booked:', e.data.payload)
      setActionComplete(true)
    },
  })

  // Copy content based on variant
  const getContent = () => {
    if (isCalendlyVariant) {
      return {
        headline: "You're a great fit for 1-on-1.",
        copyAboveVideo: `Based on everything you've shared, I think you'd benefit from working with me directly.

This isn't for everyone. But you've done the work. You understand the framework. Now you need someone to look at your specific situation and tell you exactly what to do.

That's what these calls are for.`,
        copyBelowVideo: `Here's how it works:

Book a 30-minute call with my team. We'll look at where you are, where you want to be, and whether working together makes sense.

**No pressure.** If it's not the right fit, we'll tell you — and point you in the right direction.

**If it is the right fit**, we'll map out exactly what working together would look like.

This is for artists who are serious about making the jump. If that's you, grab a time:`
      }
    }
    return {
      headline: "Here's what I see.",
      copyAboveVideo: `You're not here because you're lazy. You're not here because your work isn't good enough.

You're here because you've been playing a game nobody taught you the rules to.

You've been doing what you thought you were supposed to do — posting, grinding, hoping the right people notice. And sometimes they do. But it's inconsistent. Unpredictable.

You can't build a life on unpredictable.

The artists who are booked out 6+ months with $5k-$10k clients? They're not more talented than you. They just figured out something most artists never learn.

And that's exactly what I'm going to show you.`,
      copyBelowVideo: `Here's what happens in Level 2:

I'm going to break down the exact pricing framework that took me from $500 tattoos to $10k sessions. Not theory — the actual mental shifts and positioning moves that make premium clients seek you out.

You'll walk away knowing:

**Why you've been undercharging** — and it's not what you think. It's not confidence. It's not your skill level. It's a positioning problem, and it's fixable.

**How to set prices that attract better clients** — not by "charging your worth" (that advice is useless). By understanding what premium clients actually pay for.

**The conversation shift** — what to say when someone asks your rate so they stop comparing you to cheaper artists.

This is $100.

One session at your new rate pays for it 10x over. And you'll get there faster than you think.`
    }
  }

  const content = getContent()
  const fullTextAbove = content.headline + '\n\n' + content.copyAboveVideo
  const fullTextBelow = content.copyBelowVideo

  // Streaming animation effect
  useEffect(() => {
    let timeout: NodeJS.Timeout

    if (phase === 'typing-above') {
      if (streamedText.length < fullTextAbove.length) {
        timeout = setTimeout(() => {
          const chunkSize = Math.floor(Math.random() * 3) + 2
          setStreamedText(fullTextAbove.slice(0, streamedText.length + chunkSize))
        }, streamSpeed)
      } else {
        // Done typing above, show video
        timeout = setTimeout(() => {
          setPhase('video')
          setVideoVisible(true)
        }, 300)
      }
    } else if (phase === 'video') {
      // After video appears, start typing below
      timeout = setTimeout(() => {
        setPhase('typing-below')
        setStreamedText('') // Reset for below content
      }, 600)
    } else if (phase === 'typing-below') {
      if (streamedText.length < fullTextBelow.length) {
        timeout = setTimeout(() => {
          const chunkSize = Math.floor(Math.random() * 3) + 2
          setStreamedText(fullTextBelow.slice(0, streamedText.length + chunkSize))
        }, streamSpeed)
      } else {
        // Done typing below, show checkout
        timeout = setTimeout(() => {
          setPhase('checkout')
          setCheckoutVisible(true)
        }, 300)
      }
    } else if (phase === 'checkout') {
      // After checkout appears, show footer
      timeout = setTimeout(() => {
        setPhase('complete')
        setFooterVisible(true)
      }, 500)
    }

    return () => clearTimeout(timeout)
  }, [streamedText, phase, fullTextAbove, fullTextBelow])

  // Parse text with bold markers
  const parseTextWithBold = (text: string) => {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: '600', color: '#000' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  // Render streamed paragraphs
  const renderStreamedContent = (text: string, isAbove = true) => {
    const paragraphs = text.split('\n\n').filter(p => p.trim())

    return paragraphs.map((paragraph, i) => {
      const isHeadline = isAbove && i === 0

      if (isHeadline) {
        return (
          <h1 key={i} style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: '32px',
            fontWeight: '700',
            color: '#000',
            lineHeight: '1.25',
            margin: 0,
            marginBottom: '28px',
          }}>
            {paragraph}
            {phase === 'typing-above' && i === paragraphs.length - 1 && (
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '0.85em',
                backgroundColor: '#333',
                marginLeft: '3px',
                verticalAlign: 'baseline',
                animation: 'cursorBlink 1s step-end infinite',
              }} />
            )}
          </h1>
        )
      }

      return (
        <p key={i} style={{
          fontSize: '17px',
          lineHeight: '1.75',
          color: '#222',
          margin: 0,
          marginTop: '20px',
          fontFamily: "'Lora', Charter, Georgia, serif",
        }}>
          {parseTextWithBold(paragraph)}
          {((isAbove && phase === 'typing-above') || (!isAbove && phase === 'typing-below')) &&
           i === paragraphs.length - 1 && (
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              backgroundColor: '#333',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'cursorBlink 1s step-end infinite',
            }} />
          )}
        </p>
      )
    })
  }

  return (
    <>
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '140px 24px 120px',
      }}>
        {/* Progress is now persistent in parent */}

        {/* Copy Above Video - Streaming */}
        <div style={{ marginBottom: videoVisible ? '32px' : 0 }}>
          {renderStreamedContent(
            phase === 'typing-above' ? streamedText : fullTextAbove,
            true
          )}
        </div>

        {/* Video Embed - Animated entrance */}
        <AnimatePresence>
          {videoVisible && videoInfo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              style={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
                cursor: isPlaying ? 'default' : 'pointer',
                position: 'relative',
                backgroundColor: '#000',
                marginBottom: '32px',
              }}
              onClick={() => !isPlaying && setIsPlaying(true)}
            >
              {isPlaying ? (
                <iframe
                  src={embedUrl || ''}
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
                  <img
                    src={thumbnailUrl || ''}
                    alt="Video thumbnail"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="#000" style={{ marginLeft: '3px' }}>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </motion.div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Copy Below Video - Streaming */}
        {(phase === 'typing-below' || phase === 'checkout' || phase === 'complete') && (
          <div style={{ marginBottom: checkoutVisible ? '32px' : 0 }}>
            {renderStreamedContent(
              phase === 'typing-below' ? streamedText : fullTextBelow,
              false
            )}
          </div>
        )}

        {/* Checkout or Calendly Embed - Animated entrance */}
        <AnimatePresence>
          {checkoutVisible && !actionComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              style={{
                width: '100%',
                margin: '24px 0',
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: isCalendlyVariant ? 'transparent' : COLORS.BACKGROUND,
                border: isCalendlyVariant ? 'none' : '1px solid rgba(0, 0, 0, 0.06)',
                boxShadow: isCalendlyVariant ? '0 4px 20px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)' : '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              {isCalendlyVariant ? (
                /* Calendly embed */
                <InlineWidget
                  url={step.calendlyUrl || "https://calendly.com/brady-mentorfy/30min"}
                  styles={{ height: '700px', minWidth: '100%' }}
                  pageSettings={{
                    backgroundColor: 'FAF6F0',
                    primaryColor: '10B981',
                    textColor: '1a1a1a',
                    hideEventTypeDetails: false,
                    hideLandingPageDetails: false,
                  }}
                />
              ) : (
                <>
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
                      planId={step.checkoutPlanId || "plan_joNwbFAIES0hH"}
                      theme="light"
                      skipRedirect={true}
                      onComplete={handleCheckoutComplete}
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
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success state after checkout or booking */}
        <AnimatePresence>
          {actionComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                width: '100%',
                margin: '24px 0',
                padding: '24px',
                borderRadius: '16px',
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{
                  fontFamily: "'Lora', Charter, Georgia, serif",
                  fontSize: '18px',
                  fontWeight: '600',
                  color: COLORS.ACCENT,
                }}>
                  {isCalendlyVariant ? 'Call booked!' : 'Payment successful!'}
                </span>
              </div>
              <p style={{
                fontFamily: "'Geist', -apple-system, sans-serif",
                fontSize: '14px',
                color: '#666',
                margin: 0,
              }}>
                {isCalendlyVariant
                  ? "Check your email for the confirmation and meeting link."
                  : "You now have access to Level 2. Let's get started."
                }
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer - Risk reversal & skip button */}
        <AnimatePresence>
          {footerVisible && !actionComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Risk Reversal Copy */}
              <p style={{
                fontFamily: "'Lora', Charter, Georgia, serif",
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#888',
                textAlign: 'center',
                margin: '24px 0 40px',
                fontStyle: 'italic',
              }}>
                {isCalendlyVariant
                  ? "No pressure. If we're not the right fit, we'll tell you."
                  : "No risk. If Level 2 doesn't change how you see your business, message me. I'll make it right."
                }
              </p>

              {/* Divider */}
              <hr style={{
                border: 'none',
                borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                margin: '0 0 24px',
              }} />

              {/* Skip option - Secondary button */}
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontFamily: "'Geist', -apple-system, sans-serif",
                  fontSize: '13px',
                  color: '#999',
                  marginBottom: '12px',
                }}>
                  or continue without purchasing
                </p>
                <motion.button
                  onClick={onSkip || onContinue}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#666',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: "'Geist', -apple-system, sans-serif",
                    transition: 'all 0.15s ease',
                  }}
                >
                  Continue <span>→</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

// Content transition variants - smooth horizontal slide (timeline moving left)
const contentVariants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: { opacity: 0, x: -60, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const } }
}

interface PhaseFlowProps {
  levelId: number
  onComplete?: () => void
  onBack?: () => void
  hideHeader?: boolean
  backHandlerRef?: MutableRefObject<(() => void) | null>
}

export function PhaseFlow({ levelId, onComplete, onBack, hideHeader = false, backHandlerRef }: PhaseFlowProps) {
  const { state, dispatch } = useUser()
  const level = phases.find(l => l.id === levelId)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Reset step index when levelId changes (new phase)
  useEffect(() => {
    setCurrentStepIndex(0)
  }, [levelId])

  // Expose back handler to parent via ref (for stationary header control)
  // Must be before any early returns to satisfy React hooks rules
  useEffect(() => {
    if (!level) return
    if (backHandlerRef) {
      backHandlerRef.current = () => {
        if (currentStepIndex > 0) {
          setCurrentStepIndex(prev => prev - 1)
        } else {
          onBack?.()
        }
      }
    }
    return () => {
      if (backHandlerRef) {
        backHandlerRef.current = null
      }
    }
  }, [backHandlerRef, currentStepIndex, onBack, level])

  if (!level) {
    return <div>Level not found</div>
  }

  const currentStep = level.steps[currentStepIndex]
  const totalSteps = level.steps.length

  // Guard against undefined step (can happen briefly during phase transition)
  if (!currentStep) {
    return <div style={{ backgroundColor: COLORS.BACKGROUND, minHeight: '100vh' }} />
  }

  // Current step number for progress indicator (0-indexed)
  const currentStepNumber = currentStepIndex

  // Determine if back button should be dimmed (AI moment, video, thinking, sales-page steps)
  // BUT if we're on step 0 and can go back to previous panel, always allow it
  const isNonQuestionStep = currentStep.type === 'ai-moment' || currentStep.type === 'video' || currentStep.type === 'thinking' || currentStep.type === 'sales-page'
  const canExitToPanel = currentStepIndex === 0 && !!onBack
  const shouldDimBackButton = isNonQuestionStep && !canExitToPanel

  const handleAnswer = (stateKey: string, value: any) => {
    dispatch({ type: 'SET_ANSWER', payload: { key: stateKey, value } })
    goToNextStep()
  }

  const goToNextStep = () => {
    if (currentStepIndex < level.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      // Level complete
      dispatch({ type: 'COMPLETE_PHASE', payload: levelId })
      onComplete?.()
    }
  }

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    } else {
      onBack?.()
    }
  }

  const renderStepContent = () => {
    switch (currentStep.type) {
      case 'question':
        if (currentStep.questionType === 'multiple-choice') {
          return (
            <MultipleChoiceStepContent
              key={currentStepIndex}
              step={currentStep}
              onAnswer={handleAnswer}
            />
          )
        } else if (currentStep.questionType === 'contact-info') {
          return (
            <ContactInfoStepContent
              key={currentStepIndex}
              step={currentStep}
              onAnswer={handleAnswer}
            />
          )
        } else {
          return (
            <LongAnswerStepContent
              key={currentStepIndex}
              step={currentStep}
              onAnswer={handleAnswer}
            />
          )
        }

      case 'thinking':
        return (
          <ThinkingStepContent
            key={currentStepIndex}
            step={currentStep}
            onComplete={goToNextStep}
          />
        )

      case 'ai-moment':
        return (
          <AIMomentStepContent
            key={currentStepIndex}
            step={currentStep}
            state={state}
            onContinue={goToNextStep}
          />
        )

      case 'video':
        return (
          <VideoStepContent
            key={currentStepIndex}
            step={currentStep}
            onContinue={goToNextStep}
          />
        )

      case 'sales-page':
        return (
          <SalesPageStepContent
            key={currentStepIndex}
            step={currentStep}
            onContinue={goToNextStep}
            onSkip={goToNextStep}
          />
        )

      default:
        return <div>Unknown step type: {(currentStep as any).type}</div>
    }
  }

  return (
    <div style={{ backgroundColor: COLORS.BACKGROUND, minHeight: '100vh', position: 'relative', overflowX: 'hidden', overflowY: 'auto' }}>
      {/* Persistent Header - uses absolute positioning when inside a panel */}
      {!hideHeader && (
        <GlassHeader
          onBack={goToPreviousStep}
          showBackButton={currentStepIndex > 0 || !!onBack}
          dimBackButton={shouldDimBackButton}
          useAbsolutePosition={!!onBack}
        />
      )}

      {/* Persistent Progress Indicator - stays in place while content slides */}
      {/* When hideHeader but has onBack (inside panel), parent has stationary header at top */}
      <div style={{
        position: 'absolute',
        top: (hideHeader && !onBack) ? 24 : 80,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 24px',
      }}>
        <StepProgress current={currentStepNumber} total={totalSteps} />
      </div>

      {/* Animated Content Area - slides horizontally */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          variants={contentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ minHeight: '100vh' }}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
