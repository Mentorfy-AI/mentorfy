import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth-helpers'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

interface Document {
  id: string
  title: string
  description: string | null
  file_type: string
  file_size: number
  processing_status: string
  source_type: 'manual_upload' | 'youtube' | 'google_drive' | 'fathom' | 'fireflies' | 'read_ai'
  source_url: string | null
  ready_for_ingest: boolean
  import_completed_at: string | null
  ingest_completed_at: string | null
  folder_id: string | null
  created_at: string
  updated_at: string
}

export interface FolderDocumentsResponse {
  success: boolean
  documents?: Document[]
  total?: number
  error?: string
}

/**
 * GET /api/folders/[folderId]/documents
 * List documents in a folder with optional recursion
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
): Promise<NextResponse<FolderDocumentsResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { folderId } = await params

    const supabase = await createClerkSupabaseClient()

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const recursive = searchParams.get('recursive') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify folder exists and belongs to org
    const { data: folder, error: folderError } = await supabase
      .from('folder')
      .select('id')
      .eq('id', folderId)
      .eq('clerk_org_id', orgId)
      .single()

    if (folderError || !folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      )
    }

    let documents: Document[] = []
    let totalCount = 0

    if (recursive) {
      // Get all descendant folder IDs
      const folderIds = await getDescendantFolderIds(supabase, folderId, orgId)
      folderIds.push(folderId) // Include current folder

      // Get documents from all folders
      const { data, error: docsError, count } = await supabase
        .from('document')
        .select('*', { count: 'exact' })
        .eq('clerk_org_id', orgId)
        .in('folder_id', folderIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (docsError) {
        console.error('Error fetching documents:', docsError)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch documents' },
          { status: 500 }
        )
      }

      documents = data || []
      totalCount = count || 0

    } else {
      // Get documents only from this folder
      const { data, error: docsError, count } = await supabase
        .from('document')
        .select('*', { count: 'exact' })
        .eq('folder_id', folderId)
        .eq('clerk_org_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (docsError) {
        console.error('Error fetching documents:', docsError)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch documents' },
          { status: 500 }
        )
      }

      documents = data || []
      totalCount = count || 0
    }

    return NextResponse.json({
      success: true,
      documents,
      total: totalCount
    })

  } catch (error) {
    console.error('Folder documents API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

/**
 * Helper function to recursively get all descendant folder IDs
 */
async function getDescendantFolderIds(
  supabase: any,
  folderId: string,
  orgId: string
): Promise<string[]> {
  const descendants: string[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const currentId = queue.shift()!

    // Get child folders
    const { data: children, error } = await supabase
      .from('folder')
      .select('id')
      .eq('parent_folder_id', currentId)
      .eq('clerk_org_id', orgId)

    if (error) {
      console.error('Error fetching child folders:', error)
      continue
    }

    if (children && children.length > 0) {
      const childIds = children.map(c => c.id)
      descendants.push(...childIds)
      queue.push(...childIds)
    }
  }

  return descendants
}
