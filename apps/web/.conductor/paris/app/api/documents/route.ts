import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface Document {
  id: string
  title: string
  clerk_org_id: string
  file_type: string
  file_size: number
  storage_path: string | null
  created_at: string
  processing_status: 'pending_upload' | 'uploaded' | 'processing' | 'retrying' | 'available_to_ai' | 'failed'
  word_count?: number
  source_type: string
  retry_count: number
  next_retry_at: string | null
  last_error: string | null
  error_type: 'rate_limit' | 'network_error' | 'processing_error' | 'unknown_error' | null
  folder_id: string | null
}

export interface DocumentListResponse {
  success: boolean
  documents?: Document[]
  totalWords?: number
  error?: string
}

/**
 * GET /api/documents
 * List all documents for current organization
 * Uses server-side Supabase client with proper Clerk JWT for RLS
 */
export async function GET(request: NextRequest): Promise<NextResponse<DocumentListResponse>> {
  try {
    await requireAuth()

    const supabase = await createClerkSupabaseClient()

    // Get all documents for organization (RLS filters by org automatically via JWT)
    const { data: documents, error: documentsError } = await supabase
      .from('document')
      .select('*')
      .order('created_at', { ascending: false })

    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Calculate word counts (simple estimation: ~5 characters per word)
    const processedDocuments = (documents || []).map((doc: any) => ({
      ...doc,
      word_count: Math.round((doc.file_size || 0) / 5)
    }))

    // Calculate total words
    const totalWords = processedDocuments.reduce((total: number, doc: any) => {
      return total + (doc.word_count || 0)
    }, 0)

    return NextResponse.json({
      success: true,
      documents: processedDocuments,
      totalWords
    })

  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
