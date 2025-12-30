'use client'

import { Avatar } from './Avatar'
import { RafaelLabel } from './RafaelLabel'

interface Props {
  onBack?: () => void
  showBackButton?: boolean
  dimBackButton?: boolean
  useAbsolutePosition?: boolean
}

// Liquid Glass Header - matching ChatHome/ActiveChat design
// useAbsolutePosition: true for panels in ExperienceShell to avoid overlap
export function LiquidGlassHeader({ onBack, showBackButton = true, dimBackButton = false, useAbsolutePosition = false }: Props) {
  return (
    <div style={{
      position: useAbsolutePosition ? 'absolute' : 'fixed',
      top: 6,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
      padding: '0 20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '720px',
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      }}>
        {/* Back Arrow */}
        <div
          onClick={showBackButton && !dimBackButton ? onBack : undefined}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            color: '#666',
            background: '#F0EBE4',
            border: '1px solid #E8E3DC',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            cursor: showBackButton && !dimBackButton ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: dimBackButton ? 0.3 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </div>

        {/* Center - Avatar + Rafael Label */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <Avatar size={40} />
          <RafaelLabel size="large" />
        </div>

        {/* Account Icon - Dimmed (user not signed in yet) */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            color: '#666',
            background: '#F0EBE4',
            border: '1px solid #E8E3DC',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.35,
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
