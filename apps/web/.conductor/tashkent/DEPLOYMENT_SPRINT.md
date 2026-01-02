# Mentorfy MVP - Deployment Sprint Implementation Guide

## 🎯 Goal
Deploy production-ready platform today for Brady to build mentor bots for clients.

---

## 1. Processing Status Model Update

### Database Schema Change
```sql
-- Modify the processing_status enum to have these exact values:
ALTER TYPE processing_status RENAME TO processing_status_old;
CREATE TYPE processing_status AS ENUM ('pending_upload', 'uploaded', 'processing', 'available_to_ai', 'failed');

-- Update the document table
ALTER TABLE document 
  ALTER COLUMN processing_status TYPE processing_status 
  USING processing_status::text::processing_status;

DROP TYPE processing_status_old;
```

### Status Definitions
- **pending_upload**: File identified from Google Drive but not yet uploaded to Supabase storage
- **uploaded**: File in Supabase storage, waiting in queue for Graphiti processing
- **processing**: Currently being processed by Graphiti (includes embedding, chunking, knowledge graph)
- **available_to_ai**: Successfully processed and available for AI queries
- **failed**: Processing failed after all retries exhausted

### Frontend Display Mapping
```typescript
const statusConfig = {
  pending_upload: { label: "Pending Upload", color: "gray", icon: "clock" },
  uploaded: { label: "Queued", color: "blue", icon: "upload" },
  processing: { label: "Processing", color: "yellow", icon: "loader", animate: true },
  available_to_ai: { label: "Available to AI", color: "green", icon: "check-circle" },
  failed: { label: "Failed", color: "red", icon: "alert-circle" }
}
```

---

## 2. Model Behavior Implementation

### Backend System Prompt Template
Create file: `python/fastapi_server/system_prompt_template.py`
```python
SYSTEM_PROMPT_TEMPLATE = """
{purpose}

## Response Configuration
- Response Length: {response_length_instruction}
- Creativity Level: {creativity_instruction}

## Custom Instructions
{custom_instructions}

## Speaking Style
{speaking_style}
"""

RESPONSE_LENGTH_MAP = {
    "Intelligent": "Adapt your response length based on the complexity of the question",
    "Concise": "Keep responses brief and to the point (2-3 sentences)",
    "Explanatory": "Provide detailed explanations with examples",
    "Custom": "{custom_length_instruction}"
}

CREATIVITY_MAP = {
    "Strict": "Stick closely to the training data, minimal inference",
    "Adaptive": "Balance between training data and reasonable inferences",
    "Creative": "Feel free to make creative connections and inferences"
}
```

### Graphiti Search Configuration Mapping
```python
# In python/fastapi_server/graphiti_config.py
def get_graphiti_params(behavior_settings):
    """Map frontend settings to Graphiti search parameters"""
    
    # Response length affects search depth
    search_depth = {
        "Concise": 2,      # Shallow search
        "Intelligent": 3,  # Balanced
        "Explanatory": 5,  # Deep search
    }.get(behavior_settings.get("response_length"), 3)
    
    # Creativity affects similarity threshold
    similarity_threshold = {
        "Strict": 0.85,    # High similarity required
        "Adaptive": 0.75,  # Balanced
        "Creative": 0.65   # Lower threshold for broader results
    }.get(behavior_settings.get("creativity"), 0.75)
    
    return {
        "search_depth": search_depth,
        "similarity_threshold": similarity_threshold,
        "max_results": 10 if behavior_settings.get("response_length") == "Explanatory" else 5
    }
```

### Database Storage
```sql
-- The mentor_bot table already has these columns:
-- system_prompt (text) - Store the compiled prompt
-- response_length (enum) - Maps to frontend setting
-- creativity (enum) - Maps to frontend setting  
-- custom_instructions (text[]) - Array of instructions
-- speaking_style (text) - Style description
-- temperature (numeric) - Backend parameter (0.3-0.9 based on creativity)

-- Update the chat API to use these stored settings
```

### API Endpoint Updates
```python
# In app/api/chat/route.ts - fetch mentor_bot settings
# In python/fastapi_server/app.py - use settings for Graphiti search
```

---

## 3. Content Management UI - Folder Structure

### Data Model for Folder View
```typescript
interface FolderNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children?: FolderNode[]
  document?: Document  // Only for files
  fileCount?: number   // Only for folders
  isExpanded?: boolean
}

// Parse storage_path to build tree structure
function buildFolderTree(documents: Document[]): FolderNode {
  // Group by directory from storage_path
  // Example: "organizations/123/google_drive/folder1/file.pdf"
  // Creates: root > google_drive > folder1 > file.pdf
}
```

### UI Components
```tsx
// components/content-tree.tsx
<TreeView>
  <FolderItem 
    icon={isExpanded ? FolderOpen : Folder}
    label="Google Drive Files"
    fileCount={135}
    onToggle={() => toggleFolder(path)}
  >
    {children.map(child => ...)}
  </FolderItem>
</TreeView>
```

---

## 4. Upload Modal Flow Specification

### State Machine
```typescript
enum UploadState {
  IDLE = "idle",
  AUTHENTICATING = "authenticating", 
  SCANNING = "scanning",           // Identifying files in Drive
  PREPARING = "preparing",          // Creating pending_upload records
  COMPLETE = "complete"
}

interface UploadProgress {
  state: UploadState
  filesIdentified: number
  filesPrepared: number
  currentFile?: string
  error?: string
}
```

### UI Flow
1. **User enters folder URL and clicks "Import"**
   - Show spinner with text "Authenticating..."
   - If auth needed, redirect to Google OAuth

2. **After authentication**
   - Show "Scanning folder..." with spinner
   - API returns list of files found

3. **Show file count**
   - "Found 47 files to import"
   - Progress bar: 0/47 prepared

4. **Creating records**
   - Progress bar updates as files are marked pending_upload
   - Show current file being prepared

5. **Auto-close on completion**
   - When all files are pending_upload
   - Automatically close modal
   - Refresh content table to show new files

### Implementation
```tsx
// components/google-drive-import.tsx
const handleImport = async () => {
  setProgress({ state: 'authenticating', filesIdentified: 0, filesPrepared: 0 })
  
  // Step 1: Scan folder
  const scanResult = await fetch('/api/google-drive/scan', { 
    body: JSON.stringify({ folderId }) 
  })
  const files = await scanResult.json()
  
  setProgress({ 
    state: 'preparing', 
    filesIdentified: files.length, 
    filesPrepared: 0 
  })
  
  // Step 2: Create pending_upload records
  for (const file of files) {
    await createPendingUpload(file)
    setProgress(prev => ({ 
      ...prev, 
      filesPrepared: prev.filesPrepared + 1,
      currentFile: file.name 
    }))
  }
  
  // Step 3: Auto-close and refresh
  onImportComplete()
  setIsOpen(false)
  refreshDocuments()
}
```

---

## 5. Retry Mechanism - Complete Overhaul

### Current State (DISCOVERED)
- **THREE conflicting retry mechanisms**:
  1. RQ Retry object (3 attempts, 60s intervals)
  2. Worker with scheduler flag (doesn't actually retry failed jobs)
  3. Mystery recoveries (possibly container restarts)
- **No visibility** into retry status
- **Queue backlog issue**: With 147 docs and 3 workers, documents wait 1+ hours before processing

### NEW: Single Source of Truth Retry System

#### Database Schema Updates
```sql
-- Add retry tracking columns
ALTER TABLE document 
ADD COLUMN retry_count INTEGER DEFAULT 0,
ADD COLUMN next_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_error TEXT,
ADD COLUMN error_type TEXT CHECK (error_type IN ('rate_limit', 'network_error', 'processing_error', 'unknown_error'));

-- Add 'retrying' status
ALTER TYPE processing_status ADD VALUE 'retrying' AFTER 'processing';
```

#### Create Retry Manager
```python
# python/fastapi_server/retry_manager.py
class RetryManager:
    """Single source of truth for ALL retry logic"""
    
    retry_strategies = {
        'rate_limit': {
            'max_attempts': 5,
            'intervals': [60, 300, 900, 1800, 3600],  # 1m, 5m, 15m, 30m, 1h
        },
        'network_error': {
            'max_attempts': 5,
            'intervals': [30, 60, 120, 300, 600],  # 30s, 1m, 2m, 5m, 10m
        },
        'processing_error': {
            'max_attempts': 3,
            'intervals': [120, 600, 1800],  # 2m, 10m, 30m
        },
        'unknown_error': {
            'max_attempts': 3,
            'intervals': [300, 900, 1800],  # 5m, 15m, 30m
        }
    }
    
    def classify_error(self, exception: Exception) -> str:
        """Classify error to pick retry strategy"""
        error_msg = str(exception).lower()
        if 'rate limit' in error_msg or '429' in error_msg:
            return 'rate_limit'
        elif 'connection' in error_msg or 'timeout' in error_msg:
            return 'network_error'
        elif 'graphiti' in error_msg or 'neo4j' in error_msg:
            return 'processing_error'
        else:
            return 'unknown_error'
```

#### Remove Conflicting Mechanisms
```python
# In queues.py - REMOVE Retry object
job = q.enqueue(
    "workers.process_document_task",
    kwargs=document_data,
    # REMOVED: retry=Retry(max=3, interval=60)
    job_id=job_id
)

# In workers.py - DISABLE scheduler
worker.work(
    with_scheduler=False,  # No mysterious behavior
    logging_level="INFO"
)
```

#### Update Worker to Use Retry Manager
```python
# In workers.py
def process_document_task(**kwargs):
    document_id = kwargs.get('document_id')
    retry_count = kwargs.get('retry_count', 0)
    
    try:
        # ... processing logic ...
        update_document_status(document_id, 'ready')
        
    except Exception as e:
        error_type = retry_manager.classify_error(e)
        should_retry, delay = retry_manager.should_retry(error_type, retry_count)
        
        if should_retry:
            # AUTOMATIC RETRY for ALL error types
            next_retry = datetime.now() + timedelta(seconds=delay)
            
            update_document_status(document_id, 'retrying', {
                'retry_count': retry_count + 1,
                'next_retry_at': next_retry,
                'last_error': str(e),
                'error_type': error_type
            })
            
            # Schedule retry (ONLY retry mechanism)
            queue.enqueue_at(
                next_retry,
                process_document_task,
                kwargs={**kwargs, 'retry_count': retry_count + 1}
            )
        else:
            # Final failure after all automatic retries
            update_document_status(document_id, 'failed', {
                'final_failure': True,
                'last_error': str(e)
            })
```

### Frontend Updates for Retry Visibility
```typescript
// Update status config to include retrying
const statusConfig = {
  pending_upload: { label: "Pending Upload", color: "gray", icon: "clock" },
  uploaded: { label: "Queued", color: "blue", icon: "upload" },
  processing: { label: "Processing", color: "yellow", icon: "loader", animate: true },
  retrying: { label: "Retrying", color: "amber", icon: "refresh", animate: true },
  available_to_ai: { label: "Available to AI", color: "green", icon: "check-circle" },
  failed: { label: "Failed", color: "red", icon: "alert-circle" }
}

// Enhanced retry indicator component
function RetryIndicator({ document }) {
  if (document.status === 'retrying') {
    const minutesUntil = calculateMinutesUntil(document.next_retry_at)
    return (
      <div className="text-xs">
        <Badge variant="warning">
          Retry {document.retry_count}/{document.max_retries}
        </Badge>
        <div className="text-amber-500 mt-1">
          Next attempt in {minutesUntil}m
          {document.error_type === 'rate_limit' && ' (Rate limited)'}
        </div>
      </div>
    )
  }
  
  if (document.status === 'failed' && document.final_failure) {
    return (
      <div className="text-xs">
        <Badge variant="destructive">
          Failed after {document.retry_count} attempts
        </Badge>
        <Button 
          size="xs" 
          variant="outline" 
          onClick={() => manualRetry(document.id)}
          className="mt-1"
        >
          Retry Now
        </Button>
      </div>
    )
  }
  
  return null
}
```

### Key Benefits
- **ALL failures get automatic retries** (no babysitting needed)
- **Different strategies for different errors** (rate limits get longer delays)
- **Single retry mechanism** (no confusion about what's retrying what)
- **Full visibility** (see exactly when retry will happen)
- **Same document row** (no duplicates, just status updates)
- **Manual retry optional** (available but not required)

---

## 6. Chat Interface & Conversation Tracking

### Database Requirements
```sql
-- Conversations table already exists with proper structure
-- Need to ensure we're creating conversation records

-- When starting a new chat:
INSERT INTO conversation (user_id, mentor_bot_id, title)
VALUES ($1, $2, 'New Conversation ' || NOW()::date);

-- Messages are linked to conversation_id
INSERT INTO message (conversation_id, role, content, metadata)
VALUES ($1, $2, $3, $4);
```

### URL Routing Structure
```
/chat                    - New conversation (creates conversation ID)
/chat/[conversationId]   - Existing conversation
/admin/conversations     - List all conversations
/admin/conversations/[id] - View specific conversation
```

### Chat History Popover
```tsx
// components/chat-history-popover.tsx
function ChatHistoryPopover() {
  const conversations = useConversations()
  
  return (
    <Popover>
      <PopoverTrigger>
        <Button variant="ghost" size="icon">
          <History className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <h3>Recent Conversations</h3>
          {conversations.map(conv => (
            <Link href={`/chat/${conv.id}`} key={conv.id}>
              <div className="p-2 hover:bg-gray-800 rounded">
                <div className="text-sm">{conv.title}</div>
                <div className="text-xs text-gray-400">
                  {formatDate(conv.updated_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Conversations Admin Dashboard
```tsx
// app/admin/conversations/page.tsx
interface ConversationRow {
  id: string
  user_email: string
  mentor_bot_name: string
  message_count: number
  last_message: Date
  created_at: Date
}

// Table with columns:
// - User
// - Bot
// - Messages
// - Last Activity
// - Created
// - Actions (View)
```

---

## 7. Deployment Configuration

### Environment Variables
```bash
# .env.production
# Frontend (Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
NEXT_PUBLIC_API_URL=https://api.mentorfy.com  # FastAPI backend

# Backend (AWS EC2)
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_KEY=[service-key]  # Use service key for backend
OPENAI_API_KEY=[key]
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=[production-password]
REDIS_URL=redis://localhost:6379
WORKER_COUNT=3
MAX_RETRIES=3
LOG_LEVEL=INFO
```

### Docker Production Setup
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  fastapi:
    image: mentorfy/fastapi:latest
    ports:
      - "8000:8000"
    env_file: .env.production
    restart: always
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: always
    
  neo4j:
    image: neo4j:5
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
    volumes:
      - neo4j-data:/data
    restart: always
```

### Deployment Commands
```bash
# Frontend (Vercel)
vercel --prod

# Backend (AWS EC2)
# 1. SSH into EC2 instance
# 2. Clone repo
# 3. Set up .env.production
# 4. Run Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# 5. Initialize database
docker exec fastapi python scripts/init_neo4j_indexes.py
docker exec fastapi python scripts/init_graphiti_schema.py
```

---

## 8. Critical Fixes Before Deployment

### Fix the 2 Failed Documents
```python
# Quick script to retry the 2 failed documents
# python/scripts/retry_failed_docs.py
from rq import Queue
from datetime import datetime, timedelta

# Get failed documents
failed_docs = supabase.table("document")
  .select("*")
  .eq("processing_status", "failed")
  .execute()

for doc in failed_docs.data:
    # Enqueue with longer delay for rate limits
    queue.enqueue_in(
        timedelta(minutes=5),
        "workers.process_document_task",
        kwargs={
            'document_id': doc['id'],
            'retry_count': 0,  # Reset count
            # ... other fields
        }
    )
```

### Implement Duplicate Detection (Source ID Approach)

**Current State**: ZERO duplicate detection - every import creates new documents

**Phase 1 Implementation** (For this sprint):
```typescript
// In app/api/google-drive/import/route.ts
// Track statistics
let skippedFiles: string[] = []
let updatedFiles: string[] = []
let newFiles: string[] = []

// Before creating each document, check for existing
const existing = await supabase
  .from('document')
  .select('id, title, source_metadata')
  .eq('organization_id', organizationId)
  .eq('source_metadata->>google_drive_file_id', file.id)
  .single()

if (existing.data) {
  // Document already exists - check if it needs updating
  const existingModifiedTime = existing.data.source_metadata?.modified_time
  const newModifiedTime = file.modifiedTime
  
  if (newModifiedTime > existingModifiedTime) {
    // File has been updated in Google Drive
    await supabase
      .from('document')
      .update({
        source_metadata: {
          ...existing.data.source_metadata,
          modified_time: newModifiedTime,
          updated_at: new Date().toISOString()
        },
        processing_status: 'uploaded'  // Re-queue for processing
      })
      .eq('id', existing.data.id)
    
    updatedFiles.push(file.name)
    // Re-enqueue for processing with updated content
  } else {
    // File unchanged - skip
    skippedFiles.push(file.name)
    continue
  }
} else {
  // New file - create as normal
  newFiles.push(file.name)
  // ... existing create logic
}

// Return detailed summary
return NextResponse.json({
  success: true,
  summary: {
    total: files.length,
    new: newFiles.length,
    updated: updatedFiles.length,
    skipped: skippedFiles.length
  },
  details: {
    newFiles: newFiles.slice(0, 10),  // First 10 for UI display
    updatedFiles: updatedFiles.slice(0, 10),
    skippedFiles: skippedFiles.slice(0, 10)
  }
})
```

**UI Feedback**:
```tsx
// Show import results clearly
<div className="import-summary">
  <h3>Import Complete</h3>
  <p>✅ {summary.new} new files imported</p>
  <p>🔄 {summary.updated} files updated</p>
  <p>⏭️ {summary.skipped} unchanged files skipped</p>
</div>
```

**Future Enhancement** (NOT in this sprint):
- Content hash-based deduplication for true duplicate detection across sources
- Would catch same content from different sources (Google Drive vs Dropbox)
- Add after initial deployment when we support multiple import sources

### Reduce Worker Count for Rate Limit Prevention
```bash
# In .env.local and .env.production
WORKER_COUNT=2  # Reduce from 3 to prevent rate limit clustering
```

---

## 9. Implementation Order

### Phase 1: Backend Infrastructure (2 hours)
1. Update processing_status enum in database
2. Implement system prompt template and Graphiti config mapping
3. Update worker status reporting with retry info
4. Test retry mechanism with failed documents

### Phase 2: Frontend Foundation (2 hours)
1. Update status badges and retry indicators
2. Implement folder tree structure for content table
3. Fix upload modal flow with progress tracking
4. Connect behavior settings to database

### Phase 3: Chat & Tracking (2 hours)
1. Create conversation on new chat
2. Implement chat history popover
3. Build conversations admin dashboard
4. Add conversation routing

### Phase 4: Deployment (1 hour)
1. Build Docker images
2. Deploy backend to AWS EC2
3. Deploy frontend to Vercel
4. Test end-to-end flow

### Phase 5: Polish & Testing (1 hour)
1. Fix any UI issues discovered
2. Test full upload → process → chat flow
3. Verify Brady can access and use the system
4. Document any issues for future fixes

---

## Success Criteria
- [ ] Brady can log in from his machine
- [ ] He can upload a Google Drive folder
- [ ] Files show correct status through processing pipeline
- [ ] Failed files show retry information
- [ ] Chat interface uses uploaded content
- [ ] Behavior settings affect AI responses
- [ ] Admin can view all conversations
- [ ] System is stable and responsive

---

## Notes
- ~~Keep retry mechanism at 3 attempts with 60s intervals~~ **UPDATED: Use RetryManager with error-specific strategies**
- No real-time subscriptions - use polling if needed
- Focus on stability over features
- Document any tech debt for future sprints
- **NEW**: Single retry mechanism via scheduled jobs (no RQ Retry, no scheduler magic)
- **NEW**: All errors get automatic retries (Brady doesn't need to babysit)
- **NEW**: Duplicate detection prevents re-importing same Google Drive files