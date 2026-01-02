import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrg } from '@/lib/auth-helpers';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';

export interface BulkUpdateRequest {
  document_ids: string[];
  folder_id?: string | null;
}

export interface BulkUpdateResponse {
  success: boolean;
  updated_count?: number;
  error?: string;
}

export interface BulkDeleteRequest {
  document_ids: string[];
}

export interface BulkDeleteResponse {
  success: boolean;
  deleted_count?: number;
  error?: string;
}

/**
 * PATCH /api/documents/bulk
 * Bulk update documents (e.g., move to folder)
 */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<BulkUpdateResponse>> {
  try {
    await requireAuth();
    const { orgId } = await requireOrg();

    const supabase = await createClerkSupabaseClient();
    const body: BulkUpdateRequest = await request.json();

    // Validate input
    if (
      !body.document_ids ||
      !Array.isArray(body.document_ids) ||
      body.document_ids.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'No documents specified' },
        { status: 400 }
      );
    }

    // Limit bulk operations to prevent abuse
    if (body.document_ids.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot update more than 100 documents at once',
        },
        { status: 400 }
      );
    }

    // If moving to a folder, verify folder exists (RLS enforces org filtering)
    if (body.folder_id !== undefined && body.folder_id !== null) {
      const { data: folder, error: folderError } = await supabase
        .from('folder')
        .select('id')
        .eq('id', body.folder_id)
        .single();

      if (folderError || !folder) {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        );
      }
    }

    // Verify all documents exist (RLS enforces org filtering)
    const { data: existingDocs, error: fetchError } = await supabase
      .from('document')
      .select('id')
      .in('id', body.document_ids);

    if (fetchError) {
      console.error('Error fetching documents:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify documents' },
        { status: 500 }
      );
    }

    if (!existingDocs || existingDocs.length !== body.document_ids.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Some documents not found or do not belong to your organization',
        },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (body.folder_id !== undefined) {
      updateData.folder_id = body.folder_id;
    }

    // Perform bulk update (RLS enforces org filtering)
    const { data: updatedDocs, error: updateError } = await supabase
      .from('document')
      .update(updateData)
      .in('id', body.document_ids)
      .select('id');

    if (updateError) {
      console.error('Error updating documents:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated_count: updatedDocs?.length || 0,
    });
  } catch (error) {
    console.error('Bulk update API error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      },
      {
        status:
          error instanceof Error && error.message.includes('Unauthorized')
            ? 401
            : 500,
      }
    );
  }
}

/**
 * DELETE /api/documents/bulk
 * Bulk delete documents
 *
 * This route delegates to the consolidated deleteDocuments() function
 * which calls the backend batch deletion endpoint for efficient cascading deletion.
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<BulkDeleteResponse>> {
  try {
    await requireAuth();
    const { orgId } = await requireOrg();

    const body: BulkDeleteRequest = await request.json();

    // Validate input
    if (
      !body.document_ids ||
      !Array.isArray(body.document_ids) ||
      body.document_ids.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'No documents specified' },
        { status: 400 }
      );
    }

    // Limit bulk operations to prevent abuse
    if (body.document_ids.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete more than 100 documents at once',
        },
        { status: 400 }
      );
    }

    const { deleteDocuments } = await import('@/lib/document-deletion');

    const result = await deleteDocuments(body.document_ids, orgId);
    if (!result.success) {
      console.error('Failed to delete documents:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to delete documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: result.success,
      deleted_count: result.deleted_count || 0,
      ...(result.errors &&
        result.errors.length > 0 && { errors: result.errors }),
    });
  } catch (error) {
    console.error('Bulk delete API error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      },
      {
        status:
          error instanceof Error && error.message.includes('Unauthorized')
            ? 401
            : 500,
      }
    );
  }
}
