import { useState } from 'react'

export function ChatInput({ placeholder = "Message Rafael...", onSend, onAttach, onVoice, disabled }) {
  const [value, setValue] = useState('')
  const hasText = value.trim().length > 0

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (hasText && !disabled) {
      onSend(value.trim())
      setValue('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-50">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-2xl mx-auto">
        {/* Plus button */}
        <button
          type="button"
          onClick={onAttach}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        {/* Input container */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="
              w-full bg-gray-50 border border-gray-200 rounded-full
              py-3 pl-5 pr-20
              text-[15px] text-gray-900 placeholder:text-gray-400
              focus:outline-none focus:border-gray-300
              disabled:opacity-50
              transition-colors
            "
            style={{ fontFamily: "'Geist', sans-serif" }}
          />

          {/* Right icons inside input */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Mic button */}
            <button
              type="button"
              onClick={onVoice}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={!hasText || disabled}
              className={`
                p-1 transition-colors active:scale-95
                ${hasText ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300'}
              `}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
