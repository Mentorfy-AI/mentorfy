'use client'

import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}

export function ActionButton({ children, onClick, disabled, loading, fullWidth = true }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${fullWidth ? 'w-full' : 'px-8'}
        py-[18px] rounded-xl
        bg-black text-white
        font-medium text-base
        transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        hover:bg-gray-900 active:scale-[0.98]
        flex items-center justify-center gap-2
      `}
      style={{ fontFamily: "'Geist', sans-serif" }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  )
}
