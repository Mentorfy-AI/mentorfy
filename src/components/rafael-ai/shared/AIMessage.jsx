import { useState, useEffect } from 'react'

function parseMarkdown(text) {
  // Convert **bold** to <strong>
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function AIMessage({ content, streaming = false, onComplete }) {
  const [displayContent, setDisplayContent] = useState(streaming ? '' : content)

  useEffect(() => {
    if (!streaming) {
      setDisplayContent(content)
      return
    }

    // Streaming simulation - reveal word by word
    const words = content.split(' ')
    let currentIndex = 0

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayContent(words.slice(0, currentIndex + 1).join(' '))
        currentIndex++
      } else {
        clearInterval(interval)
        onComplete?.()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [content, streaming, onComplete])

  // Split content into paragraphs
  const paragraphs = displayContent.split('\n\n').filter(p => p.trim())

  return (
    <div
      className="space-y-5"
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className="text-lg leading-[1.75] text-gray-800"
          style={{ fontFamily: "'Lora', serif" }}
        >
          {parseMarkdown(paragraph)}
        </p>
      ))}
    </div>
  )
}
