'use client'

import { useState, useEffect } from 'react'
import { ChatBar } from '../shared/ChatBar'

// Journey text varies based on completed phase
const JOURNEY_TEXTS: Record<number, string> = {
  // After completing Phase 1 (currentPhase = 2)
  2: `Your journey so far...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 1 COMPLETE

You came in charging $500-$1k per day with inconsistent bookings.

You want to hit $30k-$50k months consistently.

You said what's stopping you is unpredictable content results and price shoppers who can't afford you.

And when I asked what you really tell yourself? You said:

"I keep telling myself I'm not good enough to charge what other artists charge."

That's the pattern.

Not a skill problem. Not a market problem. A belief problem.

We're going to fix that.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,

  // After completing Phase 2 (currentPhase = 3)
  3: `Your journey so far...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 2 COMPLETE

Congratulations. You've made it through the deep work.

You identified your core limiting belief. You saw how it's been running the show.

You committed to a new standard — not just in pricing, but in how you see yourself.

The old story: "I'm not good enough to charge what other artists charge."

The new story: "I deliver transformation. My prices reflect my value."

This isn't about confidence tricks or fake-it-til-you-make-it.

This is about alignment. When your prices match your value, the right clients find you.

You're ready for the next phase.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
}

interface AIMemoryProps {
  onNavigateToPresent?: () => void
  onStartChat: (message: string) => void
  onArrowReady?: () => void
  currentPhase: number
}

export function AIMemory({ onNavigateToPresent, onStartChat, onArrowReady, currentPhase }: AIMemoryProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTypingComplete, setIsTypingComplete] = useState(false)

  // Get journey text for current level (default to level 2 text)
  const journeyText = JOURNEY_TEXTS[currentPhase] || JOURNEY_TEXTS[2]

  // Typewriter effect - resets when currentPhase changes
  useEffect(() => {
    setDisplayedText('')
    setIsTypingComplete(false)

    let index = 0
    const speed = 15 // ms per character

    const typeInterval = setInterval(() => {
      if (index < journeyText.length) {
        setDisplayedText(journeyText.slice(0, index + 1))
        index++
      } else {
        clearInterval(typeInterval)
        setIsTypingComplete(true)
      }
    }, speed)

    return () => clearInterval(typeInterval)
  }, [currentPhase, journeyText])

  // Notify parent that arrow should be ready 1 second after typing completes
  useEffect(() => {
    if (isTypingComplete) {
      const timer = setTimeout(() => {
        onArrowReady?.()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isTypingComplete, onArrowReady])

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#FAF6F0',
    }}>
      {/* Header is now stationary in parent - no header here */}

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '100px 20px 160px',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {/* Journey text with typewriter effect */}
          <pre style={{
            fontFamily: "'Lora', Charter, Georgia, serif",
            fontSize: '17px',
            lineHeight: '1.7',
            color: '#111',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}>
            {displayedText}
            {!isTypingComplete && (
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '1em',
                backgroundColor: '#111',
                marginLeft: '2px',
                animation: 'blink 1s infinite',
              }} />
            )}
          </pre>
        </div>
      </div>

      {/* CSS for blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>

      {/* Chat input */}
      <ChatBar
        placeholder="Message Rafael..."
        onSend={(message) => onStartChat(message)}
      />
    </div>
  )
}
