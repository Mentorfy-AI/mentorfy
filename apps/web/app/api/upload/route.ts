import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';
import { v4 as uuidv4 } from 'uuid';

export interface UploadRequest {
  file: File;
  description?: string;
}

export interface UploadResponse {
  success: boolean;
  documentId?: string;
  message?: string;
  error?: string;
  estimatedProcessingTime?: number;
}

// Progress estimation algorithm from the plan
function estimateProcessingTime(fileSizeBytes: number): number {
  const fileSizeKB = fileSizeBytes / 1024;
  const BASE_UPLOAD_TIME = 1000; // 1 second base
  const UPLOAD_TIME_PER_KB = 50; // 50ms per KB
  const PROCESSING_TIME_PER_KB = 100; // 100ms per KB
  const GRAPHITI_BASE_TIME = 3000; // 3 seconds for Graphiti processing
  
  return BASE_UPLOAD_TIME + 
         (fileSizeKB * UPLOAD_TIME_PER_KB) + 
         (fileSizeKB * PROCESSING_TIME_PER_KB) + 
         GRAPHITI_BASE_TIME;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Check Clerk authentication
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'No active organization' },
        { status: 400 }
      );
    }

    const supabase = await createClerkSupabaseClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const folderId = formData.get('folderId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (text-based files)
    const supportedExtensions = ['.txt', '.vtt', '.srt'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    const isValidType = (file.type === 'text/plain' || file.type === 'text/vtt' ||
                         file.type === 'application/x-subrip' || file.type === 'text/srt') &&
                        supportedExtensions.includes(fileExtension);
    const isValidExtension = supportedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isValidType && !isValidExtension) {
      return NextResponse.json(
        { success: false, error: 'Only .txt, .vtt, and .srt files are supported' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Generate unique document ID and storage path
    const documentId = uuidv4();
    const storagePath = `organizations/${orgId}/documents/${documentId}${fileExtension}`;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        duplex: 'half'
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // If folderId is provided, verify folder exists and belongs to org
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from('folder')
        .select('id')
        .eq('id', folderId)
        .eq('clerk_org_id', orgId)
        .single();

      if (folderError || !folder) {
        console.error('Folder error:', folderError);
        return NextResponse.json(
          { success: false, error: 'Invalid folder selection' },
          { status: 404 }
        );
      }
    }

    console.log('[SECURITY] Document upload', {
      userId,
      orgId,
      folderId: folderId || 'root',
      action: 'upload_document',
      fileName: file.name,
      timestamp: new Date().toISOString()
    });

    // Create document record in database
    const { error: dbError } = await supabase
      .from('document')
      .insert({
        id: documentId,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        clerk_org_id: orgId,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        processing_status: 'uploaded',
        description: description || null,
        folder_id: folderId || null,
        source_metadata: {
          source: {
            uploaded_by: userId,
            uploaded_at: new Date().toISOString()
          },
          processing: {}
        }
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Clean up storage if database insertion failed
      await supabase.storage.from('documents').remove([storagePath]);
      return NextResponse.json(
        { success: false, error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Queue document for processing via FastAPI backend
    const queueResult = await queueDocumentProcessing({
      document_id: documentId,
      storage_path: storagePath,
      user_id: userId,
      organization_id: orgId,
      file_name: file.name,
      file_type: file.type,
    });

    const estimatedTime = estimateProcessingTime(file.size);

    // Return success even if queueing fails - document is uploaded
    return NextResponse.json({
      success: true,
      documentId,
      message: queueResult.success
        ? 'File uploaded successfully, processing started'
        : 'File uploaded successfully, processing queued with warnings',
      estimatedProcessingTime: estimatedTime,
      queue_warning: queueResult.success ? undefined : queueResult.error
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * Queue document for processing via FastAPI backend
 * Uses Redis/RQ queue system for scalable asynchronous processing
 */
async function queueDocumentProcessing(documentData: {
  document_id: string;
  storage_path: string;
  user_id: string;
  organization_id: string;
  file_name: string;
  file_type: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const fastApiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

    console.log('[Queue] Sending document to processing queue:', {
      document_id: documentData.document_id,
      file_name: documentData.file_name,
      fastApiUrl
    });

    const response = await fetch(`${fastApiUrl}/api/queue/process-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documents: [documentData]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Queue] Failed to queue document:', {
        status: response.status,
        error: errorText
      });
      return {
        success: false,
        error: `Queue request failed: ${response.status}`
      };
    }

    const result = await response.json();
    console.log('[Queue] Document queued successfully:', result);

    return { success: true };
  } catch (error) {
    console.error('[Queue] Error queueing document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown queue error'
    };
  }
}
