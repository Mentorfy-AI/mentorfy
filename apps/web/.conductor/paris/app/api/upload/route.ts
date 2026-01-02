import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';
import { spawn } from 'child_process';
import path from 'path';
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
    const botId = formData.get('botId') as string;
    const folderId = formData.get('folderId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'No bot selected' },
        { status: 400 }
      );
    }

    // Validate file type (only .txt files for now)
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      return NextResponse.json(
        { success: false, error: 'Only .txt files are supported' },
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
    const fileExtension = '.txt';
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

    // Validate that the bot belongs to the user's organization
    const { data: mentorBot, error: botError } = await supabase
      .from('mentor_bot')
      .select('id')
      .eq('id', botId)
      .eq('clerk_org_id', orgId)
      .single();

    if (botError || !mentorBot) {
      console.log('[SECURITY] Access denied: User attempted to upload document to bot from different org', {
        userId,
        orgId,
        botId,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { success: false, error: 'Invalid bot selection' },
        { status: 404 }
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
        return NextResponse.json(
          { success: false, error: 'Invalid folder selection' },
          { status: 404 }
        );
      }
    }

    console.log('[SECURITY] Document upload', {
      userId,
      orgId,
      botId,
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

    // Create bot_document association
    const { error: botDocError } = await supabase
      .from('bot_document')
      .insert({
        mentor_bot_id: botId,
        document_id: documentId
      });

    if (botDocError) {
      console.error('Bot document association error:', botDocError);
      // Note: We don't fail the upload for this, but log it
    }

    // Trigger Graphiti processing asynchronously with a small delay to ensure DB commit
    setTimeout(() => {
      triggerGraphitiProcessing(documentId, storagePath, userId).catch(async (processingError) => {
        console.error('Failed to trigger Graphiti processing:', processingError);
        // Mark document as failed but don't fail the upload
        try {
          // Get existing document to preserve source metadata
          const { data: existingDoc } = await supabase
            .from('document')
            .select('source_metadata')
            .eq('id', documentId)
            .single();
          
          const existingMetadata = existingDoc?.source_metadata || { source: {}, processing: {} };
          
          await supabase
            .from('document')
            .update({ 
              processing_status: 'failed',
              source_metadata: {
                ...existingMetadata,
                processing: {
                  ...existingMetadata.processing,
                  error: processingError.message,
                  failed_at: new Date().toISOString()
                }
              }
            })
            .eq('id', documentId);
        } catch (updateError) {
          console.error('Failed to update document status:', updateError);
        }
      });
    }, 1000); // 1 second delay to ensure DB commit

    const estimatedTime = estimateProcessingTime(file.size);

    return NextResponse.json({
      success: true,
      documentId,
      message: 'File uploaded successfully, processing started',
      estimatedProcessingTime: estimatedTime
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

async function triggerGraphitiProcessing(documentId: string, storagePath: string, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonScriptPath = path.join(process.cwd(), 'python', 'scripts', 'document_processor.py');
    
    console.log('Starting Graphiti processing with:', {
      documentId,
      storagePath, 
      userId,
      scriptPath: pythonScriptPath
    });
    
    const child = spawn('/Users/elijah/Library/Caches/pypoetry/virtualenvs/data-4ODSHZ_S-py3.12/bin/python', [
      pythonScriptPath,
      'ingest',
      documentId,
      storagePath,
      userId
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(process.cwd(), 'python'),
      env: {
        ...process.env,
        PYTHONPATH: path.join(process.cwd(), 'python'),
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('Python stdout:', output);
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log('Python stderr:', output);
    });

    child.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      console.log('Final stdout:', stdout);
      console.log('Final stderr:', stderr);
      
      if (code === 0) {
        console.log('Graphiti processing completed successfully');
        resolve();
      } else {
        console.error('Graphiti processing failed with code:', code);
        reject(new Error(`Graphiti processing failed with code ${code}. Stderr: ${stderr}. Stdout: ${stdout}`));
      }
    });

    child.on('error', (error) => {
      console.error('Failed to spawn Graphiti processing:', error);
      reject(error);
    });

    // Add timeout to prevent hanging
    setTimeout(() => {
      if (!child.killed) {
        console.log('Terminating Python process due to timeout');
        child.kill();
        reject(new Error('Graphiti processing timed out after 60 seconds'));
      }
    }, 60000);
  });
}