import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  text: string;
  isStreaming?: boolean; // Whether the stream is still active
  speed?: number; // ms per character (default: 5ms)
  startDelay?: number; // ms to wait before starting (default: 200ms)
}

interface UseTypewriterReturn {
  displayedText: string;
  remainingText: string;
  shouldFadeIn: boolean;
  onFadeInComplete?: () => void;
}

/**
 * Typewriter effect with instant fade-in when stream ends.
 * Phase 1 (streaming): Types character by character at fixed speed
 * Phase 2 (stream ended): Shows remaining text with fade-in effect
 *
 * @param text - The full text to display (updates as streaming continues)
 * @param isStreaming - Whether new text is still arriving
 * @param speed - Typing speed in ms/char (default: 5ms)
 * @param startDelay - Milliseconds to wait after first text arrives (default: 200ms)
 * @returns Object with displayedText (typed), remainingText (to fade in), and shouldFadeIn flag
 */
export function useTypewriter({
  text,
  isStreaming = false,
  speed = 5,
  startDelay = 200
}: UseTypewriterOptions): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState('');
  const [started, setStarted] = useState(false);
  const [shouldFadeIn, setShouldFadeIn] = useState(false);
  const timerStartedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when text is cleared (e.g., new conversation)
  useEffect(() => {
    if (text.length === 0) {
      setDisplayedText('');
      setStarted(false);
      setShouldFadeIn(false);
      timerStartedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [text.length === 0]);

  // Start typewriter after delay when first text arrives
  useEffect(() => {
    if (text.length > 0 && !started && !timerStartedRef.current) {
      timerStartedRef.current = true;
      const timeout = setTimeout(() => {
        setStarted(true);
      }, startDelay);
      return () => clearTimeout(timeout);
    }
  }, [text.length > 0, started, startDelay]);

  // When stream ends, trigger fade-in for remaining text
  useEffect(() => {
    if (!isStreaming && started && displayedText.length < text.length) {
      // Stream just ended and we have remaining text
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setShouldFadeIn(true);
    }
  }, [isStreaming, started, displayedText.length, text.length]);

  // Fixed-speed typewriter effect (only while streaming)
  useEffect(() => {
    if (!started || text.length === 0 || !isStreaming) {
      return;
    }

    const typeNextChar = () => {
      setDisplayedText(prev => {
        if (prev.length < text.length) {
          return text.slice(0, prev.length + 1);
        }
        return prev;
      });
    };

    intervalRef.current = setInterval(typeNextChar, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, started, isStreaming, speed]);

  const remainingText = text.slice(displayedText.length);

  return {
    displayedText,
    remainingText,
    shouldFadeIn
  };
}
