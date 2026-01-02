'use client'

import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FormSubmission } from '@/lib/data/forms'

interface FormSubmissionModalProps {
  submission: FormSubmission
  currentIndex: number
  total: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

function extractNameFromAnswers(answers: FormSubmission['answers']): string {
  const firstName = answers?.find(a =>
    a.questionId?.toLowerCase().includes('first') ||
    a.questionText?.toLowerCase().includes('first name')
  )?.value || ''
  const lastName = answers?.find(a =>
    a.questionId?.toLowerCase().includes('last') ||
    a.questionText?.toLowerCase().includes('last name')
  )?.value || ''
  return `${firstName} ${lastName}`.trim() || 'Unknown'
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function FormSubmissionModal({
  submission,
  currentIndex,
  total,
  onPrev,
  onNext,
  onClose,
}: FormSubmissionModalProps) {
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < total - 1

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && canGoPrev) {
        onPrev()
      } else if (e.key === 'ArrowRight' && canGoNext) {
        onNext()
      }
    },
    [onClose, onPrev, onNext, canGoPrev, canGoNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const name = extractNameFromAnswers(submission.answers)
  const submittedAt = formatDateTime(submission.completed_at || submission.started_at)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border rounded-lg shadow-xl w-full max-w-lg mx-4 h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={!canGoPrev}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={!canGoNext}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 text-center">
            <h2 className="text-sm font-semibold">{name}</h2>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {submission.status === 'completed' ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                  Completed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  Partial
                </span>
              )}
              <span>•</span>
              <span>{submittedAt}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Email Mismatch Warning */}
          {submission.metadata?.email_mismatch && (
            <div className="flex items-start gap-2 p-3 mb-3 border border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Email Mismatch</p>
                <p className="text-amber-700 dark:text-amber-300">
                  Authenticated as: {submission.metadata.authenticated_email}
                </p>
              </div>
            </div>
          )}

          {/* Answers */}
          {submission.answers && submission.answers.length > 0 ? (
            <div className="space-y-3">
              {submission.answers.map((answer, index) => (
                <div
                  key={answer.questionId || index}
                  className="border rounded-lg p-3"
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {answer.questionText}
                  </p>
                  <p className="text-sm">{answer.value || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No answers recorded
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {total}
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
