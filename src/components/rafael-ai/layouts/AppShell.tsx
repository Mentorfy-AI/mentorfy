'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 }
  }
}

interface AppShellProps {
  children: ReactNode
  className?: string
  withPadding?: boolean
  hasChatInput?: boolean
}

export function AppShell({ children, className = "", withPadding = true, hasChatInput = false }: AppShellProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`
        min-h-screen bg-white
        ${withPadding ? 'px-6 py-12 md:px-8 md:py-16' : ''}
        ${hasChatInput ? 'pb-24' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}

interface ContentContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export function ContentContainer({ children, className = "", maxWidth = "md" }: ContentContainerProps) {
  const maxWidthClass: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }

  return (
    <div className={`${maxWidthClass[maxWidth]} mx-auto w-full ${className}`}>
      {children}
    </div>
  )
}
