'use client'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

export function TextInput({ value, onChange, placeholder, minHeight = 150 }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="
        w-full px-5 py-4 rounded-xl border border-gray-200
        text-gray-900 placeholder:text-gray-400
        focus:outline-none focus:border-emerald-500
        resize-none transition-colors
      "
      style={{
        minHeight: `${minHeight}px`,
        fontFamily: "'Lora', serif",
        fontSize: '16px',
        lineHeight: '1.7'
      }}
    />
  )
}
