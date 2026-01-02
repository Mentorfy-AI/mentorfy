import { getFormSubmissions, type SubmissionFilters } from '@/lib/data/forms'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '25', 10)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') as SubmissionFilters['status'] || ''

  const filters: SubmissionFilters = {
    search: search || undefined,
    status: status || undefined,
  }

  try {
    const data = await getFormSubmissions(formId, page, limit, filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching form submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
