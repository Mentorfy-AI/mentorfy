'use client'

import { getFlow } from '@/data/flows'

const ACCENT_COLOR = '#10B981'

interface Props {
  size?: 'large' | 'small'
  flowId?: string
}

// Mentor name with verified badge
export function MentorBadge({ size = 'large', flowId = 'rafael-tats' }: Props) {
  const isLarge = size === 'large'
  const flow = getFlow(flowId)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        fontSize: isLarge ? '19px' : '15px',
        fontWeight: '600',
        color: '#111',
        fontFamily: "'Lora', Charter, Georgia, serif",
      }}>
        {flow.mentor.name}
      </span>
      <svg width={isLarge ? 20 : 16} height={isLarge ? 20 : 16} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <g fill={ACCENT_COLOR}>
          <circle cx="12" cy="4.5" r="3.5" />
          <circle cx="17.3" cy="6.7" r="3.5" />
          <circle cx="19.5" cy="12" r="3.5" />
          <circle cx="17.3" cy="17.3" r="3.5" />
          <circle cx="12" cy="19.5" r="3.5" />
          <circle cx="6.7" cy="17.3" r="3.5" />
          <circle cx="4.5" cy="12" r="3.5" />
          <circle cx="6.7" cy="6.7" r="3.5" />
          <circle cx="12" cy="12" r="6" />
        </g>
        <path
          d="M9.5 12.5L11 14L14.5 10"
          stroke="#FFFFFF"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  )
}
