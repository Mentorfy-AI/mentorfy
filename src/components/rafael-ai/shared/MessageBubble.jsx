import { motion } from 'framer-motion'
import { VideoEmbed } from './VideoEmbed'

function parseMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function MessageBubble({ role, content, videoUrl, index = 0 }) {
  const isRafael = role === 'assistant'

  const paragraphs = content.split('\n\n').filter(p => p.trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className={`flex ${isRafael ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`
          max-w-[80%] px-5 py-4
          ${isRafael
            ? 'bg-gray-100 rounded-2xl rounded-bl-sm ml-3'
            : 'bg-black text-white rounded-2xl rounded-br-sm mr-3'
          }
        `}
      >
        <div className="space-y-3">
          {paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className={`text-base leading-relaxed ${isRafael ? 'text-gray-800' : 'text-white'}`}
              style={{ fontFamily: isRafael ? "'Lora', serif" : "'Geist', sans-serif" }}
            >
              {parseMarkdown(paragraph)}
            </p>
          ))}
        </div>

        {/* Embedded video */}
        {videoUrl && (
          <div className="mt-4">
            <VideoEmbed url={videoUrl} maxWidth="100%" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-5 py-4 ml-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-gray-400 rounded-full"
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
