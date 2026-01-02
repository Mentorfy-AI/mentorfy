import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import {
  createGoogleDriveAuth,
  GoogleDriveAuthError,
} from '@/lib/google-drive-auth';
import { Readable } from 'stream';
import { auth } from '@clerk/nextjs/server';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
}

interface DiscoveryResult {
  totalFiles: number;
  supportedFiles: GoogleDriveFile[];
  skippedFiles: GoogleDriveFile[];
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Check Clerk authentication
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    // Get Supabase user for database operations
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Supabase authentication failed' }, { status: 401 });
    }

    let folderId: string;
    let botId: string;
    try {
      console.log('📝 Parsing request body for Google Drive import');
      const body = await request.json();
      console.log('✅ Request body parsed:', {
        folderId: body.folderId,
        botId: body.botId,
      });
      folderId = body.folderId;
      botId = body.botId;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      console.error(
        '❌ Request content-type:',
        request.headers.get('content-type')
      );
      console.error('❌ Request method:', request.method);
      return NextResponse.json(
        {
          error:
            'Invalid JSON in request body. Please ensure the request contains valid JSON with a folderId field.',
        },
        { status: 400 }
      );
    }

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
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
      console.log('[SECURITY] Access denied: User attempted to import to bot from different org', {
        userId: user.id,
        organizationId: orgId,
        botId,
        action: 'google_drive_import',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Invalid bot selection' },
        { status: 404 }
      );
    }

    console.log('[SECURITY] Google Drive import started', {
      userId: user.id,
      organizationId: orgId,
      botId,
      folderId,
      action: 'google_drive_import',
      timestamp: new Date().toISOString()
    });

    // Get authenticated Google Drive client using centralized service
    let drive: any;

    try {
      const googleDriveAuthService = createGoogleDriveAuth(
        user.id,
        orgId
      );
      const authResult = await googleDriveAuthService.getAuthenticatedClient();
      drive = authResult.drive;
      console.log('✅ Google Drive authentication successful');
    } catch (error: any) {
      console.error('❌ Google Drive authentication error:', error);

      if (
        error instanceof GoogleDriveAuthError &&
        error.code === 'AUTHENTICATION_REQUIRED'
      ) {
        return NextResponse.json(
          {
            error: 'AUTHENTICATION_REQUIRED',
            message: error.message,
            authUrl: `${
              process.env.NEXTJS_URL || 'http://localhost:3000'
            }/api/google-drive/auth`,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: error.message || 'Google Drive authentication failed',
        },
        { status: 500 }
      );
    }

    // Discover all files in the folder recursively
    console.log(`🔍 Discovering files in Google Drive folder: ${folderId}`);
    const discoveryResult = await discoverFilesRecursively(drive, folderId);

    if (discoveryResult.supportedFiles.length === 0) {
      return NextResponse.json(
        {
          error:
            'No supported files found in the folder. Supported formats: PDF, DOCX, DOC, TXT, Google Docs',
        },
        { status: 400 }
      );
    }

    console.log(
      `📂 Found ${discoveryResult.totalFiles} total files, ${discoveryResult.supportedFiles.length} supported`
    );

    // Limit to 5 files for development
    // const DEV_FILE_LIMIT = 5
    // const filesToProcess = discoveryResult.supportedFiles.slice(0, DEV_FILE_LIMIT)
    const filesToProcess = discoveryResult.supportedFiles;

    // if (discoveryResult.supportedFiles.length > DEV_FILE_LIMIT) {
    //   console.log(`🚧 DEV MODE: Processing only first ${DEV_FILE_LIMIT} files out of ${discoveryResult.supportedFiles.length} supported files`)
    // }

    // Process files with duplicate detection
    const BATCH_SIZE = 5; // Process 5 files at a time
    const documents: any[] = [];
    const skippedFiles: string[] = [];
    const newFiles: string[] = [];

    console.log(
      `📦 Processing ${filesToProcess.length} files in batches of ${BATCH_SIZE}`
    );

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      console.log(
        `🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          filesToProcess.length / BATCH_SIZE
        )} (${batch.length} files)`
      );

      // Process batch in parallel for better performance
      const batchResults = await Promise.allSettled(
        batch.map(async (file) => {
          try {
            console.log(`🔄 Processing file: ${file.name}`);

            // Check for existing document with same Google Drive file ID
            const { data: existingDoc, error: checkError } = await supabase
              .from('document')
              .select('id, title, source_metadata, processing_status')
              .eq('clerk_org_id', orgId)
              .eq("source_metadata->'source'->>'google_drive_file_id'", file.id)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              // PGRST116 = no rows found
              console.error(
                `❌ Error checking for existing document: ${checkError.message}`
              );
              throw checkError;
            }

            if (existingDoc) {
              // Document already exists - skip for MVP
              console.log(`⏭️ Skipping existing file: ${file.name}`);
              skippedFiles.push(file.name);
              return null; // Skip this file
            } else {
              // New file - create as normal
              console.log(`📝 Creating new file: ${file.name}`);

              // Step 1: Create document record
              const document = await createDocumentRecord(
                supabase,
                orgId,
                file
              );
              console.log(`📄 Created document record: ${file.name}`);

              // Step 1.5: Create bot_document association
              const { error: botDocError } = await supabase
                .from('bot_document')
                .insert({
                  mentor_bot_id: botId,
                  document_id: document.id,
                });

              if (botDocError) {
                console.error(
                  '❌ Bot document association error:',
                  botDocError
                );
                // Note: We don't fail the import for this, but log it
              } else {
                console.log(`🤖 Associated document with bot: ${file.name}`);
              }

              // Step 2: Download from Google Drive and upload to Supabase storage
              await downloadAndUploadFile(
                drive,
                file,
                document.storage_path,
                supabase
              );
              console.log(`📤 Uploaded to storage: ${document.storage_path}`);

              // Step 3: Update document status to 'uploaded' (ready for processing)
              await supabase
                .from('document')
                .update({ processing_status: 'uploaded' })
                .eq('id', document.id);

              console.log(`✅ Successfully processed new file: ${file.name}`);
              newFiles.push(file.name);
              return document;
            }
          } catch (err) {
            console.error(`❌ Failed to process file ${file.name}:`, err);
            throw err;
          }
        })
      );

      // Add successful documents to the list (filter out nulls from skipped files)
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value !== null) {
          documents.push(result.value);
        } else if (result.status === 'rejected') {
          console.error(
            `❌ Batch processing failed for file: ${batch[index].name}`
          );
        }
      });

      console.log(
        `📊 Batch completed: ${documents.length} documents processed, ${skippedFiles.length} skipped, ${newFiles.length} new files`
      );
    }

    // Queue all documents for processing using the new queue system
    if (documents.length > 0) {
      try {
        console.log(`📥 Queueing ${documents.length} documents for processing`);

        const queuePayload = {
          documents: documents.map((doc) => ({
            document_id: doc.id,
            google_drive_file_id: doc.googleDriveFileId,
            storage_path: doc.storage_path,
            user_id: user.id,
            clerk_org_id: orgId,
            file_name: doc.title,
            file_type: doc.file_type,
          })),
        };

        const backendApiUrl =
          process.env.BACKEND_API_URL || 'http://localhost:8000';
        const queueResponse = await fetch(
          `${backendApiUrl}/api/queue/process-documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(queuePayload),
          }
        );

        if (!queueResponse.ok) {
          const errorText = await queueResponse.text();
          console.error('❌ Failed to queue documents:', errorText);
          throw new Error(
            `Queue API returned ${queueResponse.status}: ${errorText}`
          );
        }

        const queueResult = await queueResponse.json();
        console.log(
          `✅ Successfully queued ${documents.length} documents. Queue stats:`,
          queueResult.queue_stats
        );

        // Return success with queue information and detailed summary
        return NextResponse.json({
          success: true,
          summary: {
            total: filesToProcess.length,
            new: newFiles.length,
            updated: 0, // MVP doesn't support updates yet
            skipped: skippedFiles.length,
          },
          documents: documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            processing_status: doc.processing_status,
          })),
          queue_info: {
            jobs_created: queueResult.jobs?.length || 0,
            queue_stats: queueResult.queue_stats,
          },
        });
      } catch (queueError) {
        console.error(
          '❌ Error queueing documents for processing:',
          queueError
        );

        // Still return success for document creation, but note the queue issue
        return NextResponse.json({
          success: true,
          summary: {
            total: filesToProcess.length,
            new: newFiles.length,
            updated: 0, // MVP doesn't support updates yet
            skipped: skippedFiles.length,
          },
          documents: documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            processing_status: doc.processing_status,
          })),
          warning:
            'Documents created but failed to queue for processing. Processing may be delayed.',
          queue_error:
            queueError instanceof Error
              ? queueError.message
              : 'Unknown queue error',
        });
      }
    }

    // Return success with detailed summary (no new documents to queue)
    return NextResponse.json({
      success: true,
      summary: {
        total: filesToProcess.length,
        new: newFiles.length,
        updated: 0, // MVP doesn't support updates yet
        skipped: skippedFiles.length,
      },
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        processing_status: doc.processing_status,
      })),
    });
  } catch (error: any) {
    console.error('❌ Google Drive import error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to import from Google Drive',
      },
      { status: 500 }
    );
  }
}

async function discoverFilesRecursively(
  drive: any,
  folderId: string,
  processedFolders: Set<string> = new Set()
): Promise<DiscoveryResult> {
  // Prevent infinite loops
  if (processedFolders.has(folderId)) {
    return { totalFiles: 0, supportedFiles: [], skippedFiles: [] };
  }
  processedFolders.add(folderId);

  const supportedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/msword', // DOC
    'text/plain',
    'application/vnd.google-apps.document', // Google Docs
  ]);

  let allSupportedFiles: GoogleDriveFile[] = [];
  let allSkippedFiles: GoogleDriveFile[] = [];
  let totalCount = 0;

  try {
    // Get all items in this folder (both files and subfolders)
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, parents)',
      pageSize: 1000, // Maximum allowed by API
    });

    const items = response.data.files || [];
    totalCount += items.length;

    // Separate files and folders
    const files = items.filter(
      (item: GoogleDriveFile) =>
        item.mimeType !== 'application/vnd.google-apps.folder'
    );
    const folders = items.filter(
      (item: GoogleDriveFile) =>
        item.mimeType === 'application/vnd.google-apps.folder'
    );

    // Process files in current folder
    for (const file of files) {
      if (supportedMimeTypes.has(file.mimeType)) {
        allSupportedFiles.push(file);
      } else {
        allSkippedFiles.push(file);
      }
    }

    // Recursively process subfolders
    for (const folder of folders) {
      const subfolderResult = await discoverFilesRecursively(
        drive,
        folder.id,
        processedFolders
      );
      allSupportedFiles.push(...subfolderResult.supportedFiles);
      allSkippedFiles.push(...subfolderResult.skippedFiles);
      totalCount += subfolderResult.totalFiles;
    }
  } catch (error) {
    console.error(`❌ Error accessing folder ${folderId}:`, error);
    throw new Error(
      `Unable to access Google Drive folder. Please check permissions and folder ID.`
    );
  }

  return {
    totalFiles: totalCount,
    supportedFiles: allSupportedFiles,
    skippedFiles: allSkippedFiles,
  };
}

async function createDocumentRecord(
  supabase: any,
  organizationId: string,
  file: GoogleDriveFile
) {
  // Generate a unique storage path using document ID (to be generated)
  const fileExtension = getFileExtension(file.mimeType, file.name);
  const fileName = file.name.endsWith(fileExtension)
    ? file.name
    : `${file.name}${fileExtension}`;

  // First insert document record to get unique document ID
  const { data: document, error } = await supabase
    .from('document')
    .insert({
      clerk_org_id: organizationId,
      title: fileName,
      description: `Imported from Google Drive folder`,
      source_type: 'google_drive',
      storage_path: '', // Will be updated after we have the document ID
      file_type: getFileTypeFromMime(file.mimeType),
      file_size: file.size ? parseInt(file.size) : null,
      processing_status: 'uploaded',
      source_metadata: {
        source: {
          google_drive_file_id: file.id,
          original_name: file.name,
          parents: file.parents,
          mime_type: file.mimeType,
        },
        processing: {},
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document record: ${error.message}`);
  }

  // Now generate unique storage path using the document ID
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${organizationId}/${document.id}-${cleanFileName}`;

  // Update the document record with the unique storage path
  const { error: updateError } = await supabase
    .from('document')
    .update({ storage_path: storagePath })
    .eq('id', document.id);

  if (updateError) {
    throw new Error(
      `Failed to update document storage path: ${updateError.message}`
    );
  }

  // Update the document object with the storage path for return
  document.storage_path = storagePath;

  // Store document info for batch processing - no longer trigger individual processing
  return {
    ...document,
    googleDriveFileId: file.id, // Add for queue processing
  };
}

function getFileExtension(mimeType: string, fileName: string): string {
  // Check if file already has extension
  const existingExtension = path.extname(fileName);
  if (existingExtension) {
    return existingExtension;
  }

  // Map MIME types to extensions
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
    'application/vnd.google-apps.document': '.gdoc',
  };

  return mimeToExt[mimeType] || '';
}

function getFileTypeFromMime(mimeType: string): string {
  const mimeToType: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'application/vnd.google-apps.document': 'gdoc',
  };

  return mimeToType[mimeType] || 'unknown';
}

async function downloadAndUploadFile(
  drive: any,
  file: GoogleDriveFile,
  storagePath: string,
  supabase: any
): Promise<void> {
  /**
   * Download file from Google Drive and upload to Supabase storage
   */
  try {
    let fileBuffer: Buffer;
    let contentType: string;

    if (file.mimeType === 'application/vnd.google-apps.document') {
      // Export Google Docs as DOCX
      console.log(`📥 Exporting Google Doc: ${file.name}`);
      const response = await drive.files.export({
        fileId: file.id,
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Handle different response types from Google Drive API
      console.log(
        `Response data type: ${typeof response.data}, constructor: ${
          response.data?.constructor?.name
        }`
      );

      if (
        response.data &&
        typeof response.data === 'object' &&
        'arrayBuffer' in response.data
      ) {
        // It's a Blob-like object
        const arrayBuffer = await response.data.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else if (response.data instanceof ArrayBuffer) {
        fileBuffer = Buffer.from(response.data);
      } else if (typeof response.data === 'string') {
        fileBuffer = Buffer.from(response.data, 'binary');
      } else {
        // Fallback: try to convert to uint8array first
        const uint8Array = new Uint8Array(response.data);
        fileBuffer = Buffer.from(uint8Array);
      }
      contentType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      // Download regular files
      console.log(`📥 Downloading file: ${file.name}`);
      const response = await drive.files.get({
        fileId: file.id,
        alt: 'media',
      });

      // Handle different response types from Google Drive API
      console.log(
        `Response data type: ${typeof response.data}, constructor: ${
          response.data?.constructor?.name
        }`
      );

      if (
        response.data &&
        typeof response.data === 'object' &&
        'arrayBuffer' in response.data
      ) {
        // It's a Blob-like object
        const arrayBuffer = await response.data.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else if (response.data instanceof ArrayBuffer) {
        fileBuffer = Buffer.from(response.data);
      } else if (typeof response.data === 'string') {
        fileBuffer = Buffer.from(response.data, 'binary');
      } else {
        // Fallback: try to convert to uint8array first
        const uint8Array = new Uint8Array(response.data);
        fileBuffer = Buffer.from(uint8Array);
      }
      contentType = file.mimeType;
    }

    console.log(
      `📤 Uploading to storage: ${storagePath} (${fileBuffer.length} bytes)`
    );

    // Upload to Supabase storage
    const uploadResponse = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true, // Allow overwriting if file exists
      });

    if (uploadResponse.error) {
      throw new Error(
        `Supabase upload failed: ${uploadResponse.error.message}`
      );
    }

    console.log(`✅ Successfully uploaded: ${storagePath}`);
  } catch (error) {
    console.error(`❌ Error downloading/uploading ${file.name}:`, error);
    throw error;
  }
}

// Note: triggerDocumentProcessing function removed - now using queue system
