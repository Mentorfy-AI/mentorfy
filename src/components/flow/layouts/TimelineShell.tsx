'use client'

import { useRef, useEffect, useState, ReactNode } from 'react'
import { TIMING } from '@/config/rafael-ai'

interface TimelineShellProps {
  children: ReactNode
  currentPanel?: number
  onPanelChange?: (panel: number) => void
}

export function TimelineShell({ children, currentPanel = 0, onPanelChange }: TimelineShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const isProgrammaticScroll = useRef(false)
  const hasInitializedRef = useRef(false)

  // Force scroll to correct panel on initial mount (instant, no animation)
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    if (!containerRef.current) return
    const panelWidth = containerRef.current.offsetWidth
    isProgrammaticScroll.current = true
    containerRef.current.scrollTo({
      left: currentPanel * panelWidth,
      behavior: 'instant'
    })
    setTimeout(() => {
      isProgrammaticScroll.current = false
    }, TIMING.PROGRAMMATIC_SCROLL_INIT)
  }, [])

  // Handle panel changes after initialization
  useEffect(() => {
    if (!hasInitializedRef.current) return
    if (!containerRef.current || isScrolling) return
    const panelWidth = containerRef.current.offsetWidth
    isProgrammaticScroll.current = true
    containerRef.current.scrollTo({
      left: currentPanel * panelWidth,
      behavior: 'smooth'
    })
    // Reset after scroll completes - longer timeout for multi-panel scrolls
    setTimeout(() => {
      isProgrammaticScroll.current = false
    }, TIMING.PROGRAMMATIC_SCROLL_RESET)
  }, [currentPanel, isScrolling])

  const handleScroll = () => {
    if (!containerRef.current) return
    if (isProgrammaticScroll.current) return
    const panelWidth = containerRef.current.offsetWidth
    const scrollLeft = containerRef.current.scrollLeft
    const newPanel = Math.round(scrollLeft / panelWidth)
    if (newPanel !== currentPanel) {
      onPanelChange?.(newPanel)
    }
  }

  const handleScrollEnd = () => {
    setIsScrolling(false)
  }

  const handleScrollStart = () => {
    setIsScrolling(true)
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onMouseDown={handleScrollStart}
      onTouchStart={handleScrollStart}
      onMouseUp={handleScrollEnd}
      onTouchEnd={handleScrollEnd}
      style={{
        display: 'flex',
        height: '100vh',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        ::-webkit-scrollbar { display: none; }
      `}</style>
      {children}
    </div>
  )
}

interface PanelProps {
  children: ReactNode
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

export function Panel({ children, scrollRef }: PanelProps) {
  return (
    <div
      ref={scrollRef}
      style={{
        width: '100vw',
        height: '100vh',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  )
}
