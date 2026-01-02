# CLAUDE.md - Google Drive API Directory

This directory contains Google Drive integration endpoints for OAuth authentication and bulk document import functionality.

## Directory Structure

```
google-drive/
├── auth/                   # OAuth flow handler
│   └── route.ts           # (/api/google-drive/auth)
└── import/                # Bulk document import
    └── route.ts          # (/api/google-drive/import)
```

## Overview

The Google Drive integration enables users to:
- **Authenticate**: Secure OAuth2 flow for Google Drive access
- **Import Documents**: Bulk import of documents from Google Drive folders
- **Multi-format Support**: Handle various document types (PDF, DOC, DOCX, TXT, Google Docs)
- **Organization Scoping**: Isolate imports by organization for multi-tenant security

## Authentication Architecture

### OAuth 2.0 Flow Implementation
1. **Authorization Request**: User initiates authentication
2. **Google OAuth Redirect**: Redirect to Google authorization server
3. **Authorization Code**: Google returns authorization code
4. **Token Exchange**: Exchange code for access/refresh tokens
5. **Token Storage**: Store tokens with organization scope in database

### Security Features
- **Minimal Scopes**: Only requests `drive.readonly` access
- **Refresh Token Handling**: Automatic token refresh capability
- **Organization Isolation**: Tokens scoped to user + organization
- **Secure Storage**: Encrypted token storage in Supabase

## Document Import Pipeline

### Multi-Phase Import Process
1. **Authentication Validation**: Verify Google Drive access
2. **Folder Discovery**: Recursive folder traversal with loop protection
3. **File Filtering**: Support multiple document formats
4. **Duplicate Detection**: Prevent re-import of existing documents
5. **Batch Processing**: Process files in manageable batches
6. **Storage Management**: Upload to Supabase Storage
7. **Queue Integration**: Send to processing queue

### Supported File Types
- **PDF**: `application/pdf`
- **Microsoft Word**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
- **Legacy Word**: `application/msword` (DOC)
- **Plain Text**: `text/plain`
- **Google Docs**: `application/vnd.google-apps.document` (exported as DOCX)

## Performance and Scalability

### Batch Processing Strategy
- **Batch Size**: 5 files per batch for optimal performance
- **Parallel Processing**: Within-batch parallel processing
- **Progress Tracking**: Detailed batch completion reporting
- **Error Isolation**: Individual file failures don't break batch

### Resource Management
- **Memory Efficiency**: Streaming file downloads
- **Storage Optimization**: Unique path generation prevents conflicts
- **Database Efficiency**: Efficient duplicate detection queries
- **Processing Queue**: Offload heavy processing to background

### Error Recovery
- **Transactional Cleanup**: Remove storage if database operations fail
- **Graceful Degradation**: Continue processing despite individual failures
- **Comprehensive Logging**: Detailed error tracking for debugging
- **User Feedback**: Clear error messages and progress indicators

## Multi-Tenant Architecture

### Organization Scoping
- **Token Isolation**: Tokens stored per user + organization
- **Document Isolation**: All imported documents tagged with organization
- **Access Control**: Users only see documents from their organization
- **Storage Isolation**: Organization-based storage path structure

### Security Boundaries
- **Data Isolation**: Strict organization-based data access
- **Token Security**: No cross-organization token access
- **Storage Security**: Organization-based storage paths
- **Database Security**: Row-level security for organization filtering

## Integration Points

### External Services
- **Google Drive API**: Document access and file operations
- **Supabase Storage**: Document file storage
- **Supabase Database**: Metadata and relationship storage
- **FastAPI Backend**: Document processing queue

### Internal Services
- **Authentication**: Supabase user session management
- **Google Drive Auth Service**: Centralized OAuth management
- **Document Processing**: Python-based content extraction
- **Knowledge Graph**: Graphiti integration for processed content

## Error Handling Strategy

### Authentication Errors
- **Token Expiry**: Automatic refresh with fallback to re-authentication
- **Permission Errors**: Clear user guidance for re-authentication
- **Configuration Errors**: Detailed error messages for missing credentials
- **Service Unavailable**: Graceful degradation with retry suggestions

### Import Errors
- **Network Failures**: Retry logic with exponential backoff
- **File Access Errors**: Skip problematic files with detailed reporting
- **Storage Errors**: Transactional cleanup and user notification
- **Processing Errors**: Queue integration with retry mechanisms

### User Experience
- **Progress Indicators**: Real-time import progress feedback
- **Error Reporting**: Detailed error messages with actionable guidance
- **Success Metrics**: Clear reporting of successful vs failed imports
- **Recovery Options**: Ability to retry failed operations

## Data Flow Architecture

### Import Data Flow
1. **User Request**: POST /api/google-drive/import with folder ID
2. **Authentication**: Validate both Supabase and Google Drive access
3. **Discovery**: Recursive folder traversal to find all files
4. **Filtering**: Apply file type and size filters
5. **Duplicate Check**: Query database for existing documents
6. **Download**: Fetch files from Google Drive
7. **Upload**: Store files in Supabase Storage
8. **Database**: Create document records with metadata
9. **Queue**: Send to processing queue for content extraction

### Authentication Data Flow
1. **Initial Request**: GET /api/google-drive/auth (no code parameter)
2. **OAuth Redirect**: Redirect to Google authorization server
3. **User Consent**: User grants permissions on Google's site
4. **Callback**: GET /api/google-drive/auth?code=... (with authorization code)
5. **Token Exchange**: Exchange authorization code for tokens
6. **Token Storage**: Store tokens in database with organization scope
7. **Redirect**: Return user to application with success status

## Monitoring and Observability

### Performance Metrics
- **Import Speed**: Files processed per minute
- **Success Rates**: Percentage of successful imports
- **Error Rates**: Categorized error frequency
- **Processing Times**: End-to-end import duration

### Operational Metrics
- **Authentication Success**: OAuth flow completion rates
- **Token Refresh**: Automatic refresh success rates
- **Storage Usage**: Document storage consumption
- **Queue Performance**: Processing queue throughput

### Health Checks
- **Google Drive Connectivity**: API accessibility validation
- **Storage Health**: Supabase Storage availability
- **Database Health**: Query performance monitoring
- **Queue Health**: Processing queue status

## Future Enhancements

### Planned Features
- **Incremental Sync**: Detect and import only changed files
- **Selective Import**: User-controlled file selection interface
- **Import Scheduling**: Automated periodic imports
- **Advanced Filtering**: Content-based file filtering

### Performance Improvements
- **Streaming Upload**: Direct Google Drive to Supabase streaming
- **Parallel Batches**: Multiple simultaneous batch processing
- **Caching**: Cache folder structure for faster re-imports
- **Compression**: Optimize storage usage with file compression

### User Experience
- **Progress Dashboard**: Real-time import monitoring interface
- **Import History**: Track and manage previous imports
- **Error Recovery**: Retry failed imports with one-click
- **Preview Mode**: Preview import results before execution

### Security Enhancements
- **Scope Minimization**: Request only necessary Google Drive permissions
- **Token Rotation**: Implement token rotation policies
- **Audit Logging**: Comprehensive access and operation logging
- **Access Controls**: Role-based import permissions

This Google Drive integration provides comprehensive document import capabilities while maintaining security, performance, and multi-tenant isolation requirements.