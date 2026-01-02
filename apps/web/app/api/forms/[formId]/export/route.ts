import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface FormSubmission {
  id: string
  email: string | null
  phone: string | null
  status: string
  answers: Array<{
    questionId: string
    questionText: string
    value: string
    answeredAt: string
  }>
  started_at: string
  completed_at: string | null
}

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function extractNameFromAnswers(answers: FormSubmission['answers']): string {
  const firstName = answers.find(a =>
    a.questionId?.toLowerCase().includes('first') ||
    a.questionText?.toLowerCase().includes('first name')
  )?.value || ''
  const lastName = answers.find(a =>
    a.questionId?.toLowerCase().includes('last') ||
    a.questionText?.toLowerCase().includes('last name')
  )?.value || ''
  return `${firstName} ${lastName}`.trim() || 'Unknown'
}

function extractEmailFromAnswers(answers: FormSubmission['answers']): string {
  return answers.find(a =>
    a.questionId?.toLowerCase().includes('email') ||
    a.questionText?.toLowerCase().includes('email')
  )?.value || ''
}

function extractPhoneFromAnswers(answers: FormSubmission['answers']): string {
  return answers.find(a =>
    a.questionId?.toLowerCase().includes('phone') ||
    a.questionText?.toLowerCase().includes('phone')
  )?.value || ''
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClerkSupabaseClient()

  // Get form details for filename
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('slug, name')
    .eq('id', formId)
    .single()

  if (formError || !form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  // Get all submissions for this form
  const { data: submissions, error } = await supabase
    .from('form_submissions')
    .select(`
      id,
      email,
      phone,
      status,
      answers,
      started_at,
      completed_at
    `)
    .eq('form_id', formId)
    .order('started_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }

  const typedSubmissions = (submissions || []) as FormSubmission[]

  // Collect all unique question texts across all submissions
  const questionSet = new Set<string>()
  typedSubmissions.forEach(sub => {
    sub.answers?.forEach(answer => {
      if (answer.questionText) {
        questionSet.add(answer.questionText)
      }
    })
  })
  const questionColumns = Array.from(questionSet)

  // Build CSV header
  const headers = ['Name', 'Email', 'Phone', 'Status', 'Submitted', ...questionColumns]
  const headerRow = headers.map(escapeCSV).join(',')

  // Build CSV rows
  const rows = typedSubmissions.map(sub => {
    const name = extractNameFromAnswers(sub.answers || [])
    const email = sub.email || extractEmailFromAnswers(sub.answers || [])
    const phone = sub.phone || extractPhoneFromAnswers(sub.answers || [])
    const status = sub.status === 'completed' ? 'Completed' : 'In Progress'
    const submitted = sub.completed_at || sub.started_at
      ? new Date(sub.completed_at || sub.started_at).toISOString()
      : ''

    // Build answer values in column order
    const answerValues = questionColumns.map(questionText => {
      const answer = sub.answers?.find(a => a.questionText === questionText)
      return answer?.value || ''
    })

    return [name, email, phone, status, submitted, ...answerValues]
      .map(escapeCSV)
      .join(',')
  })

  const csv = [headerRow, ...rows].join('\n')

  // Generate filename
  const date = new Date().toISOString().split('T')[0]
  const filename = `${form.slug}-submissions-${date}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
