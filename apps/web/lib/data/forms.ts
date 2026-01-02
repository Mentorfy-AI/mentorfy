import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export interface OrgForm {
  id: string
  name: string
  slug: string
  bot_id: string | null
  bot_name: string | null
  submission_count: number
}

export interface FormSubmission {
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
  clerk_user_id: string | null
  metadata: {
    email_mismatch?: boolean
    authenticated_email?: string
    mismatch_detected_at?: string
  } | null
  has_user_profile: boolean
}

export interface PaginatedSubmissions {
  submissions: FormSubmission[]
  total: number
  totalPages: number
  page: number
  limit: number
}

export async function getOrgForms(): Promise<OrgForm[]> {
  const supabase = await createClerkSupabaseClient()

  const { data: forms, error } = await supabase
    .from('forms')
    .select(`
      id,
      name,
      slug,
      bot_id,
      mentor_bot:bot_id (
        name
      )
    `)
    .order('name')

  if (error) throw error

  // Get submission counts for each form
  const formIds = forms?.map(f => f.id) || []

  if (formIds.length === 0) {
    return []
  }

  const { data: counts, error: countError } = await supabase
    .from('form_submissions')
    .select('form_id')
    .in('form_id', formIds)

  if (countError) throw countError

  // Count submissions per form
  const countMap = new Map<string, number>()
  counts?.forEach(s => {
    countMap.set(s.form_id, (countMap.get(s.form_id) || 0) + 1)
  })

  return (forms || []).map(form => ({
    id: form.id,
    name: form.name,
    slug: form.slug,
    bot_id: form.bot_id,
    bot_name: (form.mentor_bot as { name: string } | null)?.name || null,
    submission_count: countMap.get(form.id) || 0,
  }))
}

export interface SubmissionFilters {
  search?: string
  status?: 'completed' | 'in_progress' | ''
}

export async function getFormSubmissions(
  formId: string,
  page: number = 1,
  limit: number = 25,
  filters?: SubmissionFilters
): Promise<PaginatedSubmissions> {
  const supabase = await createClerkSupabaseClient()

  // Build base query for count
  let countQuery = supabase
    .from('form_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', formId)

  // Build base query for data
  let dataQuery = supabase
    .from('form_submissions')
    .select(`
      id,
      email,
      phone,
      status,
      answers,
      started_at,
      completed_at,
      clerk_user_id,
      metadata
    `)
    .eq('form_id', formId)

  // Apply status filter
  if (filters?.status) {
    countQuery = countQuery.eq('status', filters.status)
    dataQuery = dataQuery.eq('status', filters.status)
  }

  // Get total count
  const { count, error: countError } = await countQuery

  if (countError) throw countError

  const total = count || 0
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit

  // Get paginated submissions
  const { data: submissions, error } = await dataQuery
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  // Get clerk_user_ids that have user_profile records
  const clerkUserIds = (submissions || [])
    .map(s => s.clerk_user_id)
    .filter((id): id is string => id !== null)

  let userProfileSet = new Set<string>()
  if (clerkUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profile')
      .select('clerk_user_id')
      .in('clerk_user_id', clerkUserIds)

    userProfileSet = new Set((profiles || []).map(p => p.clerk_user_id))
  }

  // Apply client-side search filter on answers (name, email, phone)
  let filteredSubmissions = (submissions || []).map(s => ({
    ...s,
    has_user_profile: s.clerk_user_id ? userProfileSet.has(s.clerk_user_id) : false,
  })) as FormSubmission[]

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase()
    filteredSubmissions = filteredSubmissions.filter(sub => {
      const answers = sub.answers || []
      const searchableText = answers.map(a => a.value || '').join(' ').toLowerCase()
      const emailMatch = (sub.email || '').toLowerCase().includes(searchLower)
      const phoneMatch = (sub.phone || '').toLowerCase().includes(searchLower)
      return searchableText.includes(searchLower) || emailMatch || phoneMatch
    })
  }

  return {
    submissions: filteredSubmissions,
    total: filters?.search ? filteredSubmissions.length : total,
    totalPages: filters?.search ? Math.ceil(filteredSubmissions.length / limit) : totalPages,
    page,
    limit,
  }
}
