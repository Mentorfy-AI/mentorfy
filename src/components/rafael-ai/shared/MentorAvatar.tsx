'use client'

import { useState } from 'react'
import { mentor } from '@/data/rafael-ai/mentor'

interface Props {
  size?: 32 | 64 | 80 | 96
  glowing?: boolean
}

export function MentorAvatar({ size = 64, glowing = true }: Props) {
  const [imgError, setImgError] = useState(false)

  const sizeClasses: Record<number, string> = {
    32: 'w-8 h-8',
    64: 'w-16 h-16',
    80: 'w-20 h-20',
    96: 'w-24 h-24'
  }

  const glowSize: Record<number, string> = {
    32: 'blur-lg',
    64: 'blur-xl',
    80: 'blur-2xl',
    96: 'blur-2xl'
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Glow effect */}
      {glowing && (
        <div
          className={`absolute inset-0 rounded-full bg-emerald-400/20 ${glowSize[size]} scale-150`}
          style={{ transform: 'scale(1.5)' }}
        />
      )}

      {/* Avatar container */}
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden shadow-lg`}>
        {imgError ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <span className="text-white font-semibold" style={{ fontSize: size * 0.4 }}>R</span>
          </div>
        ) : (
          <img
            src={mentor.avatar}
            alt={mentor.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Verified badge - positioned below for larger sizes */}
      {mentor.verified && size >= 64 && (
        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-[15px] font-medium text-black" style={{ fontFamily: "'Geist', sans-serif" }}>
            {mentor.name}
          </span>
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
          </svg>
        </div>
      )}
    </div>
  )
}

export function MentorAvatarInline() {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 shadow-lg">
      {imgError ? (
        <div className="w-full h-full bg-black flex items-center justify-center">
          <span className="text-white text-xs font-semibold">R</span>
        </div>
      ) : (
        <img
          src={mentor.avatar}
          alt={mentor.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}
