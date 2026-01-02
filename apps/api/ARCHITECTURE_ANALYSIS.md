# Data Ingestion Architecture: Current State vs. Target Requirements

## Executive Summary

**Current State:** Monolithic worker with synchronous phase execution
**Gap:** Missing async decoupling between phases for independent scalability
**Severity:** 🔴 High - Current architecture is tightly coupled and not ready for 100-1000x scale
**Recommendation:** Refactor to queue-based microservice-ready architecture

---

## Your Requirements (Deduced)

### Core Properties You're Asking For:

1. **Phase Independence** - Each processing phase can be deployed, scaled, and failed independently
2. **Async Boundaries** - Phases communicate only through persistent job queues (no synchronous calls)
3. **State Durability** - Job state survives crashes and can be inspected/resumed at any phase
4. **Backpressure Handling** - Slow phases don't block fast phases (queue buffers work)
5. **Observability** - Clear visibility into: current phase, failure point, retry status
6. **Microservice-Ready** - Each phase can be extracted into a separate service with minimal code changes

### Your Desired Architecture:

```
Frontend/API (Producer 1)
  ↓ [Job Queue: "raw_documents"]
Text Extraction Worker (Consumer 1 → Producer 2)
  ↓ [Job Queue: "extracted_text"]
Chunking Worker (Consumer 2 → Producer 3)
  ↓ [Job Queue: "chunked_documents"]
Knowledge Graph Worker (Consumer 3)
```

**Key insight:** Each arrow (`↓`) is a **job queue**, not a function call.

---

## Current Architecture Analysis

### What We Have Now

#### 1. Single Queue Entry Point ✅
```python
# mentorfy/core/queues.py
def enqueue_document(document_data: Dict[str, Any]) -> str:
    q = get_queue()  # Single "documents" queue
    job = q.enqueue(
        "mentorfy.workers.document_worker.process_document_task",
        kwargs=document_data
    )
```

**Status:** ✅ Good - Frontend creates a job and hands off to worker

#### 2. Worker Processing Flow 🔴

**Path A: Audio/Video**
```python
# mentorfy/workers/document_worker.py:383-414
if processing_mode == "direct_transcription":
    # SYNCHRONOUS EXECUTION (all in one worker)
    result = asyncio.run(
        process_audio_video_document(...)  # Downloads + Transcribes + Chunks + Stores
    )
```

**Path B: Standard Documents**
```python
# mentorfy/workers/document_worker.py:452-503
# PHASE 1: Import (synchronous)
import_result = asyncio.run(
    import_service.import_phase(...)  # Downloads + Extracts + Chunks + Stores
)

# PHASE 3: Ingest (commented out, but would be synchronous)
# ingest_result = asyncio.run(
#     import_service.ingest_phase(...)  # Loads chunks + Adds to Neo4j
# )
```

**Status:** 🔴 **CRITICAL ISSUE - Monolithic Execution**

The worker executes all phases **synchronously** in a single job:
1. Download → Extract → Chunk → Store (all or nothing)
2. No intermediate queues between phases
3. Failure at any step = entire job fails and must restart from beginning
4. Cannot scale phases independently

---

## Gap Analysis

### ❌ What's Missing

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| **Phase Independence** | All phases in one function | 🔴 Cannot deploy/scale phases separately |
| **Async Boundaries** | Direct function calls (`asyncio.run`) | 🔴 No queues between phases |
| **State Durability** | Document status field only | 🔴 No per-phase job records |
| **Backpressure** | N/A (no queues) | 🔴 Slow chunking blocks transcription |
| **Observability** | Document status + logs | 🟡 No phase-level job tracking |
| **Microservice-Ready** | Tightly coupled | 🔴 Phases share code and state |

### Specific Problems

#### Problem 1: All-or-Nothing Execution
```python
# Current: If chunking fails, must re-transcribe entire file
result = asyncio.run(
    process_audio_video_document(...)  # Download → Transcribe → Chunk
)
```

**Impact:**
- 10-minute transcription + chunking failure = waste $2 in Deepgram costs on retry
- No way to resume from "transcribed but not chunked" state

#### Problem 2: No Phase-Level Queues
```
Current:
┌──────────────────────────────────────┐
│  Single Worker Process               │
│  ┌────────────────────────────────┐  │
│  │ Download                       │  │
│  └───────────┬────────────────────┘  │
│              ↓ (function call)       │
│  ┌───────────────────────────────┐  │
│  │ Transcribe/Extract            │  │
│  └───────────┬───────────────────┘  │
│              ↓ (function call)       │
│  ┌───────────────────────────────┐  │
│  │ Chunk                         │  │
│  └───────────┬───────────────────┘  │
│              ↓ (function call)       │
│  ┌───────────────────────────────┐  │
│  │ Store                         │  │
│  └───────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Should be:**
```
Producer 1                     Producer 2                     Producer 3
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│ Download +   │              │ Transcribe/  │              │ Chunk +      │
│ Store Raw    │              │ Extract Text │              │ Store Chunks │
└──────┬───────┘              └──────┬───────┘              └──────┬───────┘
       │                             │                             │
       ↓ enqueue                     ↓ enqueue                     ↓ enqueue
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ Queue:          │           │ Queue:          │           │ Queue:          │
│ raw_documents   │           │ extracted_text  │           │ chunked_docs    │
└─────────────────┘           └─────────────────┘           └─────────────────┘
       ↓ dequeue                     ↓ dequeue                     ↓ dequeue
Consumer 1                    Consumer 2                    Consumer 3
```

#### Problem 3: Cannot Scale Phases Independently

Current reality:
- Transcription: 10 sec/file, CPU-light, expensive API ($0.0043/min)
- Chunking: 2 sec/file, CPU-light, cheap API ($0.001/request)
- KG Ingest: 30 sec/file, CPU-heavy, local Neo4j

**What happens at 100x scale?**
- You'd need to scale the entire worker (all phases together)
- Can't run 10 transcription workers + 2 chunking workers + 50 KG workers
- Chunking starves waiting for slow KG ingest
- Expensive transcription workers sit idle waiting for chunking

#### Problem 4: Failure Recovery is Expensive

**Scenario:** You've transcribed 1000 videos (cost: $72), now you deploy a code change that breaks chunking.

**Current system:**
- All 1000 jobs fail at chunking
- Retry = re-transcribe all 1000 videos
- Cost: $72 again (wasted money)

**Proper system:**
- 1000 jobs succeed at transcription phase
- 1000 transcripts sit in `extracted_text` queue
- Deploy chunking fix
- Retry only chunking (already have transcripts)
- Cost: $0 wasted

---

## Current State Assessment

### ✅ What's Good

1. **Phases are conceptually separated** - You have `import_phase`, `ingest_phase`, `process_audio_video_document`
2. **Document status tracking** - You track state in `document.processing_status`
3. **Error handling** - You have retry logic via `schedule_retry()`
4. **Logging** - Good observability through structured logs

### 🔴 What Needs Immediate Refactoring

1. **Remove synchronous phase chaining** - Each phase should enqueue the next, not call it
2. **Create intermediate queues** - One queue per phase transition
3. **Extract phase-specific workers** - Separate worker files for each phase
4. **Add phase-level job records** - Track state beyond just document status

---

## Proposed Architecture (Microservice-Ready, Single Service for Now)

### Phase 1: Extract Workers into Separate Functions

```
Current:
mentorfy/workers/document_worker.py
  ├─ process_document_task()  # Routes to audio or standard
  ├─ process_audio_video_document()  # Does download + transcribe + chunk
  └─ DocumentImportService.import_phase()  # Does download + extract + chunk

Proposed:
mentorfy/workers/
  ├─ ingestion_worker.py        # Phase 1: Download + Store Raw
  ├─ extraction_worker.py       # Phase 2: Extract Text (transcribe/parse)
  ├─ chunking_worker.py         # Phase 3: Create Chunks
  └─ knowledge_graph_worker.py  # Phase 4: Add to Neo4j
```

### Phase 2: Create Queue Infrastructure

```python
# mentorfy/core/queues.py (REFACTORED)

# Phase queues
QUEUE_RAW_DOCUMENTS = "raw_documents"        # Phase 1 input
QUEUE_EXTRACTED_TEXT = "extracted_text"      # Phase 2 input
QUEUE_CHUNKED_DOCUMENTS = "chunked_docs"     # Phase 3 input
QUEUE_KNOWLEDGE_GRAPH = "kg_ingest"          # Phase 4 input

def enqueue_raw_document(doc_id, source_info):
    """Frontend/API calls this"""
    q = get_queue(QUEUE_RAW_DOCUMENTS)
    return q.enqueue("mentorfy.workers.ingestion_worker.ingest_task", ...)

def enqueue_extracted_text(doc_id, text_location):
    """Extraction worker calls this after transcribing"""
    q = get_queue(QUEUE_EXTRACTED_TEXT)
    return q.enqueue("mentorfy.workers.chunking_worker.chunk_task", ...)

def enqueue_chunked_document(doc_id, chunk_ids):
    """Chunking worker calls this after creating chunks"""
    q = get_queue(QUEUE_KNOWLEDGE_GRAPH)
    return q.enqueue("mentorfy.workers.knowledge_graph_worker.ingest_kg_task", ...)
```

### Phase 3: Refactor Workers to Producer/Consumer Pattern

```python
# mentorfy/workers/extraction_worker.py (PHASE 2 WORKER)

async def extract_text_task(document_id: str, **kwargs):
    """
    Consumer for QUEUE_RAW_DOCUMENTS
    Producer for QUEUE_EXTRACTED_TEXT
    """
    try:
        # 1. Get document metadata (where is raw file?)
        doc = get_document(document_id)
        source_location = doc.source_metadata["location"]

        # 2. Download raw file
        raw_file = await download_from_source(source_location)

        # 3. Extract text (transcribe audio OR parse PDF)
        if doc.file_type in ["mp3", "mp4", "mov"]:
            text = await transcribe_audio(raw_file)
        else:
            text = await extract_pdf_text(raw_file)

        # 4. Store extracted text (S3, Supabase storage, wherever)
        text_location = await store_extracted_text(document_id, text)

        # 5. Update document status
        update_document_status(document_id, "text_extracted")

        # 6. ✨ ENQUEUE NEXT PHASE (not call directly!)
        enqueue_extracted_text(document_id, text_location)

        return {"status": "success", "text_length": len(text)}

    except Exception as e:
        # Failure here doesn't affect phases before or after
        update_document_status(document_id, "extraction_failed")
        raise
```

**Key differences from current code:**
- ✅ Does ONE thing only (extract text)
- ✅ Enqueues next phase instead of calling it
- ✅ Stores intermediate result (extracted text)
- ✅ Can be scaled independently (10 extraction workers, 2 chunking workers)

### Phase 4: State Management

```sql
-- New table: processing_jobs (tracks phase-level state)
CREATE TABLE processing_job (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES document(id),
    phase VARCHAR(50) NOT NULL,  -- 'ingestion', 'extraction', 'chunking', 'kg_ingest'
    status VARCHAR(50) NOT NULL,  -- 'pending', 'processing', 'completed', 'failed'
    input_location TEXT,  -- Where to find input (S3 URL, file path, etc.)
    output_location TEXT,  -- Where output was stored
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB  -- Phase-specific data (cost, duration, etc.)
);

CREATE INDEX idx_processing_job_document_phase ON processing_job(document_id, phase);
CREATE INDEX idx_processing_job_status ON processing_job(status);
```

**Benefits:**
- Can query "show me all documents stuck at chunking phase"
- Can retry a specific phase without touching others
- Can see exactly where each document is in the pipeline
- Can calculate per-phase costs and latencies

---

## Migration Path (Pragmatic Approach)

### Option A: Big Bang Refactor (High Risk, Fast Payoff)

**Timeline:** 2-3 weeks
**Risk:** High (might break existing ingestion)
**When:** If you have time and no urgent launches

1. Week 1: Create new queue infrastructure + worker files
2. Week 2: Refactor workers to producer/consumer pattern
3. Week 3: Test, fix bugs, migrate existing jobs

### Option B: Strangler Fig Pattern (Low Risk, Gradual Migration) ✅ RECOMMENDED

**Timeline:** 4-6 weeks, but can ship incrementally
**Risk:** Low (old system stays working)
**When:** Production system that can't have downtime

**Phase 1 (Week 1-2): Add Extraction Queue**
```python
# Keep existing worker, but add queue after extraction
async def process_audio_video_document(...):
    # 1-2. Download + Transcribe (existing code)
    transcript = await transcribe(...)

    # NEW: Store transcript and enqueue chunking
    transcript_location = await store_transcript(document_id, transcript)
    enqueue_extracted_text(document_id, transcript_location)
    # Don't chunk here anymore!
```

**Phase 2 (Week 3-4): Create Chunking Worker**
```python
# New worker that consumes extraction queue
async def chunk_text_task(document_id, text_location):
    text = await load_transcript(text_location)
    chunks = await chunk_document(text)
    await store_chunks(document_id, chunks)
    enqueue_chunked_document(document_id)
```

**Phase 3 (Week 5-6): Create KG Worker**
```python
# New worker that consumes chunking queue
async def ingest_kg_task(document_id):
    chunks = await load_chunks(document_id)
    await add_to_neo4j(chunks)
```

**Result:** After 6 weeks, you have 3 independent workers but never broke existing system

### Option C: Hybrid Approach (My Recommendation for You)

Given your goals (100-1000x scale) and timeline (need to move fast):

1. **Immediate (This Sprint):** Add queue between extraction and chunking
   - Biggest pain point: expensive transcription + unreliable chunking
   - Easy win: Save $$$ on retry

2. **Next Sprint:** Extract chunking into separate worker
   - Now you can scale chunking independently
   - Transcription workers don't wait for chunking

3. **Month 2:** Add KG worker queue
   - Slowest phase (30s/doc) now doesn't block fast phases

4. **Month 3:** Extract to microservices (if needed)
   - By then you'll know which phases need independent deployment
   - Just wrap each worker in a Docker container + separate deployment

---

## Scaling Analysis (100x to 1000x)

### Current Architecture at Scale

**Assumptions:**
- 1000 users × 100 documents/user = 100,000 documents/month
- Average: 50% video (10 min), 30% PDF (5 pages), 20% text

**Processing times (current monolithic worker):**
- Video: Download (2s) + Transcribe (10s) + Chunk (2s) = 14s
- PDF: Download (1s) + Extract (3s) + Chunk (2s) = 6s
- Text: Download (1s) + Extract (0.5s) + Chunk (2s) = 3.5s

**Current system:**
- Need ~23 workers running 24/7 to process 100k docs/month
- Cost: ~23 × $50/month (worker VM) = $1,150/month in infrastructure
- Problem: Cannot scale phases independently

### Proposed Architecture at Scale

**With independent queues:**

| Phase | Avg Time | Workers Needed | Cost/Month |
|-------|----------|----------------|------------|
| Ingestion (Download) | 1.5s | 2 workers | $100 |
| Extraction (Transcribe/Parse) | 7s | 10 workers | $500 |
| Chunking | 2s | 3 workers | $150 |
| KG Ingest | 30s | 40 workers | $2,000 |

**Total: $2,750/month BUT:**
- Can scale KG workers independently when that becomes bottleneck
- Can add more extraction workers during upload spikes
- Failure in KG doesn't waste transcription costs
- Can pause KG ingest during high-load times (chunking keeps working)

**At 1000x scale (100M docs/month):**
- Extraction: 10,000 workers ($500k/month) - **Bottleneck**
- Chunking: 3,000 workers ($150k/month)
- KG Ingest: 40,000 workers ($2M/month) - **Bottleneck**

**Key insight:** With independent scaling, you'd first:
1. Optimize KG ingest (40k workers is expensive!)
2. Batch KG inserts (10x speedup)
3. Use cheaper extraction API or self-host Whisper
4. Only scale what's actually slow

Without independent scaling, you'd just throw 230,000 monolithic workers at it ($11M/month).

---

## Recommendation

### Immediate Action (This Week):

1. **Add queue after extraction phase** - Store transcripts before chunking
2. **Create separate chunking worker** - Consume extraction queue
3. **Update document_worker to enqueue instead of call** - Producer pattern

This alone will:
- Save $$$ on retries (don't re-transcribe on chunking failure)
- Allow scaling chunking independently
- Take ~1 week of work

### Next Month:

1. Add KG ingest queue
2. Extract KG worker
3. Add `processing_job` table for phase-level tracking

### Month 2-3:

1. Add ingestion queue (complete the chain)
2. Extract to separate microservices (if needed)
3. Add advanced features (batch processing, priority queues, etc.)

---

## Summary

| Aspect | Current State | Required State | Gap |
|--------|---------------|----------------|-----|
| **Architecture** | Monolithic worker | Phase-separated queues | 🔴 High |
| **Scalability** | Scale all-or-nothing | Scale phases independently | 🔴 High |
| **Fault Tolerance** | Restart from beginning | Resume from failed phase | 🔴 High |
| **Cost Efficiency** | Retry wastes API costs | Retry only failed phase | 🔴 Medium |
| **Observability** | Document status only | Phase-level job tracking | 🟡 Medium |
| **Microservice-Ready** | Tightly coupled | Worker separation ready | 🔴 High |

**Your concern is well-founded.** The current system is NOT ready for 100-1000x scale. It's a monolithic "all or nothing" script that executes phases synchronously.

**Good news:** The conceptual separation already exists (phases are in separate functions). You just need to add queues between them and refactor from function calls to job enqueueing.

**Recommended first step:** Add extraction → chunking queue this sprint. It's the lowest-hanging fruit with highest ROI (saves transcription costs on retry + allows independent scaling).
