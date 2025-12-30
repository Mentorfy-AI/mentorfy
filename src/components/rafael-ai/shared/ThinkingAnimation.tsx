'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  messages: string[]
  onComplete?: () => void
}

export function ThinkingAnimation({ messages, onComplete }: Props) {
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  const stateRef = useRef({
    messageIndex: 0,
    isTyping: true,
    completed: false
  })

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 530)
    return () => clearInterval(interval)
  }, [])

  // Animation loop using refs to avoid setState-in-effect issues
  useEffect(() => {
    let timeout: NodeJS.Timeout

    const animate = () => {
      const { messageIndex, isTyping, completed } = stateRef.current

      if (completed) return

      const currentMessage = messages[messageIndex]
      const isLastMessage = messageIndex === messages.length - 1

      if (!currentMessage) {
        stateRef.current.completed = true
        onComplete?.()
        return
      }

      if (isTyping) {
        // Typing phase
        setDisplayText(prev => {
          if (prev.length < currentMessage.length) {
            timeout = setTimeout(animate, 40 + Math.random() * 20)
            return currentMessage.slice(0, prev.length + 1)
          } else {
            // Finished typing
            if (isLastMessage) {
              timeout = setTimeout(() => {
                stateRef.current.completed = true
                onComplete?.()
              }, 1500)
            } else {
              timeout = setTimeout(() => {
                stateRef.current.isTyping = false
                animate()
              }, 1000)
            }
            return prev
          }
        })
      } else {
        // Backspacing phase
        setDisplayText(prev => {
          if (prev.length > 0) {
            timeout = setTimeout(animate, 25)
            return prev.slice(0, -1)
          } else {
            // Move to next message
            stateRef.current.messageIndex++
            stateRef.current.isTyping = true
            timeout = setTimeout(animate, 100)
            return ''
          }
        })
      }
    }

    animate()

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [messages, onComplete])

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <p
        className="text-xl text-gray-700 italic text-center"
        style={{ fontFamily: "'Lora', serif" }}
      >
        {displayText}
        <span
          className={`inline-block w-0.5 h-5 bg-gray-700 ml-0.5 align-middle transition-opacity ${showCursor ? 'opacity-100' : 'opacity-0'}`}
        />
      </p>
    </div>
  )
}
