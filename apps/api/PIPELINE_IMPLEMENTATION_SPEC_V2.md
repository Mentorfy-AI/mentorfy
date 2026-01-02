# Pipeline Implementation Spec V2

## Executive Summary

**Goal**: Refactor document ingestion into independently-scalable queue-based phases for 100-1000x growth.

**Architecture**: 4 Redis queues, 4 specialized workers, 2-table state tracking

**Timeline**: 1-2 days implementation + testing

**Key Optimization**: Combined ingest+extract for external sources (majority case) eliminates redundant I/O

---

## Design Decisions

### Core Architecture
- **4 Redis queues**: `extraction`, `ingest_extract`, `chunking`, `kg_ingest`
- **4 phase workers**: extraction_worker.py, ingest_extract_worker.py, chunking_worker.py, kg_worker.py
- **2 processing paths**:
  - **Manual uploads** (minority): Skip ingestion → extraction → chunking → KG
  - **External sources** (majority): Combined ingest+extract → chunking → KG
- **Feature flag**: `USE_NEW_PIPELINE` env var for cutover
- **Coexistence**: Old and new flows work simultaneously during migration

### State Tracking
- **Two tables**: `pipeline_job` (one per document) + `pipeline_phase` (one per phase execution)
- **All metadata in JSONB**: No schema changes needed for new fields
- **Tracked metadata**: `source_name`, `source_platform`, `clerk_org_id` (passed as queue kwargs)

### File I/O Optimization
- **Manual uploads**: Frontend uploads directly to `raw_documents/` → extraction reads from Storage
- **External sources**: Download + extract in one worker (in-memory) → no intermediate raw storage by default
- **Optional raw storage**: Controlled by `store_raw` kwarg (for expensive re-processing like audio/video)

---

## Database Schema

### Tables

```sql
-- Overarching job (one per document)
CREATE TABLE pipeline_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document(id) ON DELETE CASCADE UNIQUE,

    -- Current state
    current_phase VARCHAR(50),  -- 'ingestion', 'extraction', 'chunking', 'kg_ingest', 'completed'
    status VARCHAR(50) NOT NULL,  -- 'processing', 'completed', 'failed'

    -- All metadata in JSONB (flexible, no migrations for new fields)
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Example metadata:
    -- {
    --   "source_name": "my_guide.pdf",
    --   "source_platform": "google_drive",
    --   "clerk_org_id": "org_456",
    --   "total_cost_usd": 0.51,
    --   "store_raw": false
    -- }

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase execution records (one per phase attempt)
CREATE TABLE pipeline_phase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_job_id UUID REFERENCES pipeline_job(id) ON DELETE CASCADE,

    phase VARCHAR(50) NOT NULL,  -- 'ingestion', 'extraction', 'chunking', 'kg_ingest'
    status VARCHAR(50) NOT NULL,  -- 'queued', 'processing', 'completed', 'failed', 'skipped'

    -- Input/output locations
    input_location TEXT,   -- Where input came from (gdrive URL, storage path, etc.)
    output_location TEXT,  -- Where output was stored (null for in-memory processing)

    -- Error handling
    error_message TEXT,
    error_type VARCHAR(50),
    retry_count INT DEFAULT 0,
    parent_phase_id UUID REFERENCES pipeline_phase(id),  -- For retry chains

    -- Phase-specific metadata (costs, durations, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timing
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_pipeline_job_document ON pipeline_job(document_id);
CREATE INDEX idx_pipeline_job_status ON pipeline_job(status);
CREATE INDEX idx_pipeline_phase_job ON pipeline_phase(pipeline_job_id);
CREATE INDEX idx_pipeline_phase_status ON pipeline_phase(phase, status);
CREATE INDEX idx_pipeline_phase_parent ON pipeline_phase(parent_phase_id);
CREATE INDEX idx_pipeline_job_metadata ON pipeline_job USING GIN (metadata);
```

### Phase Status Values

**pipeline_job.status:**
- `processing` - At least one phase is active
- `completed` - All phases done
- `failed` - All retries exhausted

**pipeline_phase.status:**
- `queued` - Waiting to be picked up (includes scheduled retries)
- `processing` - Worker is running
- `completed` - Success
- `failed` - Failed, may retry
- `skipped` - Phase bypassed (e.g., ingestion for manual uploads)

---

## Processing Flows

### Flow 1: Manual Upload (Minority Case)

```
User uploads file → Frontend
  ↓
Frontend uploads to Supabase Storage: raw_documents/{document_id}.mp4
  ↓
API creates pipeline_job + skipped ingestion phase
  ↓
Enqueue: extraction queue
  ↓
Extraction Worker:
  - Download from Storage (raw_documents/)
  - Transcribe/parse (based on file_type)
  - Store text: extracted_text/{document_id}.txt
  - Create extraction phase record
  - Enqueue: chunking queue
  ↓
Chunking Worker:
  - Download text from Storage
  - Chunk with contextual retrieval
  - Store chunks in document_chunk table
  - Create chunking phase record
  - Enqueue: kg_ingest queue
  ↓
KG Worker:
  - Load chunks from DB
  - Add to Graphiti/Neo4j
  - Create kg_ingest phase record
  - Mark pipeline_job as completed
```

**Pipeline phases created:**
1. `ingestion`: status="skipped", metadata={"reason": "manual_upload"}
2. `extraction`: status="completed", output_location="extracted_text/{id}.txt"
3. `chunking`: status="completed"
4. `kg_ingest`: status="completed"

---

### Flow 2: External Source (Majority Case)

```
API receives Google Drive URL
  ↓
API creates pipeline_job
  ↓
Enqueue: ingest_extract queue
  ↓
Ingest+Extract Worker (combined):
  - Create ingestion phase record (status="processing")
  - Download from Google Drive (in-memory)
  - Complete ingestion phase (no output_location)
  - Create extraction phase record (status="processing")
  - Extract text from file data (still in-memory)
  - Store text: extracted_text/{document_id}.txt
  - OPTIONAL: Store raw if store_raw=True kwarg
  - Complete extraction phase
  - Enqueue: chunking queue
  ↓
Chunking Worker:
  - (same as Flow 1)
  ↓
KG Worker:
  - (same as Flow 1)
```

**Pipeline phases created:**
1. `ingestion`: status="completed", output_location=null (in-memory)
2. `extraction`: status="completed", output_location="extracted_text/{id}.txt"
3. `chunking`: status="completed"
4. `kg_ingest`: status="completed"

**Key optimization**: File data stays in-memory between ingestion and extraction, eliminating upload→download cycle.

---

## Queue Infrastructure

### Queue Definitions

```python
# mentorfy/core/queues.py

QUEUE_EXTRACTION = "extraction"           # Manual uploads
QUEUE_INGEST_EXTRACT = "ingest_extract"   # External sources (combined phase)
QUEUE_CHUNKING = "chunking"               # All sources
QUEUE_KG_INGEST = "kg_ingest"             # All sources

def enqueue_extraction(pipeline_job_id, document_id, raw_location, **kwargs):
    """
    Queue extraction for manual uploads (file already in Storage).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        raw_location: Supabase Storage path (e.g., "raw_documents/123.mp4")
        **kwargs: source_name, source_platform, clerk_org_id, file_type
    """
    q = get_queue(QUEUE_EXTRACTION)
    return q.enqueue(
        "mentorfy.workers.extraction_worker.extract_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        raw_location=raw_location,
        **kwargs
    )

def enqueue_ingest_extract(pipeline_job_id, document_id, source_location, **kwargs):
    """
    Queue combined ingest+extract for external sources.

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        source_location: External URL (e.g., "gdrive://file_xyz", "youtube://video_123")
        **kwargs: source_name, source_platform, clerk_org_id, file_type, store_raw (default False)
    """
    q = get_queue(QUEUE_INGEST_EXTRACT)
    return q.enqueue(
        "mentorfy.workers.ingest_extract_worker.ingest_extract_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        source_location=source_location,
        **kwargs
    )

def enqueue_chunking(pipeline_job_id, document_id, text_location, **kwargs):
    """
    Queue chunking (all sources converge here).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        text_location: Supabase Storage path to extracted text
        **kwargs: source_name, source_platform, clerk_org_id
    """
    q = get_queue(QUEUE_CHUNKING)
    return q.enqueue(
        "mentorfy.workers.chunking_worker.chunk_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        text_location=text_location,
        **kwargs
    )

def enqueue_kg_ingest(pipeline_job_id, document_id, **kwargs):
    """
    Queue KG ingestion (all sources converge here).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        **kwargs: source_name, source_platform, clerk_org_id
    """
    q = get_queue(QUEUE_KG_INGEST)
    return q.enqueue(
        "mentorfy.workers.kg_worker.ingest_kg_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        **kwargs
    )
```

---

## Worker Pattern Template

### Standard Worker Pattern

```python
async def phase_task(pipeline_job_id, document_id, input_location, **kwargs):
    """
    Template for all workers (extraction, chunking, kg_ingest).

    Pattern:
    1. Create phase record (evidence first)
    2. Do work
    3. Update phase record (complete or failed)
    4. Update pipeline_job (summary second)
    5. Enqueue next phase (if applicable)
    """
    phase_id = None

    try:
        # 1. Create phase record
        phase = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "extraction",  # or "chunking", "kg_ingest"
            "status": "processing",
            "input_location": input_location,
            "started_at": now(),
        }).execute()
        phase_id = phase.data[0]["id"]

        # 2. Do work
        output = await do_phase_work(input_location)
        output_location = await store_output(document_id, output)

        # 3. Update phase (evidence first)
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": now(),
            "output_location": output_location,
            "metadata": {"cost_usd": 0.50, "duration_seconds": 12.5}
        }).eq("id", phase_id).execute()

        # 4. Update job (summary second)
        supabase.table("pipeline_job").update({
            "current_phase": "next_phase",
            "updated_at": now(),
        }).eq("id", pipeline_job_id).execute()

        # 5. Enqueue next phase
        enqueue_next_phase(pipeline_job_id, document_id, output_location, **kwargs)

    except Exception as e:
        # Update phase to failed
        if phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
                "error_type": type(e).__name__,
            }).eq("id", phase_id).execute()

        # Update job to failed
        supabase.table("pipeline_job").update({
            "status": "failed",
            "updated_at": now(),
        }).eq("id", pipeline_job_id).execute()

        raise
```

### Combined Ingest+Extract Worker Pattern

```python
async def ingest_extract_task(pipeline_job_id, document_id, source_location, file_type, store_raw=False, **kwargs):
    """
    Combined worker for external sources: download + extract in one pass.
    Creates separate phase records for both ingestion and extraction.
    """
    ingest_phase_id = None
    extract_phase_id = None

    try:
        # === INGESTION PHASE ===

        # 1. Create ingestion phase record
        ingest_phase = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "ingestion",
            "status": "processing",
            "input_location": source_location,
            "started_at": now(),
        }).execute()
        ingest_phase_id = ingest_phase.data[0]["id"]

        # 2. Download from external source (in-memory)
        if source_location.startswith("gdrive://"):
            file_data = await download_from_google_drive(source_location)
        elif source_location.startswith("youtube://"):
            file_data = await download_from_youtube(source_location)
        # Add more sources as needed

        # 3. Complete ingestion phase (no output_location - kept in-memory)
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": now(),
            "metadata": {"file_size_mb": len(file_data) / (1024 * 1024)}
        }).eq("id", ingest_phase_id).execute()

        # === EXTRACTION PHASE ===

        # 4. Create extraction phase record
        extract_phase = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "extraction",
            "status": "processing",
            "input_location": source_location,  # Original source
            "started_at": now(),
        }).execute()
        extract_phase_id = extract_phase.data[0]["id"]

        # 5. Extract text (file already in memory)
        text = await extract_text_from_file_data(file_data, file_type)

        # 6. Store extracted text
        text_location = f"extracted_text/{document_id}.txt"
        await supabase.storage.from_("documents").upload(text_location, text.encode())

        # 7. OPTIONAL: Store raw file (controlled by kwarg)
        if store_raw:
            raw_location = f"raw_documents/{document_id}.{get_extension(file_type)}"
            await supabase.storage.from_("documents").upload(raw_location, file_data)

        # 8. Complete extraction phase
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": now(),
            "output_location": text_location,
            "metadata": {
                "text_length": len(text),
                "raw_stored": store_raw
            }
        }).eq("id", extract_phase_id).execute()

        # 9. Update pipeline job
        supabase.table("pipeline_job").update({
            "current_phase": "chunking",
            "updated_at": now(),
        }).eq("id", pipeline_job_id).execute()

        # 10. Enqueue chunking
        enqueue_chunking(pipeline_job_id, document_id, text_location, **kwargs)

    except Exception as e:
        # Handle errors for both phases
        if ingest_phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", ingest_phase_id).execute()

        if extract_phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", extract_phase_id).execute()

        supabase.table("pipeline_job").update({
            "status": "failed",
        }).eq("id", pipeline_job_id).execute()

        raise
```

---

## API Integration

### Manual Upload Endpoint

```python
# app/api/documents/upload (NextJS/FastAPI)

async def upload_document(file, bot_id, user_id, clerk_org_id):
    """Handle manual file upload from frontend."""

    # 1. Upload directly to final raw location
    document_id = generate_uuid()
    raw_path = f"raw_documents/{document_id}.{get_extension(file.name)}"
    storage_url = await supabase.storage.from_("documents").upload(raw_path, file)

    # 2. Create document record
    doc = await supabase.table("document").insert({
        "id": document_id,
        "name": file.name,
        "file_type": get_file_type(file.name),
        "source_metadata": {
            "raw_location": storage_url,
            "source_platform": "manual_upload"
        }
    }).execute()

    # 3. Create pipeline job
    job = await supabase.table("pipeline_job").insert({
        "document_id": document_id,
        "current_phase": "extraction",
        "status": "processing",
        "started_at": now(),
        "metadata": {
            "source_name": file.name,
            "source_platform": "manual_upload",
            "clerk_org_id": clerk_org_id
        }
    }).execute()
    pipeline_job_id = job.data[0]["id"]

    # 4. Create skipped ingestion phase
    await supabase.table("pipeline_phase").insert({
        "pipeline_job_id": pipeline_job_id,
        "phase": "ingestion",
        "status": "skipped",
        "queued_at": now(),
        "completed_at": now(),
        "metadata": {"reason": "manual_upload"}
    }).execute()

    # 5. Enqueue extraction
    await enqueue_extraction(
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        raw_location=storage_url,
        source_name=file.name,
        source_platform="manual_upload",
        clerk_org_id=clerk_org_id,
        file_type=get_file_type(file.name)
    )

    return {"document_id": document_id, "pipeline_job_id": pipeline_job_id}
```

### Google Drive Import Endpoint

```python
# app/api/documents/import/google-drive

async def import_from_drive(drive_file_id, bot_id, clerk_org_id, store_raw=False):
    """Import document from Google Drive."""

    # 1. Get Drive file metadata
    drive_metadata = await google_drive_api.get_file(drive_file_id)

    # 2. Create document record
    document_id = generate_uuid()
    doc = await supabase.table("document").insert({
        "id": document_id,
        "name": drive_metadata["name"],
        "file_type": get_file_type(drive_metadata["mimeType"]),
        "source_metadata": {
            "drive_file_id": drive_file_id,
            "source_platform": "google_drive"
        }
    }).execute()

    # 3. Create pipeline job
    job = await supabase.table("pipeline_job").insert({
        "document_id": document_id,
        "current_phase": "ingestion",
        "status": "processing",
        "started_at": now(),
        "metadata": {
            "source_name": drive_metadata["name"],
            "source_platform": "google_drive",
            "clerk_org_id": clerk_org_id,
            "store_raw": store_raw
        }
    }).execute()
    pipeline_job_id = job.data[0]["id"]

    # 4. Enqueue combined ingest+extract
    await enqueue_ingest_extract(
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        source_location=f"gdrive://{drive_file_id}",
        source_name=drive_metadata["name"],
        source_platform="google_drive",
        clerk_org_id=clerk_org_id,
        file_type=get_file_type(drive_metadata["mimeType"]),
        store_raw=store_raw
    )

    return {"document_id": document_id, "pipeline_job_id": pipeline_job_id}
```

### Feature Flag Integration

```python
# mentorfy/workers/document_worker.py (existing entry point)

USE_NEW_PIPELINE = os.getenv("USE_NEW_PIPELINE", "false").lower() == "true"

async def process_document_task(document_id, **kwargs):
    """
    Existing worker entry point.
    Routes to new pipeline if flag is enabled.
    """
    if USE_NEW_PIPELINE:
        # Route to new pipeline based on source
        source_platform = kwargs.get("source_platform")

        if source_platform == "manual_upload":
            # File already in storage, go to extraction
            job = await create_pipeline_job(document_id, **kwargs)
            await create_skipped_ingestion_phase(job["id"])
            await enqueue_extraction(job["id"], document_id, kwargs["raw_location"], **kwargs)
        else:
            # External source, use combined ingest+extract
            job = await create_pipeline_job(document_id, **kwargs)
            await enqueue_ingest_extract(job["id"], document_id, kwargs["source_location"], **kwargs)
    else:
        # Old monolithic path
        result = asyncio.run(process_audio_video_document(...))
        return result
```

---

## Storage Helpers

```python
# mentorfy/utils/storage.py (new file)

async def store_extracted_text(document_id: str, text: str) -> str:
    """
    Store extracted text in Supabase Storage.

    Returns:
        Storage path (e.g., "extracted_text/123.txt")
    """
    path = f"extracted_text/{document_id}.txt"
    await supabase.storage.from_("documents").upload(path, text.encode("utf-8"))
    return path

async def load_extracted_text(text_location: str) -> str:
    """
    Load extracted text from Supabase Storage.

    Args:
        text_location: Path returned by store_extracted_text()

    Returns:
        Text content
    """
    data = await supabase.storage.from_("documents").download(text_location)
    return data.decode("utf-8")
```

---

## Worker Deployment

### Worker Scripts

```bash
# worker-extraction.sh
export USE_NEW_PIPELINE=true
uv run rq worker extraction --with-scheduler

# worker-ingest-extract.sh
export USE_NEW_PIPELINE=true
uv run rq worker ingest_extract --with-scheduler

# worker-chunking.sh
uv run rq worker chunking --with-scheduler

# worker-kg.sh
uv run rq worker kg_ingest --with-scheduler
```

### Deployment Strategy

**Phase 1 (Current): All workers on same machine**
```bash
# Start all 4 workers as separate processes
./worker-extraction.sh &
./worker-ingest-extract.sh &
./worker-chunking.sh &
./worker-kg.sh &
```

**Phase 2 (Soon): Separate containers**
```yaml
# docker-compose.yml
services:
  worker-extraction:
    build: .
    command: uv run rq worker extraction --with-scheduler

  worker-ingest-extract:
    build: .
    command: uv run rq worker ingest_extract --with-scheduler

  worker-chunking:
    build: .
    command: uv run rq worker chunking --with-scheduler

  worker-kg:
    build: .
    command: uv run rq worker kg_ingest --with-scheduler
```

---

## Implementation Timeline

### Step 1: Database Migration (10 min)
```bash
npx supabase migration new phased_pipeline_v2
# Add CREATE TABLE statements from schema section
npx supabase db push
```

### Step 2: Storage Helpers (15 min)
- Create `mentorfy/utils/storage.py`
- Implement `store_extracted_text()` and `load_extracted_text()`

### Step 3: Queue Infrastructure (30 min)
- Update `mentorfy/core/queues.py`
- Add 4 queue enqueue functions

### Step 4: Workers (4-5 hours)

**extraction_worker.py** (1 hour)
- Copy download + transcribe/extract logic from existing code
- Route by file_type: audio→Deepgram, PDF→PyPDF, etc.
- Store extracted text
- Create pipeline_phase record
- Enqueue chunking

**ingest_extract_worker.py** (1.5 hours)
- Download from external source (Drive, YouTube, etc.)
- Create ingestion phase record
- Extract text (in-memory)
- Create extraction phase record
- Store extracted text
- Optional: Store raw file if store_raw=True
- Enqueue chunking

**chunking_worker.py** (1 hour)
- Load text from storage
- Copy chunking logic from existing code
- Store chunks in DB
- Create pipeline_phase record
- Enqueue KG ingest

**kg_worker.py** (30 min)
- Copy from existing `DocumentImportService.ingest_phase`
- Load chunks from DB
- Add to Graphiti
- Create pipeline_phase record
- Mark pipeline_job as completed

### Step 5: API Integration (1 hour)
- Update upload endpoint to skip ingestion
- Update Drive import endpoint to use combined worker
- Add feature flag routing in existing worker

### Step 6: Testing (2-3 hours)
1. Start all 4 workers
2. Upload test file (manual upload path)
3. Import from Drive (external source path)
4. Verify phases complete in correct order
5. Test failure scenarios
6. Check database records

### Step 7: Deployment (30 min)
1. Set `USE_NEW_PIPELINE=true` in production
2. Deploy new worker scripts
3. Monitor for 1 hour
4. Verify queue processing

**Total: 8-10 hours (1-2 days)**

---

## Monitoring & Observability

### Key Queries

```sql
-- Current pipeline status
SELECT current_phase, status, COUNT(*)
FROM pipeline_job
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY current_phase, status;

-- Failed jobs
SELECT pj.document_id, pj.metadata->>'source_name', pp.phase, pp.error_message
FROM pipeline_job pj
JOIN pipeline_phase pp ON pp.pipeline_job_id = pj.id
WHERE pp.status = 'failed'
ORDER BY pp.queued_at DESC;

-- Average phase durations
SELECT phase,
       AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
FROM pipeline_phase
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '7 days'
GROUP BY phase;

-- Pipeline for specific document
SELECT pj.*,
       json_agg(pp.* ORDER BY pp.queued_at) as phases
FROM pipeline_job pj
LEFT JOIN pipeline_phase pp ON pp.pipeline_job_id = pj.id
WHERE pj.document_id = 'doc_123'
GROUP BY pj.id;
```

---

## Future Enhancements

1. **Automatic retries with backoff** (see RETRY_BACKOFF_SPEC.md)
2. **Admin dashboard** (see ADMIN_DASHBOARD_QUERIES.md)
3. **Cost tracking per org**
4. **SLA monitoring**
5. **Batch processing optimizations**
6. **Priority queues** (VIP users)

---

## Related Documents

- `ARCHITECTURE_ANALYSIS.md` - Original gap analysis
- `PHASED_PIPELINE_SPEC.md` - V1 spec (superseded by this doc)
- `RETRY_BACKOFF_SPEC.md` - Automatic retry implementation
- `ADMIN_DASHBOARD_QUERIES.md` - Monitoring queries
