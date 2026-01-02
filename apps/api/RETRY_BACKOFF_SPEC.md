# Automatic Retry with Backoff Specification

## Retry Strategy

**Exponential backoff with jitter:**
- Attempt 1: Immediate (original job)
- Attempt 2: 60s delay
- Attempt 3: 300s delay (5 min)
- Attempt 4: 900s delay (15 min)
- Max attempts: 3 retries (4 total including original)

## Retryable vs Non-Retryable Errors

```python
# mentorfy/core/retry_policy.py (new file)

RETRYABLE_ERRORS = {
    # Network/API errors
    "ConnectionError",
    "Timeout",
    "ReadTimeout",
    "HTTPError",  # Only if 5xx
    "APIError",

    # Temporary service issues
    "RateLimitError",
    "ServiceUnavailable",
}

NON_RETRYABLE_ERRORS = {
    # Client errors (fix required)
    "ValidationError",
    "FileNotFoundError",
    "InvalidFileFormat",
    "AuthenticationError",  # Bad API key
    "PermissionDenied",
}

def is_retryable_error(error: Exception, status_code: int = None) -> bool:
    """Determine if error should trigger retry"""
    error_type = type(error).__name__

    # Non-retryable
    if error_type in NON_RETRYABLE_ERRORS:
        return False

    # HTTP 4xx (except 429 rate limit) = non-retryable
    if status_code and 400 <= status_code < 500 and status_code != 429:
        return False

    # HTTP 5xx or known retryable = retry
    if error_type in RETRYABLE_ERRORS or (status_code and status_code >= 500):
        return True

    # Unknown error = retry (conservative)
    return True

def get_retry_delay(retry_count: int) -> int:
    """Get delay in seconds for retry attempt"""
    delays = [60, 300, 900]  # 1 min, 5 min, 15 min
    if retry_count >= len(delays):
        return delays[-1]  # Cap at 15 min
    return delays[retry_count]
```

## Worker Implementation

```python
# mentorfy/workers/extraction_worker.py (example)

from mentorfy.core.retry_policy import is_retryable_error, get_retry_delay
from datetime import datetime, timedelta, timezone

MAX_RETRIES = 3

async def extract_text_task(
    pipeline_job_id: str,
    document_id: str,
    source_location: str,
    retry_count: int = 0,
    **kwargs
):
    """
    Phase 1: Extract text from source
    Includes automatic retry logic
    """
    phase_id = None

    try:
        # 1. Create phase record
        phase = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "extraction",
            "status": "processing",
            "retry_count": retry_count,
            "input_location": source_location,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        phase_id = phase.data[0]["id"]

        # 2. Do work
        text = await extract_text(source_location)
        text_location = await store_extracted_text(document_id, text)

        # 3. Success - update phase
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "output_location": text_location,
            "metadata": {"text_length": len(text)}
        }).eq("id", phase_id).execute()

        # 4. Update job
        supabase.table("pipeline_job").update({
            "current_phase": "chunking",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", pipeline_job_id).execute()

        # 5. Enqueue next phase
        enqueue_chunking(pipeline_job_id, document_id, text_location, **kwargs)

        logger.info(f"✅ Extraction completed for {document_id}")

    except Exception as e:
        logger.error(f"❌ Extraction failed for {document_id}: {e}")

        # Mark phase as failed
        if phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
                "error_type": type(e).__name__,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", phase_id).execute()

        # Decide: Retry or give up?
        if retry_count < MAX_RETRIES and is_retryable_error(e):
            # Schedule retry
            delay = get_retry_delay(retry_count)
            next_retry = retry_count + 1

            logger.info(
                f"🔄 Scheduling retry {next_retry}/{MAX_RETRIES} "
                f"in {delay}s for job {pipeline_job_id}"
            )

            # Keep job as 'processing' (retry scheduled)
            supabase.table("pipeline_job").update({
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "metadata": supabase.raw(
                    f"metadata || jsonb_build_object('last_retry_at', '{datetime.now(timezone.utc).isoformat()}', 'retry_count', {next_retry})"
                )
            }).eq("id", pipeline_job_id).execute()

            # Enqueue retry job with delay
            queue = Queue(QUEUE_EXTRACTION, connection=get_redis_connection())
            queue.enqueue_in(
                timedelta(seconds=delay),
                extract_text_task,
                pipeline_job_id=pipeline_job_id,
                document_id=document_id,
                source_location=source_location,
                retry_count=next_retry,
                **kwargs
            )
        else:
            # Give up - mark job as permanently failed
            logger.error(
                f"❌ Giving up on {document_id} after {retry_count} retries "
                f"(error: {type(e).__name__})"
            )

            supabase.table("pipeline_job").update({
                "status": "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "metadata": supabase.raw(
                    f"metadata || jsonb_build_object('final_error', '{str(e)}', 'final_error_type', '{type(e).__name__}', 'total_retries', {retry_count})"
                )
            }).eq("id", pipeline_job_id).execute()

            # Don't re-raise (job is handled)
```

## Manual Retry (Admin Tool)

```python
# scripts/retry_failed_job.py

async def retry_failed_job(pipeline_job_id: str, from_phase: str = None):
    """
    Manually retry a failed job from a specific phase.
    Useful for jobs that exceeded max retries or need manual intervention.
    """
    # Get job details
    job = supabase.table("pipeline_job").select("*").eq("id", pipeline_job_id).single().execute()

    if job.data["status"] != "failed":
        raise ValueError("Can only retry failed jobs")

    # Find which phase failed
    if from_phase is None:
        failed_phase = (
            supabase.table("pipeline_phase")
            .select("*")
            .eq("pipeline_job_id", pipeline_job_id)
            .eq("status", "failed")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        from_phase = failed_phase.data[0]["phase"]
        input_location = failed_phase.data[0]["input_location"]

    # Reset job to processing
    supabase.table("pipeline_job").update({
        "status": "processing",
        "current_phase": from_phase,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", pipeline_job_id).execute()

    # Enqueue phase with retry_count=0 (fresh start)
    if from_phase == "extraction":
        enqueue_extraction(pipeline_job_id, job.data["document_id"], input_location, retry_count=0)
    elif from_phase == "chunking":
        enqueue_chunking(pipeline_job_id, job.data["document_id"], input_location, retry_count=0)
    elif from_phase == "kg_ingest":
        enqueue_kg_ingest(pipeline_job_id, job.data["document_id"], retry_count=0)

    print(f"✅ Retrying job {pipeline_job_id} from {from_phase} phase")

# Usage:
# python scripts/retry_failed_job.py --job-id abc123 --from-phase extraction
```

## Monitoring Retries

```sql
-- Jobs currently in retry backoff
SELECT
    pj.document_id,
    pj.metadata->>'source_name' as file_name,
    pp.phase,
    pp.retry_count,
    pp.completed_at as failed_at,
    EXTRACT(EPOCH FROM (NOW() - pp.completed_at)) as seconds_since_failure
FROM pipeline_job pj
JOIN pipeline_phase pp ON pp.pipeline_job_id = pj.id
WHERE pj.status = 'processing'
  AND pp.status = 'failed'
  AND pp.retry_count < 3
ORDER BY pp.completed_at DESC;

-- Retry success rate
SELECT
    phase,
    COUNT(*) FILTER (WHERE retry_count > 0) as total_retries,
    COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'completed') as successful_retries,
    ROUND(100.0 * COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'completed') /
          NULLIF(COUNT(*) FILTER (WHERE retry_count > 0), 0), 1) as success_rate_pct
FROM pipeline_phase
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY phase;
```

## Configuration (Optional)

```python
# .env additions for tuning
MAX_RETRIES=3
RETRY_DELAY_1=60      # 1 minute
RETRY_DELAY_2=300     # 5 minutes
RETRY_DELAY_3=900     # 15 minutes

# Per-phase overrides (if needed)
EXTRACTION_MAX_RETRIES=5  # More retries for expensive operations
CHUNKING_MAX_RETRIES=3
KG_INGEST_MAX_RETRIES=3
```

## Testing Retries

```python
# Test script
async def test_retry_logic():
    # 1. Create job that will fail
    job = await start_pipeline(doc_id, "test.pdf", "manual_upload", "org_123")

    # 2. Enqueue extraction with known-bad input (will fail)
    enqueue_extraction(job["id"], doc_id, "invalid://location")

    # 3. Watch logs - should see:
    # - Attempt 1: Immediate failure
    # - Attempt 2: After 60s
    # - Attempt 3: After 5 min
    # - Attempt 4: After 15 min
    # - Final: Marked as failed

    # 4. Verify database state
    phases = supabase.table("pipeline_phase").select("*").eq("pipeline_job_id", job["id"]).execute()
    assert len(phases.data) == 4  # 1 original + 3 retries
    assert all(p["status"] == "failed" for p in phases.data)
```
