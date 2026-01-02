# CLAUDE.md - Google Drive Bulk Import Endpoint

This directory contains the bulk document import functionality that enables users to import multiple documents from Google Drive folders into the Mentorfy platform.

## File Overview

### route.ts - Bulk Document Import Handler
**Route**: `/api/google-drive/import`
**Method**: `POST`
**Purpose**: Import multiple documents from Google Drive folders with comprehensive processing pipeline

#### Request/Response Interfaces

**Request Body**:
```typescript
{
  folderId: string  // Google Drive folder ID to import from
}
```

**Response Format**:
```typescript
{
  success: boolean
  summary: {
    total: number     // Total files discovered
    new: number      // New files imported
    updated: number  // Files updated (MVP: always 0)
    skipped: number  // Files skipped (duplicates)
  }
  documents: Array<{
    id: string
    title: string
    processing_status: string
  }>
  queue_info?: {
    jobs_created: number
    queue_stats: object
  }
  warning?: string    // Non-fatal issues
  queue_error?: string // Queue-specific errors
}
```

#### Processing Pipeline

**1. Authentication Validation (Lines 50-135)**
```typescript
// Validate Supabase user session
const { data: { user }, error: authError } = await supabase.auth.getUser()

// Get user's organization context
const { data: userOrg } = await supabase
  .from('user_organization')
  .select('organization_id')
  .eq('user_id', user.id)
  .single()

// Authenticate with Google Drive using centralized service
const googleDriveAuthService = createGoogleDriveAuth(user.id, userOrg.organization_id)
const authResult = await googleDriveAuthService.getAuthenticatedClient()
const drive = authResult.drive
```

**2. Folder Discovery (Lines 138-149)**
```typescript
const discoveryResult = await discoverFilesRecursively(drive, folderId)

if (discoveryResult.supportedFiles.length === 0) {
  return NextResponse.json({
    error: 'No supported files found in the folder. Supported formats: PDF, DOCX, DOC, TXT, Google Docs'
  }, { status: 400 })
}
```

**3. Batch Processing (Lines 164-261)**
```typescript
const BATCH_SIZE = 5
const documents: any[] = []
const skippedFiles: string[] = []
const newFiles: string[] = []

for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
  const batch = filesToProcess.slice(i, i + BATCH_SIZE)
  
  // Process batch in parallel for better performance
  const batchResults = await Promise.allSettled(
    batch.map(async (file) => {
      // Individual file processing logic
    })
  )
}
```

**4. Queue Integration (Lines 264-354)**
```typescript
if (documents.length > 0) {
  const queuePayload = {
    documents: documents.map((doc) => ({
      document_id: doc.id,
      google_drive_file_id: doc.googleDriveFileId,
      storage_path: doc.storage_path,
      user_id: user.id,
      organization_id: userOrg.organization_id,
      file_name: doc.title,
      file_type: doc.file_type,
    }))
  }
  
  const queueResponse = await fetch(`${fastApiUrl}/api/queue/process-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queuePayload)
  })
}
```

#### File Discovery and Filtering

**Recursive Folder Traversal** (Lines 382-458):
```typescript
async function discoverFilesRecursively(
  drive: any,
  folderId: string,
  processedFolders: Set<string> = new Set()
): Promise<DiscoveryResult>
```

**Features**:
- **Infinite Loop Protection**: Tracks processed folders to prevent cycles
- **Comprehensive Discovery**: Finds all files in folder hierarchy
- **Type Filtering**: Separates supported from unsupported files
- **Performance Optimization**: Single API call per folder level

**Supported MIME Types**:
```typescript
const supportedMimeTypes = new Set([
  'application/pdf',                                                    // PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword',                                                // DOC
  'text/plain',                                                        // TXT
  'application/vnd.google-apps.document',                             // Google Docs
])
```

**File Filtering Logic**:
- Separates files from folders during discovery
- Filters files by MIME type support
- Maintains lists of supported and skipped files
- Provides comprehensive statistics for user feedback

#### Duplicate Detection and Processing

**Duplicate Detection** (Lines 188-208):
```typescript
// Check for existing document with same Google Drive file ID
const { data: existingDoc, error: checkError } = await supabase
  .from('document')
  .select('id, title, source_metadata, processing_status')
  .eq('organization_id', userOrg.organization_id)
  .eq('source_metadata->>google_drive_file_id', file.id)
  .single()

if (existingDoc) {
  // Document already exists - skip for MVP
  skippedFiles.push(file.name)
  return null
}
```

**Processing Strategy**:
- **Skip Duplicates**: MVP approach skips existing files
- **Organization Scoped**: Duplicate detection per organization
- **Future Enhancement**: Support for update detection and re-import
- **Clear Reporting**: Detailed tracking of skipped vs new files

#### Document Record Creation

**Database Record Creation** (Lines 460-521):
```typescript
async function createDocumentRecord(
  supabase: any,
  organizationId: string,
  file: GoogleDriveFile
) {
  // Generate unique storage path using document ID
  const { data: document, error } = await supabase
    .from('document')
    .insert({
      organization_id: organizationId,
      title: fileName,
      description: 'Imported from Google Drive folder',
      source_type: 'google_drive',
      storage_path: '', // Updated after document ID generated
      file_type: getFileTypeFromMime(file.mimeType),
      file_size: file.size ? parseInt(file.size) : null,
      processing_status: 'uploaded',
      source_metadata: {
        google_drive_file_id: file.id,
        original_name: file.name,
        parents: file.parents,
        mime_type: file.mimeType,
      },
    })
    .select()
    .single()
    
  // Update with unique storage path
  const storagePath = `${organizationId}/${document.id}-${cleanFileName}`
  await supabase
    .from('document')
    .update({ storage_path: storagePath })
    .eq('id', document.id)
}
```

**Key Features**:
- **Unique Storage Paths**: Document ID + filename prevents conflicts
- **Rich Metadata**: Comprehensive Google Drive metadata storage
- **Organization Scoping**: All records tagged with organization
- **Processing Status**: Tracks document lifecycle status

#### File Download and Upload

**Google Drive Download** (Lines 556-662):
```typescript
async function downloadAndUploadFile(
  drive: any,
  file: GoogleDriveFile,
  storagePath: string,
  supabase: any
): Promise<void>
```

**Google Docs Export Handling** (Lines 569-603):
```typescript
if (file.mimeType === 'application/vnd.google-apps.document') {
  // Export Google Docs as DOCX
  const response = await drive.files.export({
    fileId: file.id,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  
  // Handle different response data types
  if (response.data && typeof response.data === 'object' && 'arrayBuffer' in response.data) {
    const arrayBuffer = await response.data.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  }
}
```

**Regular File Download** (Lines 604-637):
```typescript
else {
  const response = await drive.files.get({
    fileId: file.id,
    alt: 'media',
  })
  
  // Handle various response data types from Google Drive API
}
```

**Supabase Storage Upload** (Lines 644-657):
```typescript
const uploadResponse = await supabase.storage
  .from('documents')
  .upload(storagePath, fileBuffer, {
    contentType,
    upsert: true, // Allow overwriting if file exists
  })
```

#### Batch Processing Strategy

**Performance Optimization**:
- **Batch Size**: 5 files per batch for optimal performance
- **Parallel Processing**: Within-batch parallel file processing
- **Progress Tracking**: Detailed batch completion reporting
- **Error Isolation**: Individual file failures don't stop batch

**Resource Management**:
- **Memory Efficiency**: Process files in batches to control memory usage
- **Network Optimization**: Parallel downloads within batches
- **Database Efficiency**: Batch database operations where possible
- **Storage Management**: Efficient upload patterns

#### Queue Integration

**Processing Queue** (Lines 268-305):
```typescript
const queuePayload = {
  documents: documents.map((doc) => ({
    document_id: doc.id,
    google_drive_file_id: doc.googleDriveFileId,
    storage_path: doc.storage_path,
    user_id: user.id,
    organization_id: userOrg.organization_id,
    file_name: doc.title,
    file_type: doc.file_type,
  }))
}

const queueResponse = await fetch(`${fastApiUrl}/api/queue/process-documents`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(queuePayload)
})
```

**Benefits**:
- **Scalable Processing**: Offload heavy processing to background workers
- **Fault Tolerance**: Queue provides retry and error handling
- **Performance**: Non-blocking document processing
- **Monitoring**: Queue provides processing status and metrics

## Error Handling Strategy

### Authentication Errors
- **Google Drive Auth Errors**: Detailed error categorization with re-auth guidance
- **Supabase Session Errors**: Clear authentication requirements
- **Permission Errors**: User-friendly permission guidance

### Import Processing Errors
- **Network Failures**: Graceful handling of connectivity issues
- **File Access Errors**: Skip problematic files with detailed reporting
- **Storage Errors**: Transaction-safe cleanup on failures
- **Queue Errors**: Continue with success reporting plus warnings

### User Experience
- **Progress Reporting**: Real-time batch progress updates
- **Error Categorization**: Clear distinction between fatal and warning errors
- **Recovery Guidance**: Actionable steps for error resolution
- **Success Metrics**: Detailed reporting of import results

## Performance Characteristics

### Throughput Optimization
- **Parallel Batches**: Process multiple files simultaneously
- **Efficient Discovery**: Single API call per folder level
- **Stream Processing**: Direct Google Drive to Supabase streaming
- **Queue Offloading**: Background processing for heavy operations

### Resource Management
- **Memory Control**: Batch processing prevents memory overflow
- **Network Efficiency**: Parallel downloads with rate limiting respect
- **Database Optimization**: Efficient queries and bulk operations
- **Storage Optimization**: Direct upload without local file storage

### Scalability Patterns
- **Horizontal Scaling**: Stateless processing enables scaling
- **Queue Integration**: Background processing scales independently
- **Database Pooling**: Efficient connection management
- **Error Recovery**: Resilient processing with comprehensive error handling

## Security and Privacy

### Data Protection
- **Organization Isolation**: Strict organization-scoped access
- **Token Security**: Secure Google Drive token handling
- **Storage Security**: Encrypted file storage in Supabase
- **Metadata Protection**: Secure handling of Google Drive metadata

### Access Control
- **Authentication Required**: Valid user session for all operations
- **Organization Scoping**: Users only access their organization's data
- **Permission Validation**: Proper Google Drive permission checking
- **Audit Trail**: Comprehensive logging for security monitoring

### Privacy Compliance
- **Data Minimization**: Only import necessary file metadata
- **User Consent**: Clear user understanding of import scope
- **Retention Policies**: Consider data retention requirements
- **Access Logging**: Track all data access for compliance

## Future Enhancements

### Planned Features
- **Incremental Sync**: Detect and import only changed files
- **Selective Import**: User interface for file selection
- **Update Support**: Handle file updates and re-imports
- **Metadata Enrichment**: Extract additional file metadata

### Performance Improvements
- **Streaming Pipeline**: Direct Google Drive to processing pipeline
- **Caching**: Cache folder structures for faster re-imports
- **Compression**: Optimize storage with file compression
- **CDN Integration**: Distribute file access via CDN

### User Experience
- **Real-time Progress**: WebSocket-based progress updates
- **Import Preview**: Show import results before execution
- **Error Recovery**: One-click retry for failed imports
- **Import History**: Track and manage import operations

This bulk import endpoint provides comprehensive Google Drive integration with performance, security, and user experience optimizations for enterprise-scale document management.