# Phased Pipeline Implementation Spec

## Design Decisions

### Architecture
- **4 Redis queues**: `documents` (entry) → `extraction` → `chunking` → `kg_ingest`
- **3 phase workers**: extraction_worker.py, chunking_worker.py, kg_worker.py
- **Feature flag**: `USE_NEW_PIPELINE` env var for cutover
- **Coexistence**: Old and new flows work simultaneously during migration

### Database Schema

**Two tables for observability:**

```sql
-- Overarching job (one per document)
CREATE TABLE pipeline_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document(id) ON DELETE CASCADE UNIQUE,
    current_phase VARCHAR(50),  -- 'extraction', 'chunking', 'kg_ingest', 'completed'
    status VARCHAR(50) NOT NULL,  -- 'processing', 'completed', 'failed'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase execution records (one per phase attempt)
CREATE TABLE pipeline_phase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_job_id UUID REFERENCES pipeline_job(id) ON DELETE CASCADE,
    phase VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,  -- 'queued', 'processing', 'completed', 'failed'
    input_location TEXT,
    output_location TEXT,
    error_message TEXT,
    error_type VARCHAR(50),
    retry_count INT DEFAULT 0,
    parent_phase_id UUID REFERENCES pipeline_phase(id),  -- For retry chains
    metadata JSONB DEFAULT '{}'::jsonb,
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

**Metadata stored in JSONB (no schema changes needed):**
```json
{
  "source_name": "my_guide.pdf",
  "source_platform": "google_drive",
  "clerk_org_id": "org_456",
  "total_cost_usd": 0.51
}
```

### Intermediate Storage
- Extracted text stored in Supabase Storage: `extracted_text/{document_id}.txt`
- Location passed between phases via queue kwargs

### Key Technical Decisions

1. **One row per phase execution** (not one evolving row)
2. **All metadata in JSONB** (flexible, no migrations for new fields)
3. **Atomicity**: Update phase first (evidence), then job (summary)
4. **Retry = new pipeline_phase row** with `parent_phase_id` link
5. **Phase workers are source_type agnostic** (audio/video/PDF all → text)

## Implementation Plan

### Step 1: Database Migration (5 min)
```bash
npx supabase migration new phased_pipeline
# Add CREATE TABLE statements above
npx supabase db push
```

### Step 2: Queue Infrastructure (30 min)
**File: `mentorfy/core/queues.py`**

Add:
```python
QUEUE_EXTRACTION = "extraction"
QUEUE_CHUNKING = "chunking"
QUEUE_KG_INGEST = "kg_ingest"

def enqueue_extraction(pipeline_job_id, document_id, source_location, **kwargs):
    """Queue Phase 1: Extraction"""

def enqueue_chunking(pipeline_job_id, document_id, text_location, **kwargs):
    """Queue Phase 2: Chunking"""

def enqueue_kg_ingest(pipeline_job_id, document_id, **kwargs):
    """Queue Phase 3: KG Ingest"""
```

### Step 3: Storage Helpers (15 min)
**File: `mentorfy/utils/storage.py` (new)**

```python
async def store_extracted_text(document_id: str, text: str) -> str:
    """Store text in Supabase Storage, return path"""

async def load_extracted_text(text_location: str) -> str:
    """Load text from Supabase Storage"""
```

### Step 4: Extract Workers (2-3 hours)

**File: `mentorfy/workers/extraction_worker.py` (new)**
- Copy download + transcribe/extract logic from `process_audio_video_document`
- Route by file_type: audio→Deepgram, PDF→PyPDF, etc.
- Store extracted text
- Create pipeline_phase record
- Enqueue chunking

**File: `mentorfy/workers/chunking_worker.py` (new)**
- Load text from storage
- Copy chunking logic
- Store chunks in DB
- Create pipeline_phase record
- Enqueue KG ingest

**File: `mentorfy/workers/kg_worker.py` (new)**
- Copy from `DocumentImportService.ingest_phase`
- Load chunks
- Add to Graphiti
- Create pipeline_phase record

### Step 5: Feature Flag Integration (30 min)
**File: `mentorfy/workers/document_worker.py`**

```python
USE_NEW_PIPELINE = os.getenv("USE_NEW_PIPELINE", "false").lower() == "true"

if USE_NEW_PIPELINE:
    # Create pipeline_job
    job = start_pipeline(document_id, source_name, source_platform, org_id)
    # Enqueue extraction
    enqueue_extraction(job["id"], document_id, source_location, ...)
else:
    # Old monolithic path
    result = asyncio.run(process_audio_video_document(...))
```

### Step 6: Worker Scripts (15 min)

```bash
# worker-extraction.sh
export USE_NEW_PIPELINE=true
uv run rq worker extraction --with-scheduler

# worker-chunking.sh
uv run rq worker chunking --with-scheduler

# worker-kg.sh
uv run rq worker kg_ingest --with-scheduler
```

### Step 7: Test & Deploy (2-3 hours)
1. Start all 3 workers
2. Upload test file with `USE_NEW_PIPELINE=true`
3. Verify phases complete
4. Test failure/retry
5. Set flag in production

## Worker Pattern Template

```python
async def phase_task(pipeline_job_id, document_id, input_location, **kwargs):
    phase_id = None
    try:
        # 1. Create phase record
        phase = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "extraction",  # or chunking, kg_ingest
            "status": "processing",
            "started_at": now(),
        }).execute()
        phase_id = phase.data[0]["id"]

        # 2. Do work
        output = await do_phase_work(input_location)
        output_location = await store_output(output)

        # 3. Update phase (evidence first)
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": now(),
            "output_location": output_location,
            "metadata": {"cost": 0.50}
        }).eq("id", phase_id).execute()

        # 4. Update job (summary second)
        supabase.table("pipeline_job").update({
            "current_phase": "next_phase",
            "updated_at": now(),
        }).eq("id", pipeline_job_id).execute()

        # 5. Enqueue next phase
        enqueue_next_phase(pipeline_job_id, document_id, output_location)

    except Exception as e:
        if phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", phase_id).execute()

        supabase.table("pipeline_job").update({
            "status": "failed",
        }).eq("id", pipeline_job_id).execute()

        raise
```

## Timeline
- Day 1: Steps 1-4 (core refactoring) - 4-6 hours
- Day 2: Steps 5-7 (integration & testing) - 3-4 hours
- **Total: 1-2 days**

## Future Enhancements
- Automatic retries with backoff (add to worker pattern)
- Admin dashboard queries
- Cost tracking per org/platform
- SLA monitoring
