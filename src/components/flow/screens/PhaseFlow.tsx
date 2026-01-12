'use client'

import { useState, useEffect, useRef, MutableRefObject } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { GlassHeader } from '../shared/GlassHeader'
import { DisqualificationScreen } from './DisqualificationScreen'
import { StepProgress } from '../shared/StepProgress'
import { ThinkingAnimation } from '../shared/ThinkingAnimation'
import { WhopCheckoutEmbed } from '@whop/checkout/react'
import { InlineWidget, useCalendlyEventListener } from 'react-calendly'
import { getFlow } from '@/data/flows'
import { useUser, useUserState, useSessionId } from '@/context/UserContext'
import { useAnalytics } from '@/hooks/useAnalytics'
import { COLORS } from '@/config/flow'
import { LoadingScreenStepContent } from './LoadingScreenStepContent'
import { DiagnosisSequenceFlow } from './DiagnosisSequenceFlow'

// Normalize markdown to ensure ## headers are properly separated
function normalizeMarkdown(content: string): string {
  return content.replace(/([^\n])\n?(## )/g, '$1\n\n$2')
}

interface MultipleChoiceStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: string) => void
}

function MultipleChoiceStepContent({ step, onAnswer }: MultipleChoiceStepContentProps) {
  const [selected, setSelected] = useState<string | null>(null)

  // Typing animation state - same as other questions
  const [fullQuestion, setFullQuestion] = useState<string | null>(null)
  const [displayedQuestion, setDisplayedQuestion] = useState('')
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [typingComplete, setTypingComplete] = useState(false)

  // Set fullQuestion after brief cursor delay
  useEffect(() => {
    const delay = setTimeout(() => {
      setFullQuestion(step.question)
      setIsWaitingForResponse(false)
    }, 150) // Quick cursor flash
    return () => clearTimeout(delay)
  }, [step.question])

  // Start typing after brief pause once we have the question
  useEffect(() => {
    if (!fullQuestion || typingComplete) return
    const delay = setTimeout(() => {
      setIsTyping(true)
    }, 200) // Quick pause then type
    return () => clearTimeout(delay)
  }, [fullQuestion, typingComplete])

  // Type out characters - same speed as other questions
  useEffect(() => {
    if (!isTyping || !fullQuestion) return

    if (displayedQuestion.length < fullQuestion.length) {
      const typeSpeed = 8 + Math.random() * 8
      const charsToAdd = 2
      const timeout = setTimeout(() => {
        setDisplayedQuestion(fullQuestion.slice(0, displayedQuestion.length + charsToAdd))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setIsTyping(false)
      setTypingComplete(true)
    }
  }, [isTyping, displayedQuestion, fullQuestion])

  const handleSelect = (option: { value: string; label: string }) => {
    setSelected(option.value)
    setTimeout(() => {
      onAnswer(step.stateKey, option.value)
    }, 100) // Snappier transition
  }

  const showCursor = isWaitingForResponse || (fullQuestion && !isTyping && !typingComplete)

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      padding: '140px 24px 48px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Question with typing animation */}
      <div style={{
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '18px',
        fontWeight: '500',
        color: '#000',
        textAlign: 'left',
        lineHeight: '1.5',
        marginBottom: step.instruction ? '8px' : '32px',
      }}>
        {displayedQuestion || ''}
        {showCursor && <span className="typing-cursor" />}
      </div>

      {/* Instruction text (optional) */}
      {typingComplete && step.instruction && (
        <div style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '14px',
          color: '#666',
          marginBottom: '24px',
        }}>
          {step.instruction}
        </div>
      )}

        {/* Options - fade in one at a time when typing complete */}
        <AnimatePresence>
          {typingComplete && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.08,
                  },
                },
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {step.options.map((option: { value: string; label: string }) => (
                <motion.button
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
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
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}

interface MultiSelectStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: string[]) => void
}

function MultiSelectStepContent({ step, onAnswer }: MultiSelectStepContentProps) {
  const [selected, setSelected] = useState<string[]>([])

  // Typing animation state
  const [fullQuestion, setFullQuestion] = useState<string | null>(null)
  const [displayedQuestion, setDisplayedQuestion] = useState('')
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [typingComplete, setTypingComplete] = useState(false)

  // Set fullQuestion after brief cursor delay
  useEffect(() => {
    const delay = setTimeout(() => {
      setFullQuestion(step.question)
      setIsWaitingForResponse(false)
    }, 150)
    return () => clearTimeout(delay)
  }, [step.question])

  // Start typing after brief pause once we have the question
  useEffect(() => {
    if (!fullQuestion || typingComplete) return
    const delay = setTimeout(() => {
      setIsTyping(true)
    }, 200)
    return () => clearTimeout(delay)
  }, [fullQuestion, typingComplete])

  // Type out characters
  useEffect(() => {
    if (!isTyping || !fullQuestion) return

    if (displayedQuestion.length < fullQuestion.length) {
      const typeSpeed = 8 + Math.random() * 8
      const charsToAdd = 2
      const timeout = setTimeout(() => {
        setDisplayedQuestion(fullQuestion.slice(0, displayedQuestion.length + charsToAdd))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setIsTyping(false)
      setTypingComplete(true)
    }
  }, [isTyping, displayedQuestion, fullQuestion])

  const handleToggle = (value: string) => {
    setSelected(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  const handleContinue = () => {
    if (selected.length > 0) {
      onAnswer(step.stateKey, selected)
    }
  }

  const showCursor = isWaitingForResponse || (fullQuestion && !isTyping && !typingComplete)

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      padding: '140px 24px 48px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Question with typing animation */}
      <div style={{
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '18px',
        fontWeight: '500',
        color: '#000',
        textAlign: 'left',
        lineHeight: '1.5',
        marginBottom: '8px',
      }}>
        {displayedQuestion || ''}
        {showCursor && <span className="typing-cursor" />}
      </div>

      {/* Instruction text */}
      {typingComplete && step.instruction && (
        <div style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontSize: '14px',
          color: '#666',
          marginBottom: '24px',
        }}>
          {step.instruction}
        </div>
      )}

      {/* Options - fade in one at a time when typing complete */}
      <AnimatePresence>
        {typingComplete && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.06,
                },
              },
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {step.options.map((option: { value: string; label: string }) => {
              const isSelected = selected.includes(option.value)
              return (
                <motion.button
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : '#F0EBE4',
                    border: isSelected ? `2px solid ${COLORS.ACCENT}` : '1px solid #E8E3DC',
                    cursor: 'pointer',
                    fontFamily: "'Lora', Charter, Georgia, serif",
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#111',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected
                      ? `0 0 0 2px ${COLORS.ACCENT}, 0 4px 12px rgba(16, 185, 129, 0.25)`
                      : '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {/* Checkbox indicator */}
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: isSelected ? `2px solid ${COLORS.ACCENT}` : '2px solid #CCC',
                    backgroundColor: isSelected ? COLORS.ACCENT : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ flex: 1 }}>{option.label}</span>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue button - appears when at least one option selected */}
      <AnimatePresence>
        {typingComplete && selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}
          >
            <motion.button
              onClick={handleContinue}
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
  )
}

interface LongAnswerStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: string) => void
  sessionId?: string
  initialValue?: string
}

function LongAnswerStepContent({ step, onAnswer, sessionId, initialValue = '' }: LongAnswerStepContentProps) {
  const [value, setValue] = useState(initialValue)
  const [isFocused, setIsFocused] = useState(false)

  // Sync value with initialValue when it changes (e.g., when navigating back and state updates)
  useEffect(() => {
    if (initialValue && initialValue !== value) {
      setValue(initialValue)
    }
  }, [initialValue])
  const [fullQuestion, setFullQuestion] = useState<string | null>(null) // Full text to type out
  const [displayedQuestion, setDisplayedQuestion] = useState('') // Text being typed out
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(true) // Always start with cursor
  const [isTyping, setIsTyping] = useState(false)
  const [typingComplete, setTypingComplete] = useState(false)
  const isValid = value.trim().length >= 3

  // Track if we need to fetch from API
  const needsPersonalization = !!step.personalizePromptKey

  // For static questions, set fullQuestion after brief cursor delay
  useEffect(() => {
    if (step.personalizePromptKey) return // Skip for personalized - handled below

    // Brief delay to show cursor before typing static question
    const delay = setTimeout(() => {
      setFullQuestion(step.question)
      setIsWaitingForResponse(false)
    }, 150) // Quick cursor flash

    return () => clearTimeout(delay)
  }, [step.personalizePromptKey, step.question])

  // Fetch personalized question if step has personalizePromptKey
  useEffect(() => {
    if (!step.personalizePromptKey || !sessionId) return

    const abortController = new AbortController()
    let cancelled = false

    // Reset all typing animation states
    setIsWaitingForResponse(true)
    setIsTyping(false)
    setTypingComplete(false)
    setDisplayedQuestion('')
    setFullQuestion(null)

    const fetchWithRetry = async (retries = 2): Promise<void> => {
      try {
        const res = await fetch('/api/generate/personalize-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            baseQuestion: step.baseQuestion || step.question,
            promptKey: step.personalizePromptKey,
          }),
          signal: abortController.signal,
        })

        // Retry on rate limit
        if (res.status === 429 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
          return fetchWithRetry(retries - 1)
        }

        if (!res.ok) throw new Error('Failed to personalize question')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let fullText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }

        if (!cancelled) {
          setFullQuestion(fullText.trim())
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || cancelled) return
        console.error('Error personalizing question:', err)
        if (!cancelled) {
          setFullQuestion(step.baseQuestion || step.question)
        }
      } finally {
        if (!cancelled) {
          setIsWaitingForResponse(false)
        }
      }
    }

    fetchWithRetry()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [step.personalizePromptKey, step.baseQuestion, step.question, sessionId])

  // Start typing after a brief "thinking" pause once we have the full question
  useEffect(() => {
    if (!fullQuestion || typingComplete) return
    // Small delay so cursor has time to blink before text appears
    const delay = setTimeout(() => {
      setIsTyping(true)
    }, 200) // Quick pause then type
    return () => clearTimeout(delay)
  }, [fullQuestion, typingComplete])

  // Type out characters - fast and smooth, 2 chars at a time
  useEffect(() => {
    if (!isTyping || !fullQuestion) return

    if (displayedQuestion.length < fullQuestion.length) {
      const typeSpeed = 8 + Math.random() * 8 // 8-16ms - snappy
      const charsToAdd = 2 // Type 2 characters at a time for speed
      const timeout = setTimeout(() => {
        setDisplayedQuestion(fullQuestion.slice(0, displayedQuestion.length + charsToAdd))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setIsTyping(false)
      setTypingComplete(true)
    }
  }, [isTyping, displayedQuestion, fullQuestion])

  const handleSubmit = () => {
    if (isValid) {
      onAnswer(step.stateKey, value.trim())
    }
  }

  // Determine which question to display - always use typing animation now
  const displayQuestion = (typingComplete ? fullQuestion : displayedQuestion) || ''

  // Show cursor while waiting OR during the brief pause before typing starts
  // Disappears once text actually starts appearing
  const showCursor = isWaitingForResponse || (fullQuestion && !isTyping && !typingComplete)

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

      {/* Question - Main Focus with typing animation for all questions */}
      <div
        className="question-markdown"
        style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          fontSize: '18px',
          fontWeight: '500',
          color: '#000',
          textAlign: 'left',
          lineHeight: '1.5',
          marginBottom: '32px',
        }}
      >
        <style>{`
          .question-markdown p {
            margin: 0 0 16px 0;
          }
          .question-markdown p:last-child {
            margin-bottom: 0;
          }
          .question-markdown strong {
            font-weight: 600;
          }
          .question-markdown em {
            font-style: italic;
          }
        `}</style>
        {displayQuestion ? (
          <span>
            <ReactMarkdown>{displayQuestion}</ReactMarkdown>
            {showCursor && <span className="typing-cursor" style={{ color: '#000' }} />}
          </span>
        ) : (
          showCursor && <span className="typing-cursor" style={{ color: '#000' }} />
        )}
      </div>

      {/* Text Area + Button - Hidden during typing, fades in when complete */}
      <AnimatePresence>
        {typingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ContactInfoStepContentProps {
  step: any
  onAnswer: (stateKey: string, value: Record<string, string>) => void
  analytics: ReturnType<typeof useAnalytics>
}

function ContactInfoStepContent({ step, onAnswer, analytics }: ContactInfoStepContentProps) {
  const { updateContact } = useUser()
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

  const handleSubmit = async () => {
    if (!isValid) return

    // Update contact info on server
    await updateContact(values)

    // Identify user in PostHog
    analytics.identify({
      email: values.email || '',
      name: values.name || values.fullName,
      phone: values.phone,
    })

    // Advance to next step
    onAnswer(step.stateKey, values)
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
  flowId?: string
}

function AIMomentStepContent({ step, state, onContinue, flowId = 'rafael-tats' }: AIMomentStepContentProps) {
  const sessionId = useSessionId()
  const [fullResponse, setFullResponse] = useState<string | null>(null) // Full text from API
  const [displayedResponse, setDisplayedResponse] = useState('') // Text being typed out
  const [embedData, setEmbedData] = useState<any>(null)
  const fetchedRef = useRef(false)

  // Phase: 'waiting' (cursor blinks), 'typing' (text types out), 'complete'
  const [phase, setPhase] = useState<'waiting' | 'typing' | 'complete'>('waiting')

  // Streaming state - true when API response is fully received
  const [streamingComplete, setStreamingComplete] = useState(false)

  // Fetch diagnosis - collect full response first, then animate
  useEffect(() => {
    if (fetchedRef.current || !sessionId) return
    fetchedRef.current = true

    async function fetchDiagnosis() {
      try {
        const res = await fetch('/api/generate/diagnosis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, promptKey: step.promptKey })
        })

        if (!res.ok) return

        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            // AI SDK 6 uses SSE format: data: {"type":"text-delta","delta":"..."}
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6)
              if (jsonStr === '[DONE]') continue
              try {
                const data = JSON.parse(jsonStr)
                if (data.type === 'text-delta' && data.delta) {
                  fullText += data.delta
                } else if (data.type === 'tool-result' && data.result?.embedType) {
                  setEmbedData(data.result)
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }

        setFullResponse(fullText)
        setStreamingComplete(true)
      } catch (err) {
        console.error('Diagnosis fetch error:', err)
      }
    }
    fetchDiagnosis()
  }, [sessionId, step.promptKey])

  // Start typing animation after brief pause once we have full response
  useEffect(() => {
    if (!fullResponse || phase !== 'waiting') return
    const delay = setTimeout(() => {
      setPhase('typing')
    }, 400) // Brief pause with cursor before typing starts
    return () => clearTimeout(delay)
  }, [fullResponse, phase])

  // Type out characters - same speed as personalized questions
  useEffect(() => {
    if (phase !== 'typing' || !fullResponse) return

    if (displayedResponse.length < fullResponse.length) {
      const typeSpeed = 8 + Math.random() * 8 // 8-16ms - snappy
      const charsToAdd = 2 // Type 2 characters at a time
      const timeout = setTimeout(() => {
        setDisplayedResponse(fullResponse.slice(0, displayedResponse.length + charsToAdd))
      }, typeSpeed)
      return () => clearTimeout(timeout)
    } else {
      setPhase('complete')
    }
  }, [phase, displayedResponse, fullResponse])

  const isWaiting = phase === 'waiting'
  const isTyping = phase === 'typing'

  return (
    <div style={{
      maxWidth: '640px',
      margin: '0 auto',
      padding: '140px 24px 48px',
    }}>
      {/* Progress is now persistent in parent */}

      {/* Waiting Phase - Just a blinking cursor while loading */}
      {isWaiting && (
        <div style={{
          fontFamily: "'Lora', Charter, Georgia, serif",
          minHeight: '200px',
        }}>
          <span className="typing-cursor" style={{ color: '#333333' }} />
        </div>
      )}

      {/* Typing/Complete Phase - Left-aligned response with markdown */}
      {(isTyping || phase === 'complete') && (
          <div className="ai-moment-markdown" style={{ fontFamily: "'Lora', Charter, Georgia, serif" }}>
            <style>{`
              .ai-moment-markdown h1 {
                font-size: 28px;
                font-weight: 600;
                color: #000;
                line-height: 1.3;
                margin: 0 0 24px 0;
              }
              .ai-moment-markdown h2 {
                font-size: 22px;
                font-weight: 600;
                color: #000;
                line-height: 1.35;
                margin: 28px 0 16px 0;
              }
              .ai-moment-markdown h3 {
                font-size: 18px;
                font-weight: 600;
                color: #111;
                line-height: 1.4;
                margin: 24px 0 12px 0;
              }
              .ai-moment-markdown p {
                font-size: 17px;
                line-height: 1.75;
                color: #222;
                margin: 0 0 20px 0;
              }
              .ai-moment-markdown p:last-child {
                margin-bottom: 0;
              }
              .ai-moment-markdown strong {
                font-weight: 600;
                color: #000;
              }
              .ai-moment-markdown em {
                font-style: italic;
                color: #444;
              }
              .ai-moment-markdown ul, .ai-moment-markdown ol {
                font-size: 17px;
                line-height: 1.75;
                color: #222;
                margin: 0 0 16px 0;
                padding-left: 24px;
              }
              .ai-moment-markdown li {
                margin-bottom: 8px;
              }
              .ai-moment-markdown blockquote {
                border-left: 3px solid #10B981;
                padding-left: 16px;
                margin: 16px 0;
                font-style: italic;
                color: #444;
              }
            `}</style>
            {/* Render displayed text (typing animation) */}
            <ReactMarkdown>
              {normalizeMarkdown(displayedResponse || '')}
            </ReactMarkdown>
          </div>
        )}

        {/* Calendly Embed - Show when AI determined user is qualified */}
        {phase === 'complete' && embedData?.embedType === 'booking' && embedData?.calendlyUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as const }}
            style={{
              width: '100%',
              margin: '32px 0',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <InlineWidget
              url={embedData.calendlyUrl}
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
        )}

        {/* After Text - Future pace copy after booking embed */}
        {phase === 'complete' && embedData?.embedType === 'booking' && embedData?.afterText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
            style={{
              fontFamily: "'Lora', Charter, Georgia, serif",
              fontSize: '18px',
              fontWeight: '500',
              color: '#000',
              lineHeight: '1.6',
              textAlign: 'left',
            }}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p style={{ marginBottom: '16px' }}>{children}</p>,
                strong: ({ children }) => <strong style={{ fontWeight: '700' }}>{children}</strong>,
              }}
            >
              {embedData.afterText}
            </ReactMarkdown>
          </motion.div>
        )}

        {/* Continue Button - Green (hide when booking embed is shown) */}
        {phase === 'complete' && !embedData?.embedType && (
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
  )
}

interface VideoStepContentProps {
  step: any
  onContinue: () => void
  flowId?: string
}

function VideoStepContent({ step, onContinue, flowId = 'rafael-tats' }: VideoStepContentProps) {
  const flow = getFlow(flowId)
  const video = (flow.mentor as any).videos?.[step.videoKey]

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
                <span className="typing-cursor" style={{ color: '#333333' }} />
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
  )
}

interface SalesPageStepContentProps {
  step: any
  onContinue: () => void
  onSkip?: () => void
  flowId?: string
}

// Sales Page Step Content - Dynamic sales page with typing animation
function SalesPageStepContent({ step, onContinue, onSkip, flowId = 'rafael-tats' }: SalesPageStepContentProps) {
  const flow = getFlow(flowId)
  const state = useUserState()
  const analytics = useAnalytics({ session_id: state.sessionId || '', flow_id: flowId })
  const [isPlaying, setIsPlaying] = useState(false)
  const [actionComplete, setActionComplete] = useState(false)
  const bookingConfirmationSentRef = useRef(false)
  const embedTrackedRef = useRef(false)

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

  const video = step.videoKey ? (flow.mentor as any).videos?.[step.videoKey] : null
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

  // Track embed_shown when checkout/booking embed becomes visible
  useEffect(() => {
    if (phase === 'checkout' && checkoutVisible && !embedTrackedRef.current) {
      embedTrackedRef.current = true
      analytics.trackEmbedShown({
        embedType: isCalendlyVariant ? 'booking' : 'checkout',
        source: 'sales_page',
        phasesCompleted: state.progress.completedPhases,
      })
    }
  }, [phase, checkoutVisible, isCalendlyVariant, analytics, state.progress.completedPhases])

  // Handle Calendly booking
  useCalendlyEventListener({
    onEventScheduled: (e) => {
      if (bookingConfirmationSentRef.current) return
      bookingConfirmationSentRef.current = true
      console.log('Call booked:', e.data.payload)

      // Track booking completion
      analytics.trackBookingClicked({
        source: 'sales_page',
        phasesCompleted: state.progress.completedPhases,
        stepId: step.stateKey || `sales-page-${step.variant || 'default'}`,
      })

      setActionComplete(true)
    },
  })

  const fullTextAbove = step.headline + '\n\n' + step.copyAboveVideo
  const fullTextBelow = step.copyBelowVideo

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
              <span className="typing-cursor" style={{ color: '#333' }} />
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
            <span className="typing-cursor" style={{ color: '#333' }} />
          )}
        </p>
      )
    })
  }

  return (
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
                  url={step.calendlyUrl || flow.embeds.calendlyUrl}
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
                      planId={step.checkoutPlanId || flow.embeds.checkoutPlanId}
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
  )
}

// Helper to extract nested value from state using dot-separated path (e.g., "models.whatHappened")
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

// Content transition variants - direction-aware horizontal slide
const getContentVariants = (direction: number) => ({
  initial: { opacity: 0, x: direction * 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: { opacity: 0, x: direction * -60, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const } }
})

interface PhaseFlowProps {
  levelId: number
  onComplete?: (lastAnswer?: Record<string, any>) => void
  onBack?: () => void
  hideHeader?: boolean
  backHandlerRef?: MutableRefObject<(() => void) | null>
  flowId?: string
}

export function PhaseFlow({ levelId, onComplete, onBack, hideHeader = false, backHandlerRef, flowId = 'rafael-tats' }: PhaseFlowProps) {
  const { completeStep } = useUser()
  const state = useUserState()
  const flow = getFlow(flowId)
  const phases = flow.phases
  const level = phases.find(l => l.id === levelId)
  const analytics = useAnalytics({ session_id: state.sessionId || '', flow_id: flowId })

  // Initialize step from persisted state if we're on the same phase, otherwise start at 0
  const initialStep = state.progress.currentPhase === levelId ? state.progress.currentStep : 0
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = back

  // Exit condition state for disqualification
  const [exitCondition, setExitCondition] = useState<{
    headline: string
    message: string
  } | null>(null)

  // Store diagnosis screens from loading step for diagnosis-sequence step
  const [diagnosisScreens, setDiagnosisScreens] = useState<string[]>([])

  // Reset step index when levelId changes (new phase)
  useEffect(() => {
    if (state.progress.currentPhase === levelId) {
      // Restore persisted step for current phase
      setCurrentStepIndex(state.progress.currentStep)
    } else {
      // New phase, start from 0
      setCurrentStepIndex(0)
    }
  }, [levelId, state.progress.currentPhase, state.progress.currentStep])

  // Reset step timer when step changes (for time_on_step_ms tracking)
  useEffect(() => {
    analytics.startStepTimer()
  }, [currentStepIndex, analytics])

  // Reset phase timer when phase changes (for time_in_phase_ms tracking)
  useEffect(() => {
    analytics.startPhaseTimer()
  }, [levelId, analytics])

  // Expose back handler to parent via ref (for stationary header control)
  // Must be before any early returns to satisfy React hooks rules
  useEffect(() => {
    if (!level) return
    if (backHandlerRef) {
      backHandlerRef.current = () => {
        if (currentStepIndex > 0) {
          setDirection(-1)
          const newStep = currentStepIndex - 1
          setCurrentStepIndex(newStep)
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

  // Guard against undefined step (can happen briefly during phase transition)
  if (!currentStep) {
    return <div style={{ backgroundColor: COLORS.BACKGROUND, minHeight: '100vh' }} />
  }

  // Render disqualification screen if exit condition was triggered
  if (exitCondition) {
    return (
      <DisqualificationScreen
        headline={exitCondition.headline}
        message={exitCondition.message}
        flowId={flowId}
      />
    )
  }

  // Calculate progress excluding loading and diagnosis-sequence steps
  // These are "hidden" steps that don't count toward visible progress
  const hiddenStepTypes = ['loading', 'diagnosis-sequence']
  const visibleSteps = level.steps.filter(step => !hiddenStepTypes.includes(step.type))
  const totalSteps = visibleSteps.length

  // Count how many visible steps we've completed (steps before current that are visible)
  const currentStepNumber = level.steps
    .slice(0, currentStepIndex)
    .filter(step => !hiddenStepTypes.includes(step.type))
    .length

  // Determine if back button should be hidden
  // Hide on: AI moments, videos, thinking, sales-page steps
  // Also hide if: previous step is a non-question type (can't go back from questions to AI moments)
  // Also hide if: step explicitly marks noBackButton (for phase boundaries)
  const isNonQuestionStep = currentStep.type === 'ai-moment' || currentStep.type === 'video' || currentStep.type === 'thinking' || currentStep.type === 'sales-page'
  const canExitToPanel = currentStepIndex === 0 && !!onBack
  const previousStep = currentStepIndex > 0 ? level.steps[currentStepIndex - 1] : null
  const isPreviousNonQuestion = previousStep && (previousStep.type === 'ai-moment' || previousStep.type === 'video' || previousStep.type === 'thinking' || previousStep.type === 'sales-page')
  const shouldDimBackButton = (isNonQuestionStep || isPreviousNonQuestion || currentStep.noBackButton) && !canExitToPanel

  const handleAnswer = async (stateKey: string, value: any) => {
    // Track step_completed
    const step = level!.steps[currentStepIndex]
    analytics.trackStepCompleted({
      stepIndex: currentStepIndex,
      phaseId: levelId,
      phaseName: level!.name,
      phaseStepIndex: currentStepIndex,
      stepType: step.type,
      stepKey: step.stepKey,
      answerKey: stateKey,
      answerText: typeof value === 'string' && value.length > 20 ? value : undefined,
      answerValue: typeof value === 'string' && value.length <= 20 ? value : undefined,
    })

    // Check for exit condition (disqualification)
    if (step.exitCondition && step.exitCondition.values.includes(value)) {
      setExitCondition({
        headline: step.exitCondition.headline,
        message: step.exitCondition.message,
      })
      return // Don't proceed to next step
    }

    const nextStepIndex = currentStepIndex + 1
    const isLastStep = nextStepIndex >= level.steps.length

    // Build answer object with stateKey path
    // For 'assessment.situation' → { assessment: { situation: value } }
    // For 'user' → { user: value } (value is already { name, email, phone })
    const parts = stateKey.split('.')
    const answer = parts.length > 1
      ? { [parts[0]]: { [parts[1]]: value } }
      : { [stateKey]: value }

    // Determine next step ID
    const nextStepId = isLastStep
      ? `phase-${levelId}-complete`
      : `phase-${levelId}-step-${nextStepIndex}`

    if (isLastStep) {
      // For phase completion: pass answer to parent, let parent handle persistence
      // This prevents re-render race condition where component unmounts before callback
      onComplete?.(answer)
    } else {
      // For non-final steps: persist step + answer, then advance locally
      setDirection(1)
      await completeStep(nextStepId, answer)
      setCurrentStepIndex(nextStepIndex)
    }
  }

  const goToNextStep = async () => {
    const nextStepIndex = currentStepIndex + 1
    const isLastStep = nextStepIndex >= level.steps.length

    const nextStepId = isLastStep
      ? `phase-${levelId}-complete`
      : `phase-${levelId}-step-${nextStepIndex}`

    if (isLastStep) {
      // For phase completion: notify parent, let parent handle persistence
      // This prevents re-render race condition where component unmounts before callback
      onComplete?.()
    } else {
      // For non-final steps: persist step, then advance locally
      setDirection(1)
      await completeStep(nextStepId)
      setCurrentStepIndex(nextStepIndex)
    }
  }

  const goToPreviousStep = async () => {
    if (currentStepIndex > 0) {
      setDirection(-1)
      const newStepIndex = currentStepIndex - 1
      const prevStepId = `phase-${levelId}-step-${newStepIndex}`
      await completeStep(prevStepId)
      setCurrentStepIndex(newStepIndex)
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
        } else if (currentStep.questionType === 'multi-select') {
          return (
            <MultiSelectStepContent
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
              analytics={analytics}
            />
          )
        } else {
          // Get previously saved answer from state.answers (if navigating back)
          const savedValue = currentStep.stateKey ? getNestedValue(state.answers, currentStep.stateKey) : undefined
          return (
            <LongAnswerStepContent
              key={currentStepIndex}
              step={currentStep}
              onAnswer={handleAnswer}
              sessionId={state.sessionId || undefined}
              initialValue={typeof savedValue === 'string' ? savedValue : ''}
            />
          )
        }

      case 'loading':
        return (
          <LoadingScreenStepContent
            key={currentStepIndex}
            step={currentStep}
            onComplete={(screens: string[]) => {
              setDiagnosisScreens(screens)
              goToNextStep()
            }}
            sessionId={state.sessionId || undefined}
            flowId={flowId}
          />
        )

      case 'diagnosis-sequence':
        // This step type renders the full 8-screen diagnosis flow
        // It manages its own internal navigation
        return (
          <DiagnosisSequenceFlow
            key={currentStepIndex}
            screens={diagnosisScreens}
            calendlyUrl={flow.embeds?.calendlyUrl}
            onBack={goToPreviousStep}
            flowId={flowId}
          />
        )

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
            flowId={flowId}
          />
        )

      case 'video':
        return (
          <VideoStepContent
            key={currentStepIndex}
            step={currentStep}
            onContinue={goToNextStep}
            flowId={flowId}
          />
        )

      case 'sales-page':
        return (
          <SalesPageStepContent
            key={currentStepIndex}
            step={currentStep}
            onContinue={goToNextStep}
            onSkip={goToNextStep}
            flowId={flowId}
          />
        )

      default:
        return <div>Unknown step type: {(currentStep as any).type}</div>
    }
  }

  // Hide header and progress for diagnosis-sequence and loading screens
  const isDiagnosisSequence = currentStep.type === 'diagnosis-sequence'
  const isLoadingScreen = currentStep.type === 'loading'
  const hideHeaderAndProgress = isDiagnosisSequence || isLoadingScreen

  return (
    <div style={{ backgroundColor: COLORS.BACKGROUND, minHeight: '100vh', position: 'relative', overflowX: 'hidden', overflowY: 'auto' }}>
      {/* Persistent Header - uses absolute positioning when inside a panel */}
      {/* Hidden for diagnosis-sequence and loading screens */}
      {!hideHeader && !hideHeaderAndProgress && (
        <GlassHeader
          onBack={goToPreviousStep}
          showBackButton={(currentStepIndex > 0 || !!onBack) && !shouldDimBackButton}
          useAbsolutePosition={!!onBack}
          flowId={flowId}
        />
      )}

      {/* Persistent Progress Indicator - stays in place while content slides */}
      {/* Hidden for diagnosis-sequence and loading screens */}
      {!hideHeaderAndProgress && (
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
      )}

      {/* Animated Content Area - slides horizontally */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStepIndex}
          custom={direction}
          variants={getContentVariants(direction)}
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
