'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormSubmissionModal } from '@/components/form-submission-modal'
import type { OrgForm, FormSubmission, PaginatedSubmissions } from '@/lib/data/forms'

interface FormSubmissionsTableProps {
  forms: OrgForm[]
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
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

function extractEmailFromAnswers(answers: FormSubmission['answers']): string {
  return answers?.find(a =>
    a.questionId?.toLowerCase().includes('email') ||
    a.questionText?.toLowerCase().includes('email')
  )?.value || ''
}

function extractPhoneFromAnswers(answers: FormSubmission['answers']): string {
  return answers?.find(a =>
    a.questionId?.toLowerCase().includes('phone') ||
    a.questionText?.toLowerCase().includes('phone')
  )?.value || ''
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  return date.toLocaleDateString()
}

export function FormSubmissionsTable({ forms }: FormSubmissionsTableProps) {
  const [selectedFormId, setSelectedFormId] = useState<string>(forms[0]?.id || '')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedSubmissions | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const debouncedSearch = useDebounce(searchInput, 300)
  const selectedForm = forms.find(f => f.id === selectedFormId)

  // Fetch submissions when form, page, search, or status changes
  useEffect(() => {
    if (!selectedFormId) {
      setData(null)
      return
    }

    async function fetchSubmissions() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '25',
        })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statusFilter) params.set('status', statusFilter)

        const response = await fetch(
          `/api/forms/${selectedFormId}/submissions?${params}`
        )
        if (!response.ok) throw new Error('Failed to fetch')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Error fetching submissions:', error)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [selectedFormId, page, debouncedSearch, statusFilter])

  // Reset page when form or filters change
  useEffect(() => {
    setPage(1)
    setSelectedIndex(null)
  }, [selectedFormId, debouncedSearch, statusFilter])

  const handleExport = () => {
    if (!selectedFormId) return
    window.location.href = `/api/forms/${selectedFormId}/export`
  }

  const handleRowClick = (index: number) => {
    setSelectedIndex(index)
  }

  const handleModalClose = () => {
    setSelectedIndex(null)
  }

  const handleModalPrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleModalNext = () => {
    if (selectedIndex !== null && data && selectedIndex < data.submissions.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const clearFilters = () => {
    setSearchInput('')
    setStatusFilter('')
  }

  const hasFilters = searchInput || statusFilter

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex-1">
          <Select value={selectedFormId} onValueChange={setSelectedFormId}>
            <SelectTrigger className="w-full max-w-xs h-8 text-xs">
              <SelectValue placeholder="Select a form..." />
            </SelectTrigger>
            <SelectContent>
              {forms.map(form => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name} ({form.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedForm && (
            <p className="text-xs text-muted-foreground mt-1">
              Bot: {selectedForm.bot_name || 'None'} • {selectedForm.submission_count.toLocaleString()} submissions
            </p>
          )}
        </div>
        {selectedFormId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Search and Filter Row */}
      {selectedFormId && (
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="h-8 text-xs pl-8"
            />
          </div>
          <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">Partial</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {!selectedFormId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Select a form to view submissions
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : !data || data.submissions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No submissions yet
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((submission, index) => {
                  const name = extractNameFromAnswers(submission.answers)
                  const email = submission.email || extractEmailFromAnswers(submission.answers)
                  const phone = submission.phone || extractPhoneFromAnswers(submission.answers)
                  const when = formatRelativeTime(submission.completed_at || submission.started_at)

                  return (
                    <tr
                      key={submission.id}
                      onClick={() => handleRowClick(index)}
                      className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5">{name}</td>
                      <td className="py-2.5 text-muted-foreground">{email}</td>
                      <td className="py-2.5 text-muted-foreground">{phone}</td>
                      <td className="py-2.5">
                        {submission.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Partial
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{when}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3 border-t mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="h-7 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selectedIndex !== null && data && (
        <FormSubmissionModal
          submission={data.submissions[selectedIndex]}
          currentIndex={selectedIndex}
          total={data.submissions.length}
          onPrev={handleModalPrev}
          onNext={handleModalNext}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
