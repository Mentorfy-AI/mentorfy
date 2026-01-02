import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth-helpers'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

interface FolderDetails {
  id: string
  organization_id: string
  name: string
  description: string | null
  parent_folder_id: string | null
  created_at: string
  updated_at: string
  children?: FolderDetails[]
  documents?: Array<{
    id: string
    title: string
    file_type: string
    file_size: number
    processing_status: string
    created_at: string
  }>
}

export interface FolderResponse {
  success: boolean
  folder?: FolderDetails
  error?: string
}

export interface UpdateFolderRequest {
  name?: string
  description?: string
  parent_folder_id?: string
}

export interface DeleteFolderResponse {
  success: boolean
  deletedDocuments?: number
  folder?: { id: string; name: string }
  error?: string
}

/**
 * GET /api/folders/[folderId]
 * Get single folder with children and documents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
): Promise<NextResponse<FolderResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { folderId } = await params

    const supabase = await createClerkSupabaseClient()

    // Get folder (RLS enforces org filtering)
    const { data: folder, error: folderError } = await supabase
      .from('folder')
      .select('*')
      .eq('id', folderId)
      .single()

    if (folderError || !folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      )
    }

    // Get children folders (RLS enforces org filtering)
    const { data: children, error: childrenError } = await supabase
      .from('folder')
      .select('*')
      .eq('parent_folder_id', folderId)
      .order('name')

    if (childrenError) {
      console.error('Error fetching children folders:', childrenError)
    }

    // Get documents in folder (RLS enforces org filtering)
    const { data: documents, error: documentsError } = await supabase
      .from('document')
      .select('id, title, file_type, file_size, processing_status, created_at')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false })

    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
    }

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        children: children || [],
        documents: documents || []
      }
    })

  } catch (error) {
    console.error('Get folder API error:', error)
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
 * PATCH /api/folders/[folderId]
 * Update folder (rename, change description, move)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
): Promise<NextResponse<FolderResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { folderId } = await params

    const supabase = await createClerkSupabaseClient()
    const body: UpdateFolderRequest = await request.json()

    // Verify folder exists (RLS enforces org filtering)
    const { data: existingFolder, error: fetchError } = await supabase
      .from('folder')
      .select('*')
      .eq('id', folderId)
      .single()

    if (fetchError || !existingFolder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      )
    }

    // If moving folder, validate new parent
    if (body.parent_folder_id !== undefined) {
      // Prevent setting folder as its own parent
      if (body.parent_folder_id === folderId) {
        return NextResponse.json(
          { success: false, error: 'Cannot set folder as its own parent' },
          { status: 400 }
        )
      }

      // If parent_folder_id is not null, verify it exists and prevent circular references
      if (body.parent_folder_id) {
        const { data: newParent, error: parentError } = await supabase
          .from('folder')
          .select('id, parent_folder_id')
          .eq('id', body.parent_folder_id)
          .single()

        if (parentError || !newParent) {
          return NextResponse.json(
            { success: false, error: 'Parent folder not found' },
            { status: 404 }
          )
        }

        // Check for circular reference by traversing parent chain
        const isCircular = await checkCircularReference(
          supabase,
          folderId,
          body.parent_folder_id,
          orgId
        )

        if (isCircular) {
          return NextResponse.json(
            { success: false, error: 'Cannot create circular folder reference' },
            { status: 400 }
          )
        }
      }
    }

    // If renaming, check for duplicate name in target parent
    if (body.name && body.name.trim() !== existingFolder.name) {
      const targetParentId = body.parent_folder_id !== undefined
        ? body.parent_folder_id
        : existingFolder.parent_folder_id

      const { data: duplicate } = await supabase
        .from('folder')
        .select('id')
        .eq('name', body.name.trim())
        .eq('parent_folder_id', targetParentId || null)
        .neq('id', folderId)
        .single()

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'A folder with this name already exists in this location' },
          { status: 409 }
        )
      }
    }

    // Build update object
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.parent_folder_id !== undefined) updateData.parent_folder_id = body.parent_folder_id || null

    // Update folder (RLS enforces org filtering)
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folder')
      .update(updateData)
      .eq('id', folderId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating folder:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update folder' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      folder: updatedFolder
    })

  } catch (error) {
    console.error('Update folder API error:', error)
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
 * DELETE /api/folders/[folderId]
 * Delete folder and all documents inside it
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
): Promise<NextResponse<DeleteFolderResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()
    const { folderId } = await params

    const supabase = await createClerkSupabaseClient()

    // Verify folder exists (RLS enforces org filtering)
    const { data: folder, error: fetchError } = await supabase
      .from('folder')
      .select('id, name')
      .eq('id', folderId)
      .single()

    if (fetchError || !folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      )
    }

    // Check for child folders - still prevent deleting folders with subfolders
    const { data: children, error: childrenError } = await supabase
      .from('folder')
      .select('id')
      .eq('parent_folder_id', folderId)

    if (childrenError) {
      console.error('Error checking child folders:', childrenError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify folder contents' },
        { status: 500 }
      )
    }

    if (children && children.length > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete folder with ${children.length} subfolder(s). Please delete or move subfolders first.` },
        { status: 400 }
      )
    }

    // Get all documents in folder (RLS enforces org filtering)
    const { data: documents, error: documentsError } = await supabase
      .from('document')
      .select('id')
      .eq('folder_id', folderId)

    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch folder documents' },
        { status: 500 }
      )
    }

    const documentIds = documents?.map(doc => doc.id) || []
    const documentCount = documentIds.length

    // Delete all associated data for documents in this folder
    if (documentIds.length > 0) {
      // Delete document chunks
      const { error: chunksError } = await supabase
        .from('document_chunk')
        .delete()
        .in('document_id', documentIds)

      if (chunksError) {
        console.error('Error deleting document chunks:', chunksError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete document chunks' },
          { status: 500 }
        )
      }

      // Delete bot_document associations
      const { error: botDocsError } = await supabase
        .from('bot_document')
        .delete()
        .in('document_id', documentIds)

      if (botDocsError) {
        console.error('Error deleting bot_document associations:', botDocsError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete bot associations' },
          { status: 500 }
        )
      }

      // Delete processing jobs
      const { error: jobsError } = await supabase
        .from('processing_job')
        .delete()
        .in('document_id', documentIds)

      if (jobsError) {
        console.error('Error deleting processing jobs:', jobsError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete processing jobs' },
          { status: 500 }
        )
      }

      // Delete documents (RLS enforces org filtering)
      const { error: deleteDocsError } = await supabase
        .from('document')
        .delete()
        .eq('folder_id', folderId)

      if (deleteDocsError) {
        console.error('Error deleting documents:', deleteDocsError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete documents' },
          { status: 500 }
        )
      }
    }

    // Delete folder (RLS enforces org filtering)
    const { error: deleteError } = await supabase
      .from('folder')
      .delete()
      .eq('id', folderId)

    if (deleteError) {
      console.error('Error deleting folder:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete folder' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedDocuments: documentCount,
      folder: { id: folder.id, name: folder.name }
    })

  } catch (error) {
    console.error('Delete folder API error:', error)
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
 * Helper function to check for circular folder references
 * Traverses up the parent chain to see if folderId appears
 */
async function checkCircularReference(
  supabase: any,
  folderId: string,
  newParentId: string,
  orgId: string
): Promise<boolean> {
  let currentId: string | null = newParentId
  const visited = new Set<string>()

  while (currentId) {
    // Prevent infinite loop
    if (visited.has(currentId)) {
      return true
    }
    visited.add(currentId)

    // If we encounter the folder we're trying to move, it's circular
    if (currentId === folderId) {
      return true
    }

    // Get parent of current folder (RLS enforces org filtering)
    const { data: folder } = await supabase
      .from('folder')
      .select('parent_folder_id')
      .eq('id', currentId)
      .single()

    currentId = folder?.parent_folder_id || null
  }

  return false
}
