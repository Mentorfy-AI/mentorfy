import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireOrg } from '@/lib/auth-helpers'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export interface Folder {
  id: string
  clerk_org_id: string
  name: string
  description: string | null
  parent_folder_id: string | null
  created_at: string
  updated_at: string
  document_count?: number
}

export interface FolderListResponse {
  success: boolean
  folders?: Folder[]
  error?: string
}

export interface CreateFolderRequest {
  name: string
  description?: string
  parent_folder_id?: string
}

export interface CreateFolderResponse {
  success: boolean
  folder?: Folder
  error?: string
}

/**
 * GET /api/folders
 * List all folders for current organization
 * Returns flat list with document counts
 */
export async function GET(request: NextRequest): Promise<NextResponse<FolderListResponse>> {
  try {
    await requireAuth()

    const supabase = await createClerkSupabaseClient()

    // Get all folders for organization (RLS filters by org automatically)
    const { data: folders, error: foldersError } = await supabase
      .from('folder')
      .select('*')
      .order('name')

    if (foldersError) {
      console.error('Error fetching folders:', foldersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch folders' },
        { status: 500 }
      )
    }

    // Get document count for each folder (RLS filters by org automatically)
    const folderIds = folders.map(f => f.id)
    const { data: documentCounts, error: countsError } = await supabase
      .from('document')
      .select('folder_id')
      .in('folder_id', folderIds)

    if (countsError) {
      console.error('Error fetching document counts:', countsError)
    }

    // Count documents per folder
    const countMap = new Map<string, number>()
    documentCounts?.forEach(doc => {
      if (doc.folder_id) {
        countMap.set(doc.folder_id, (countMap.get(doc.folder_id) || 0) + 1)
      }
    })

    // Add document counts to folders
    const foldersWithCounts = folders.map(folder => ({
      ...folder,
      document_count: countMap.get(folder.id) || 0
    }))

    return NextResponse.json({
      success: true,
      folders: foldersWithCounts
    })

  } catch (error) {
    console.error('Folders API error:', error)
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
 * POST /api/folders
 * Create a new folder
 */
export async function POST(request: NextRequest): Promise<NextResponse<CreateFolderResponse>> {
  try {
    await requireAuth()
    const { orgId } = await requireOrg()

    const supabase = await createClerkSupabaseClient()
    const body: CreateFolderRequest = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // If parent folder is specified, verify it exists (RLS checks org automatically)
    if (body.parent_folder_id) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('folder')
        .select('id')
        .eq('id', body.parent_folder_id)
        .single()

      if (parentError || !parentFolder) {
        return NextResponse.json(
          { success: false, error: 'Parent folder not found' },
          { status: 404 }
        )
      }
    }

    // Check for duplicate name in same parent (RLS filters by org automatically)
    const { data: existingFolder } = await supabase
      .from('folder')
      .select('id')
      .eq('name', body.name.trim())
      .eq('parent_folder_id', body.parent_folder_id || null)
      .single()

    if (existingFolder) {
      return NextResponse.json(
        { success: false, error: 'A folder with this name already exists in this location' },
        { status: 409 }
      )
    }

    // Create folder with clerk_org_id from authenticated user
    const { data: folder, error: createError } = await supabase
      .from('folder')
      .insert({
        clerk_org_id: orgId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        parent_folder_id: body.parent_folder_id || null
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating folder:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create folder' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        document_count: 0
      }
    })

  } catch (error) {
    console.error('Create folder API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
