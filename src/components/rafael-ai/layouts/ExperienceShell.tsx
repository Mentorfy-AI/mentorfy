'use client'

import { useRef, useEffect, useState, ReactNode } from 'react'

interface ExperienceShellProps {
  children: ReactNode
  currentPanel?: number
  onPanelChange?: (panel: number) => void
}

export function ExperienceShell({ children, currentPanel = 1, onPanelChange }: ExperienceShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const isProgrammaticScroll = useRef(false)

  useEffect(() => {
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
    }, 800)
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
}

export function Panel({ children }: PanelProps) {
  return (
    <div
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
