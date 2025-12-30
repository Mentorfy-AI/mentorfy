'use client'

import { useRef, useEffect, useState, ReactNode } from 'react'

interface TimelineShellProps {
  children: ReactNode
  currentPanel?: number
  onPanelChange?: (panel: number) => void
  instantScroll?: boolean // Use instant scroll (no animation)
}

export function TimelineShell({ children, currentPanel = 1, onPanelChange, instantScroll }: TimelineShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const isProgrammaticScroll = useRef(false)

  useEffect(() => {
    if (!containerRef.current || isScrolling) return
    const panelWidth = containerRef.current.offsetWidth
    isProgrammaticScroll.current = true

    containerRef.current.scrollTo({
      left: currentPanel * panelWidth,
      behavior: instantScroll ? 'instant' : 'smooth'
    })

    // Reset after scroll completes
    const timeout = instantScroll ? 50 : 800
    setTimeout(() => {
      isProgrammaticScroll.current = false
    }, timeout)
  }, [currentPanel, isScrolling, instantScroll])

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
        backgroundColor: '#FAF6F0', // Consistent cream background
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
        backgroundColor: '#FAF6F0', // Consistent cream background
      }}
    >
      {children}
    </div>
  )
}
