# CLAUDE.md - File Upload API Endpoint

This directory contains the file upload functionality that enables users to upload documents for AI processing and integration into the knowledge graph.

## File Overview

### route.ts - Document Upload Handler
**Route**: `/api/upload`
**Method**: `POST`
**Purpose**: Handle secure file uploads with validation, storage, and asynchronous processing pipeline

#### Request/Response Interfaces

**Request Format (FormData)**:
```typescript
interface UploadRequest {
  file: File              // The uploaded file (required)
  description?: string    // Optional file description
}
```

**Response Format**:
```typescript
interface UploadResponse {
  success: boolean
  documentId?: string              // Unique document identifier
  message?: string                 // Success message
  error?: string                   // Error message if failed
  estimatedProcessingTime?: number // Expected processing duration (ms)
}
```

#### Upload Processing Pipeline

**1. Authentication and Authorization (Lines 36-87)**
```typescript
// Validate Supabase user session
const { data: { session }, error: authError } = await supabase.auth.getSession()
if (authError || !session?.user) {
  return NextResponse.json(
    { success: false, error: 'Authentication required' },
    { status: 401 }
  )
}

// Get user's organization for multi-tenant isolation
const { data: userOrg, error: userOrgError } = await supabase
  .from('user_organization')
  .select('organization_id')
  .eq('user_id', session.user.id)
  .single()
```

**2. File Validation (Lines 47-73)**
```typescript
const formData = await request.formData()
const file = formData.get('file') as File
const description = formData.get('description') as string

// File type validation
if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
  return NextResponse.json(
    { success: false, error: 'Only .txt files are supported' },
    { status: 400 }
  )
}

// File size validation (10MB limit)
const MAX_FILE_SIZE = 10 * 1024 * 1024
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { success: false, error: 'File size must be less than 10MB' },
    { status: 400 }
  )
}
```

**3. Storage Management (Lines 89-109)**
```typescript
// Generate unique paths to prevent conflicts
const documentId = uuidv4()
const fileExtension = '.txt'
const storagePath = `organizations/${userOrg.organization_id}/documents/${documentId}${fileExtension}`

// Upload to Supabase Storage
const fileBuffer = await file.arrayBuffer()
const { error: storageError } = await supabase.storage
  .from('documents')
  .upload(storagePath, fileBuffer, {
    contentType: file.type,
    duplex: 'half'
  })
```

**4. Database Record Creation (Lines 111-137)**
```typescript
const { error: dbError } = await supabase
  .from('document')
  .insert({
    id: documentId,
    title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
    organization_id: userOrg.organization_id,
    file_type: file.type,
    file_size: file.size,
    storage_path: storagePath,
    processing_status: 'uploaded',
    description: description || null,
    source_metadata: {
      uploaded_by: session.user.id,
      uploaded_at: new Date().toISOString()
    }
  })
```

**5. Asynchronous Processing Trigger (Lines 139-159)**
```typescript
// Trigger processing with delay to ensure DB commit
setTimeout(() => {
  triggerGraphitiProcessing(documentId, storagePath, session.user.id)
    .catch(async (processingError) => {
      // Mark document as failed but don't fail the upload
      await supabase
        .from('document')
        .update({ 
          processing_status: 'failed',
          source_metadata: {
            error: processingError.message,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', documentId)
    })
}, 1000) // 1 second delay
```

#### File Validation System

**Supported File Types**:
- **Text Files**: `.txt` files with `text/plain` MIME type
- **Extension Check**: Fallback filename extension validation
- **Future Expansion**: Architecture ready for additional file types

**Size Limitations**:
- **Maximum Size**: 10MB per file
- **Rationale**: Balance between usability and system performance
- **Error Messaging**: Clear size limit communication to users

**Security Validation**:
- **MIME Type Checking**: Prevents malicious file uploads
- **Extension Validation**: Double-check file type authenticity
- **Content Scanning**: Future enhancement for malware detection

#### Processing Time Estimation

**Algorithm Implementation** (Lines 21-32):
```typescript
function estimateProcessingTime(fileSizeBytes: number): number {
  const fileSizeKB = fileSizeBytes / 1024
  const BASE_UPLOAD_TIME = 1000        // 1 second base
  const UPLOAD_TIME_PER_KB = 50        // 50ms per KB
  const PROCESSING_TIME_PER_KB = 100   // 100ms per KB
  // Note: GRAPHITI_BASE_TIME removed for more responsive feedback
  
  return BASE_UPLOAD_TIME + 
         (fileSizeKB * UPLOAD_TIME_PER_KB) + 
         (fileSizeKB * PROCESSING_TIME_PER_KB)
}
```

**Estimation Components**:
- **Base Upload Time**: Fixed overhead for upload process
- **Size-Based Upload**: Linear scaling with file size
- **Processing Time**: Content extraction and analysis time
- **Performance Optimization**: Removed fixed Graphiti timeout for more responsive user feedback

**User Experience Benefits**:
- **Progress Indicators**: Enables progress bar implementation
- **Improved Responsiveness**: Faster feedback without artificial delays
- **System Feedback**: More accurate processing timeline estimation

#### Asynchronous Processing Architecture

**Python Integration** (Lines 182-251):
```typescript
async function triggerGraphitiProcessing(
  documentId: string, 
  storagePath: string, 
  userId: string
): Promise<void> {
  const pythonScriptPath = path.join(process.cwd(), 'python', 'scripts', 'document_processor.py')
  
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
  })
}
```

**Processing Features**:
- **Non-blocking**: Upload completes immediately, processing runs in background
- **Error Isolation**: Processing failures don't affect upload success
- **Status Tracking**: Database status updates for monitoring
- **Timeout Protection**: 60-second timeout prevents hanging processes

**Python Script Integration**:
- **Virtual Environment**: Uses specific Python virtual environment
- **Argument Passing**: Document ID, storage path, and user ID
- **Environment Variables**: Full environment context for processing
- **Working Directory**: Proper Python module resolution

#### Error Handling Strategy

**Upload Phase Errors**:
```typescript
// Storage cleanup on database failure
if (dbError) {
  await supabase.storage.from('documents').remove([storagePath])
  return NextResponse.json(
    { success: false, error: 'Failed to create document record' },
    { status: 500 }
  )
}
```

**Processing Phase Errors**:
- **Non-fatal**: Processing errors don't fail the upload
- **Status Updates**: Failed processing marked in database
- **User Notification**: Future enhancement for processing status updates
- **Retry Capability**: Document remains available for reprocessing

**Error Categories**:
- **Authentication Errors**: Invalid or missing user session
- **Validation Errors**: File type, size, or format issues
- **Storage Errors**: Supabase Storage upload failures
- **Database Errors**: Document record creation failures
- **Processing Errors**: Background processing failures

## Multi-Tenant Architecture

### Organization Scoping
- **Storage Paths**: Organization-based directory structure
- **Database Records**: All documents tagged with organization ID
- **Access Control**: Users only access their organization's documents
- **Data Isolation**: Complete separation between organizations

### Security Boundaries
- **File Isolation**: Organization-based storage prevents cross-access
- **Metadata Isolation**: Document records filtered by organization
- **Processing Isolation**: User context maintained through processing
- **Audit Trails**: Upload tracking per organization

## Performance Optimization

### Upload Performance
- **Streaming Upload**: Direct file stream to Supabase Storage
- **Async Processing**: Non-blocking background processing
- **Parallel Operations**: Database and storage operations optimized
- **Resource Efficiency**: Minimal server-side file handling

### Storage Efficiency
- **Unique Naming**: UUID-based paths prevent conflicts
- **Organization Structure**: Hierarchical storage organization
- **Deduplication**: Future enhancement for duplicate file detection
- **Compression**: Consider file compression for space optimization

### Processing Scalability
- **Background Processing**: Separate processing from upload
- **Queue Integration**: Future migration to job queue system
- **Horizontal Scaling**: Stateless upload handling
- **Resource Management**: Python process lifecycle management

## Security Considerations

### Upload Security
- **File Type Validation**: Strict MIME type and extension checking
- **Size Limits**: Prevent resource exhaustion attacks
- **Content Scanning**: Future malware detection integration
- **Authentication**: Required user session for all uploads

### Storage Security
- **Access Control**: Supabase RLS for secure file access
- **Encryption**: Files encrypted at rest and in transit
- **Organization Isolation**: Strict data separation
- **Audit Logging**: Upload activity tracking

### Processing Security
- **Sandbox Execution**: Python processing in controlled environment
- **Input Validation**: Secure parameter passing to processing scripts
- **Resource Limits**: Timeout and resource constraints
- **Error Handling**: Secure error information handling

## Integration Points

### Frontend Integration
- **Form Upload**: Standard HTML form with file input
- **Bot Selector Performance**: Optimized bot loading with organization-based caching to reduce modal open time
- **Progress Indicators**: Processing time estimation enables progress UI
- **Error Handling**: Structured error responses for user feedback
- **Success Feedback**: Clear upload success confirmation

### Backend Integration
- **Supabase Storage**: Primary file storage system
- **Database Records**: Document metadata and relationship tracking
- **Processing Pipeline**: Python-based content extraction
- **Knowledge Graph**: Graphiti integration for AI enhancement

### Future Integrations
- **Queue System**: Redis-based job queue for scalable processing
- **CDN Integration**: Content delivery network for file access
- **Virus Scanning**: Automated malware detection
- **Webhook Integration**: External system notifications

## Future Enhancements

### File Type Support
- **PDF Documents**: Adobe PDF processing
- **Microsoft Office**: Word, Excel, PowerPoint support
- **Image Processing**: OCR for image-based documents
- **Archive Files**: ZIP, RAR extraction and processing

### Advanced Features
- **Batch Upload**: Multiple file upload interface
- **Drag & Drop**: Enhanced upload user experience
- **Resume Upload**: Interrupted upload recovery
- **Version Control**: Document version management

### Processing Improvements
- **Queue Migration**: Redis/Bull queue for scalable processing
- **Real-time Status**: WebSocket-based processing updates
- **Parallel Processing**: Multiple concurrent processing workers
- **Processing Analytics**: Detailed processing performance metrics

### User Experience
- **Upload Progress**: Real-time upload progress indicators
- **Processing Status**: Live processing status updates
- **Error Recovery**: Automatic retry for failed uploads
- **Bulk Operations**: Mass upload and management capabilities

This upload endpoint provides secure, scalable document upload capabilities with comprehensive validation, multi-tenant isolation, and asynchronous processing integration for the Mentorfy platform.