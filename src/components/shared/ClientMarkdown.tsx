'use client'

import { ComponentProps, useMemo } from 'react'

type MarkdownProps = ComponentProps<'div'> & {
  children: string
}

// Simple markdown renderer that avoids react-markdown Turbopack issues
export function ClientMarkdown({ children, ...props }: MarkdownProps) {
  const rendered = useMemo(() => parseMarkdown(children), [children])
  return <div {...props}>{rendered}</div>
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null
  let key = 0

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type
      elements.push(
        <ListTag key={key++} style={{ marginBottom: '16px', paddingLeft: '24px' }}>
          {currentList.items.map((item, i) => (
            <li key={i} style={{ marginBottom: '8px' }}>{renderInline(item)}</li>
          ))}
        </ListTag>
      )
      currentList = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headers
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={key++} style={{ fontSize: '18px', fontWeight: 600, margin: '24px 0 12px 0' }}>{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={key++} style={{ fontSize: '22px', fontWeight: 600, margin: '28px 0 16px 0' }}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      flushList()
      elements.push(<h1 key={key++} style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 24px 0' }}>{renderInline(line.slice(2))}</h1>)
    }
    // Unordered list
    else if (line.match(/^[-*] /)) {
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(line.slice(2))
    }
    // Ordered list
    else if (line.match(/^\d+\. /)) {
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(line.replace(/^\d+\. /, ''))
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      flushList()
      elements.push(
        <blockquote key={key++} style={{ borderLeft: '3px solid #10B981', paddingLeft: '16px', margin: '16px 0', fontStyle: 'italic', color: '#444' }}>
          {renderInline(line.slice(2))}
        </blockquote>
      )
    }
    // Empty line
    else if (line.trim() === '') {
      flushList()
    }
    // Paragraph
    else {
      flushList()
      elements.push(<p key={key++} style={{ marginBottom: '16px' }}>{renderInline(line)}</p>)
    }
  }

  flushList()
  return elements
}

function renderInline(text: string): React.ReactNode {
  // Process bold and italic
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1])
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{boldMatch[3]}</strong>)
      remaining = boldMatch[4]
      continue
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(.*?)(\*|_)(.+?)\2(.*)$/)
    if (italicMatch) {
      if (italicMatch[1]) parts.push(italicMatch[1])
      parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{italicMatch[3]}</em>)
      remaining = italicMatch[4]
      continue
    }

    // No more matches, add remaining text
    parts.push(remaining)
    break
  }

  return parts.length === 1 ? parts[0] : parts
}
