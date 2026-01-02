'use client'

const ACCENT_LIGHT = 'rgba(16, 185, 129, 0.08)'
const ACCENT_BORDER = 'rgba(16, 185, 129, 0.5)'

interface Props {
  label: string
  selected?: boolean
  onClick?: () => void
}

export function OptionButton({ label, selected, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: selected ? ACCENT_LIGHT : '#FFFFFF',
        border: selected ? `2px solid ${ACCENT_BORDER}` : '1px solid #EBEBEB',
        borderRadius: '12px',
        padding: selected ? '15px 19px' : '16px 20px',
        fontFamily: "'Lora', Charter, Georgia, serif",
        fontSize: '17px',
        color: '#111',
        boxShadow: selected
          ? '0 4px 12px rgba(0,0,0,0.05)'
          : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </div>
  )
}
