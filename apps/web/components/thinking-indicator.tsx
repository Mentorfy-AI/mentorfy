"use client"

import { useState, useEffect, useRef } from 'react'

interface ThinkingIndicatorProps {
  /** Whether the AI is currently thinking (waiting for first token) */
  isThinking: boolean
  /** Whether the first token has arrived */
  hasFirstToken: boolean
  /** Time to first token in hundredths of a second (only used after first token arrives) */
  timeToFirstToken?: number
}

/**
 * Displays "Thinking... X.XXs" while waiting for first token,
 * then switches to "Thought for X.XXs" after first token arrives.
 * Includes animated logo and text effects during thinking phase.
 */
export function ThinkingIndicator({
  isThinking,
  hasFirstToken,
  timeToFirstToken = 0,
}: ThinkingIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState(0) // in hundredths of a second
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Timer effect: counts up in hundredths of a second while thinking
  useEffect(() => {
    if (isThinking && !hasFirstToken) {
      // Start timer when thinking begins
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now()
      }

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current!
        setElapsedTime(Math.floor(elapsed / 10)) // Convert to hundredths of a second
      }, 10) // Update every 10ms (hundredth of a second)

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
        }
      }
    } else if (hasFirstToken && timerIntervalRef.current) {
      // Stop timer when first token arrives
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    } else if (!isThinking) {
      // Reset timer when not thinking
      setElapsedTime(0)
      startTimeRef.current = null
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [isThinking, hasFirstToken])

  // Format time in seconds with 2 decimal places
  const formatTime = (hundredths: number) => {
    return (hundredths / 100).toFixed(2)
  }

  return (
    <div className="flex items-center gap-3 py-4">
      {/* Only show logo while thinking (hide after first token) */}
      {!hasFirstToken && (
        <>
          <img
            src="/icons/logo-dark.svg"
            alt="Loading"
            width="32"
            height="32"
            className="dark:hidden"
            style={{
              animation: 'logo-spin-initial 1.5s ease-out 0s 1, logo-pulse-pattern 3.6s ease-in-out 1.5s infinite'
            }}
          />
          <img
            src="/icons/logo-light.svg"
            alt="Loading"
            width="32"
            height="32"
            className="hidden dark:block"
            style={{
              animation: 'logo-spin-initial 1.5s ease-out 0s 1, logo-pulse-pattern 3.6s ease-in-out 1.5s infinite'
            }}
          />
        </>
      )}

      <div className="relative">
        <span className="text-foreground">
          {!hasFirstToken ? (
            // Before first token: "Thinking... X.XXs" with animated text
            <>
              {'Thinking...'.split('').map((char, index) => (
                <span
                  key={index}
                  className="inline-block text-scan-char"
                  style={{
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  {char}
                </span>
              ))}
              <span className="ml-2 font-mono text-muted-foreground">
                {formatTime(elapsedTime)}s
              </span>
            </>
          ) : (
            // After first token: "Thought for X.XXs" - no animation, static text
            <>
              <span>Thought for</span>
              <span className="ml-1 font-mono text-muted-foreground">
                {formatTime(timeToFirstToken)}s
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
