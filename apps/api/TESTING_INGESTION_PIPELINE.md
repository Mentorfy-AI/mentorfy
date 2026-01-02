# Testing the Document Ingestion Pipeline

This guide provides comprehensive instructions for testing each phase of the document ingestion pipeline independently, without needing the frontend.

## Pipeline Overview

The ingestion pipeline has **two parallel paths** depending on file type:

### Path A: Audio/Video Files (Direct Transcription)
```
Google Drive → Download → Deepgram Transcription → Contextual Chunking → Database Storage
```

**Phases:**
1. **Download** - Fetch file from Google Drive to temp storage
2. **Transcription** - Send to Deepgram API (handles audio + video natively)
3. **Chunking** - Create contextual chunks with Anthropic API
4. **Storage** - Save chunks to Supabase database

**Status Flow:** `uploaded` → `queued` → `processing` → `chunk_complete`

### Path B: Standard Documents
```
Supabase Storage → Text Extraction → Contextual Chunking → Database Storage → Knowledge Graph
```

**Phases:**
1. **Import** - Download from Supabase storage → Extract text → Create contextual chunks
2. **Enrich** - (Future) LLM enhancement of chunks
3. **Ingest** - Add chunks to Knowledge Graph (Graphiti/Neo4j)

**Status Flow:** `uploaded` → `queued` → `processing` → `chunk_complete` → `ingesting` → `ingest_complete`

---

## Testing Strategy

### Prerequisites

```bash
# 1. Set up environment variables
cp .env.example .env.local

# Required vars:
SUPABASE_URL=https://qnkaisqmmgboexzxtybh.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DEEPGRAM_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx  # For Graphiti
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=test-password

# 2. Start dependencies
docker-compose up -d  # Redis + Neo4j

# 3. Verify services
docker ps  # Should show redis + neo4j containers
```

---

## Phase-by-Phase Testing

### Phase 0: Google Drive Download (Audio/Video only)

**What it tests:**
- OAuth token retrieval from database
- Google Drive API authentication
- File download to temp storage
- File size validation

**Test script:**
```python
# test_google_drive_download.py
import asyncio
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from supabase import create_client

async def test_google_drive_download():
    # 1. Setup
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = "org_33UFSqLVk0EvBjkVlh6E7ZaiCqL"  # Replace with your org
    file_id = "1ib6CITHjrwTi2fNgr-gSgaPCybF0YLd2"  # Replace with test file

    # 2. Get OAuth tokens
    result = supabase.table("google_drive_tokens").select("*").eq("clerk_org_id", org_id).execute()
    token_data = result.data[0]

    credentials = Credentials(
        token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_DRIVE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_DRIVE_CLIENT_SECRET"),
    )

    # 3. Download file
    service = build("drive", "v3", credentials=credentials)
    request = service.files().get_media(fileId=file_id)

    import tempfile
    temp_fd, temp_path = tempfile.mkstemp(suffix='.mp4')
    os.close(temp_fd)

    with open(temp_path, 'wb') as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"Download {int(status.progress() * 100)}%")

    file_size = os.path.getsize(temp_path)
    print(f"✅ Downloaded {file_size / (1024*1024):.2f} MB to {temp_path}")

    # Cleanup
    os.unlink(temp_path)

asyncio.run(test_google_drive_download())
```

**Run:**
```bash
uv run python test_google_drive_download.py
```

**Expected output:**
```
Download 100%
✅ Downloaded 2.23 MB to /tmp/tmpXXXX.mp4
```

---

### Phase 1: Deepgram Transcription (Audio/Video)

**What it tests:**
- File format detection (audio vs video)
- Deepgram API integration
- Video-to-audio handling (Deepgram does this natively)
- Transcript quality and metadata

**Test script:**
```python
# test_transcription.py
import asyncio
import os
from mentorfy.services.transcription_service import get_transcription_service

async def test_transcription():
    # 1. Setup
    service = get_transcription_service()

    # 2. Download a test file from Google Drive first (or use local file)
    test_file = "/path/to/test/video.mp4"  # Replace with actual path

    # 3. Transcribe
    print(f"Transcribing {test_file}...")
    result = await service.transcribe_file(test_file, include_timestamps=False)

    # 4. Verify results
    print(f"\n✅ Transcription Results:")
    print(f"  Text: {result.text[:200]}...")
    print(f"  Confidence: {result.confidence:.2%}")
    print(f"  Duration: {result.duration_seconds:.2f}s")
    print(f"  Word Count: {result.word_count}")
    print(f"  Cost: ${result.metadata.get('estimated_cost_usd', 0):.4f}")

    assert result.text, "Transcript should not be empty"
    assert result.confidence > 0.7, "Confidence should be > 70%"

    print("\n✅ Transcription test passed!")

asyncio.run(test_transcription())
```

**Run:**
```bash
uv run python test_transcription.py
```

**Expected output:**
```
Transcribing /tmp/video.mp4...
✅ Transcription Results:
  Text: Start with a higher time frame. So you wanna find clear swing highs and swing lows...
  Confidence: 99.50%
  Duration: 10.11s
  Word Count: 30
  Cost: $0.0007

✅ Transcription test passed!
```

---

### Phase 2: Contextual Chunking

**What it tests:**
- Text splitting logic
- Anthropic API integration for contextual descriptions
- Chunk quality and overlap
- Token counting accuracy

**Test script:**
```python
# test_chunking.py
import asyncio
import os
from mentorfy.services.chunking_service import get_chunking_service

async def test_chunking():
    # 1. Setup
    service = get_chunking_service(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # 2. Sample transcript (or use output from Phase 1)
    sample_text = """
    Start with a higher time frame. So you wanna find clear swing highs and swing lows.
    For me, if it's a new week, I typically will start on the weekly chart to identify
    the overall trend direction. Then I'll drop down to the daily timeframe to look for
    key support and resistance levels.
    """ * 50  # Repeat to get enough text for multiple chunks

    # 3. Chunk the text
    print(f"Chunking {len(sample_text)} chars...")
    chunks = await service.chunk_document(
        text=sample_text,
        document_title="Trading Strategy Video"
    )

    # 4. Verify results
    print(f"\n✅ Chunking Results:")
    print(f"  Total chunks: {len(chunks)}")

    for i, chunk in enumerate(chunks[:3]):  # Show first 3
        print(f"\n  Chunk {i + 1}:")
        print(f"    Content: {chunk.content[:100]}...")
        print(f"    Context: {chunk.context}")
        print(f"    Tokens: {chunk.token_count}")

    assert len(chunks) > 0, "Should create at least one chunk"
    assert all(c.content for c in chunks), "All chunks should have content"

    print("\n✅ Chunking test passed!")

asyncio.run(test_chunking())
```

**Run:**
```bash
uv run python test_chunking.py
```

**Expected output:**
```
Chunking 5000 chars...
✅ Chunking Results:
  Total chunks: 8

  Chunk 1:
    Content: Start with a higher time frame. So you wanna find clear swing highs and swing lows...
    Context: Introduction to multi-timeframe analysis strategy for trading
    Tokens: 245

✅ Chunking test passed!
```

---

### Phase 3: Database Storage (Chunks)

**What it tests:**
- Supabase document_chunk table insertion
- Batch insert performance
- RLS (Row Level Security) compatibility
- Foreign key constraints

**Test script:**
```python
# test_chunk_storage.py
import os
from supabase import create_client
from datetime import datetime, timezone

def test_chunk_storage():
    # 1. Setup
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # 2. Create test document first
    doc_data = {
        "title": "Test Document for Chunk Storage",
        "clerk_org_id": "org_33UFSqLVk0EvBjkVlh6E7ZaiCqL",  # Replace
        "file_type": "mp4",
        "file_size": 1000000,
        "processing_status": "processing",
        "source_type": "manual_upload",
    }

    doc_result = supabase.table("document").insert(doc_data).execute()
    document_id = doc_result.data[0]["id"]
    print(f"Created test document: {document_id}")

    # 3. Prepare chunks
    chunks_data = [
        {
            "document_id": document_id,
            "chunk_index": 0,
            "content": "This is chunk 1 content with some test text.",
            "context": "First chunk describing the introduction",
            "token_count": 10,
            "metadata": {"source": "test"}
        },
        {
            "document_id": document_id,
            "chunk_index": 1,
            "content": "This is chunk 2 content with more test text.",
            "context": "Second chunk with additional details",
            "token_count": 12,
            "metadata": {"source": "test"}
        }
    ]

    # 4. Insert chunks (atomic batch)
    chunk_result = supabase.table("document_chunk").insert(chunks_data).execute()

    print(f"\n✅ Chunk Storage Results:")
    print(f"  Inserted {len(chunk_result.data)} chunks")

    # 5. Verify retrieval
    verify = supabase.table("document_chunk").select("*").eq("document_id", document_id).execute()
    print(f"  Retrieved {len(verify.data)} chunks")

    # 6. Cleanup
    supabase.table("document_chunk").delete().eq("document_id", document_id).execute()
    supabase.table("document").delete().eq("id", document_id).execute()
    print(f"\n✅ Cleanup complete")

test_chunk_storage()
```

**Run:**
```bash
uv run python test_chunk_storage.py
```

---

### Phase 4: Knowledge Graph Ingest (Standard Documents only)

**What it tests:**
- Neo4j connection
- Graphiti integration
- Entity extraction from chunks
- Relationship creation

**Test script:**
```python
# test_graphiti_ingest.py
import asyncio
import os
from mentorfy.db.neo4j import get_graphiti_client
from supabase import create_client

async def test_graphiti_ingest():
    # 1. Setup
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    graphiti = get_graphiti_client()

    # 2. Get chunks from a test document
    document_id = "YOUR_DOCUMENT_ID"  # Replace with actual doc ID
    chunks = supabase.table("document_chunk").select("*").eq("document_id", document_id).execute()

    print(f"Ingesting {len(chunks.data)} chunks into Graphiti...")

    # 3. Ingest chunks
    for i, chunk in enumerate(chunks.data):
        # Prepare episode
        episode_data = {
            "name": f"chunk_{chunk['chunk_index']}",
            "episode_body": chunk["content"],
            "source": "test_ingestion",
            "reference_time": chunk.get("created_at"),
        }

        # Add to Graphiti
        await graphiti.add_episode(**episode_data)
        print(f"  Ingested chunk {i + 1}/{len(chunks.data)}")

    # 4. Verify in Neo4j
    print("\n✅ Graphiti Ingest Results:")
    print(f"  Successfully ingested {len(chunks.data)} chunks")
    print(f"  Check Neo4j browser at http://localhost:7474")

asyncio.run(test_graphiti_ingest())
```

**Run:**
```bash
uv run python test_graphiti_ingest.py
```

---

## End-to-End Testing (Full Pipeline)

### Option 1: Worker-Based Testing (Most Realistic)

**Setup:**
```bash
# Terminal 1: Start worker
./worker-dev.sh

# Terminal 2: Queue a job manually
```

**Queue job script:**
```python
# queue_test_job.py
import os
from redis import Redis
from rq import Queue

redis_conn = Redis(host='localhost', port=6379, db=0)
queue = Queue('documents', connection=redis_conn)

job = queue.enqueue(
    'mentorfy.workers.document_worker.process_document_job',
    document_id='YOUR_DOCUMENT_ID',  # Replace with actual doc ID
    organization_id='org_33UFSqLVk0EvBjkVlh6E7ZaiCqL',  # Replace
    file_name='test_video.mp4',
    job_timeout='10m'
)

print(f"✅ Queued job: {job.id}")
print(f"   Status: {job.get_status()}")
```

**Run:**
```bash
uv run python queue_test_job.py
```

**Monitor:**
```bash
# Watch worker logs in Terminal 1
# Check document status in database
```

---

### Option 2: Direct Function Testing (Fastest)

**Test the audio/video path directly:**
```python
# test_audio_video_e2e.py
import asyncio
import os
from mentorfy.workers.document_worker import process_audio_video_document
from mentorfy.services.document_processor import DocumentProcessor

async def test_full_audio_video_pipeline():
    # 1. Setup
    processor = DocumentProcessor(
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # 2. Run full pipeline
    document_id = "YOUR_DOCUMENT_ID"  # Replace
    org_id = "org_33UFSqLVk0EvBjkVlh6E7ZaiCqL"  # Replace

    result = await process_audio_video_document(
        document_processor=processor,
        document_id=document_id,
        organization_id=org_id,
        file_name="test_video.mp4"
    )

    # 3. Verify
    print("\n✅ E2E Test Results:")
    print(f"  Transcript length: {result.get('transcript_length')} chars")
    print(f"  Chunks created: {result.get('chunk_count')}")
    print(f"  Cost: ${result.get('transcription_cost_usd', 0):.4f}")
    print(f"  Status: {result.get('status')}")

asyncio.run(test_full_audio_video_pipeline())
```

---

## Quick Test Commands

```bash
# Test Deepgram connectivity
curl -X GET "https://api.deepgram.com/v1/projects" \
  -H "Authorization: Token $DEEPGRAM_API_KEY"

# Test Anthropic connectivity
curl -X POST "https://api.anthropic.com/v1/messages" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# Test Supabase connectivity
curl "$SUPABASE_URL/rest/v1/document?limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# Test Neo4j connectivity
docker exec -it mentorfy-neo4j cypher-shell -u neo4j -p test-password "MATCH (n) RETURN count(n);"

# Test Redis connectivity
docker exec -it mentorfy-redis redis-cli ping
```

---

## Debugging Tips

### Worker not picking up jobs
```bash
# Check Redis queue length
docker exec -it mentorfy-redis redis-cli LLEN rq:queue:documents

# Check failed jobs
docker exec -it mentorfy-redis redis-cli LLEN rq:queue:failed

# Clear all queues (development only!)
docker exec -it mentorfy-redis redis-cli FLUSHALL
```

### Database state inspection
```python
# Check document status
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
doc = supabase.table("document").select("*").eq("id", "DOC_ID").execute()
print(doc.data[0]["processing_status"])
print(doc.data[0]["source_metadata"])

# Check chunks created
chunks = supabase.table("document_chunk").select("count").eq("document_id", "DOC_ID").execute()
print(f"Chunks: {len(chunks.data)}")
```

### Cost tracking
```python
# Calculate total Deepgram costs
docs = supabase.table("document").select("source_metadata").execute()
total_cost = sum(
    doc["source_metadata"].get("processing", {}).get("transcription_cost_usd", 0)
    for doc in docs.data
)
print(f"Total transcription cost: ${total_cost:.2f}")
```

---

## Next Steps

1. **Start with Phase 1 (Transcription)** - Use a small test file to verify Deepgram integration
2. **Test Phase 2 (Chunking)** - Verify chunk quality and context generation
3. **Test Phase 3 (Storage)** - Ensure database writes work correctly
4. **Run E2E Test** - Queue a full job through the worker

Once all phases pass individually, the full pipeline should work reliably!
