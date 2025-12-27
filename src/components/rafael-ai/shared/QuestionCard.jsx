import { MentorAvatar } from './MentorAvatar'
import { ProgressIndicator } from './ProgressIndicator'

export function QuestionCard({ children, question, currentStep, totalSteps, onBack }) {
  return (
    <div className="flex flex-col min-h-screen px-6 py-8">
      {/* Header with progress and back button */}
      <div className="relative mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <ProgressIndicator current={currentStep} total={totalSteps} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center max-w-md mx-auto w-full">
        <MentorAvatar size={64} glowing={true} />

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl md:text-[28px] leading-tight font-semibold text-center mt-8 mb-10 text-black"
          style={{ fontFamily: "'Lora', serif", letterSpacing: '-0.01em' }}
        >
          {question}
        </motion.h2>

        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  )
}
