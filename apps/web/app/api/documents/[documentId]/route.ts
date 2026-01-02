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
  storage_path: string
  created_at: string
  updated_at: string
}

export interface DocumentResponse {
  success: boolean
  document?: Document
  error?: string
}

export interface UpdateDocumentRequest {
  title?: string
  description?: string
  folder_id?: string | null
}

export interface DeleteDocumentResponse {
  success: boolean
  error?: string
}

/**
 * GET /api/documents/[documentId]
 * Get single document details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
): Promise<NextResponse<DocumentResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { documentId } = await params

    const supabase = await createClerkSupabaseClient()

    const { data: document, error } = await supabase
      .from('document')
      .select('*')
      .eq('id', documentId)
      .eq('clerk_org_id', orgId)
      .single()

    if (error || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      document
    })

  } catch (error) {
    console.error('Get document API error:', error)
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
 * PATCH /api/documents/[documentId]
 * Update document (rename, change description, move to folder)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
): Promise<NextResponse<DocumentResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { documentId } = await params

    const supabase = await createClerkSupabaseClient()
    const body: UpdateDocumentRequest = await request.json()

    // Verify document exists and belongs to org
    const { data: existingDoc, error: fetchError } = await supabase
      .from('document')
      .select('*')
      .eq('id', documentId)
      .eq('clerk_org_id', orgId)
      .single()

    if (fetchError || !existingDoc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // If moving to a folder, verify folder exists and belongs to org
    if (body.folder_id !== undefined && body.folder_id !== null) {
      const { data: folder, error: folderError } = await supabase
        .from('folder')
        .select('id')
        .eq('id', body.folder_id)
        .eq('clerk_org_id', orgId)
        .single()

      if (folderError || !folder) {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        )
      }
    }

    // Build update object
    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.folder_id !== undefined) updateData.folder_id = body.folder_id

    // Update document
    const { data: updatedDoc, error: updateError } = await supabase
      .from('document')
      .update(updateData)
      .eq('id', documentId)
      .eq('clerk_org_id', orgId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating document:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: updatedDoc
    })

  } catch (error) {
    console.error('Update document API error:', error)
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
 * DELETE /api/documents/[documentId]
 * Delete document and its storage file
 *
 * This route delegates to the consolidated deleteDocuments() function
 * which calls the backend batch deletion endpoint to ensure full cascading
 * deletion including knowledge graph cleanup.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
): Promise<NextResponse<DeleteDocumentResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { documentId } = await params

    const { deleteDocuments } = await import('@/lib/document-deletion')

    const result = await deleteDocuments([documentId], orgId)

    if (!result.success) {
      console.error('Delete document failed:', result.error)
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Delete document API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
