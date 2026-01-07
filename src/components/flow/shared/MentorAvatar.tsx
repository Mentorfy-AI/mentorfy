'use client'

import { useState } from 'react'
import { getFlow } from '@/data/flows'

interface Props {
  size?: number
  flowId?: string
}

// MentorAvatar component with black glow
export function MentorAvatar({ size = 32, flowId = 'rafael-tats' }: Props) {
  const [imgError, setImgError] = useState(false)
  const rgb = { r: 0, g: 0, b: 0 }
  const flow = getFlow(flowId)

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '9999px',
        overflow: 'hidden',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 6px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4), 0 0 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25), 0 0 32px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
      }}
    >
      {imgError ? (
        <span style={{ color: '#FFFFFF', fontSize: size * 0.4, fontWeight: '500' }}>{flow.mentor.name[0]}</span>
      ) : (
        <img
          src={flow.mentor.avatar}
          alt={flow.mentor.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}
