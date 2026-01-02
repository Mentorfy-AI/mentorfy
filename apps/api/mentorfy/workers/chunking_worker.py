"""
Chunking Worker (Phased Pipeline V2)

Handles chunking phase where all sources converge (manual uploads + external sources).

Flow:
1. Load extracted text from Supabase Storage (extracted_text/)
2. Chunk text using contextual retrieval pattern (Anthropic)
3. Store chunks in document_chunk table
4. Update pipeline_phase and pipeline_job records
5. Enqueue KG ingestion phase

Chunking strategy:
- Fixed-size chunks (~800 tokens) with overlap (~100 tokens)
- Respects sentence boundaries
- LLM-generated contextual descriptions per chunk
- Concurrent context generation for speed

Cost: ~$0.02 per document (using Claude Haiku)
"""

import os
import sys
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from rq import get_current_job

# Supabase client
from mentorfy.utils.storage import load_extracted_text, get_supabase_client
from mentorfy.services.chunking_service import get_chunking_service
from mentorfy.core.queues import enqueue_kg_ingest
from mentorfy.core.retry_policy import (
    get_phase_timeout,
    is_retryable_error,
    get_retry_delay,
    MAX_RETRIES
)

# Configure logging for worker process (RQ forks don't inherit logging config)
# Use stdout so Railway doesn't treat INFO logs as errors
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [chunking] - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger(__name__)


def get_now():
    """Get current UTC timestamp"""
    return datetime.now(timezone.utc).isoformat()


def update_job_metadata(supabase, pipeline_job_id: str, new_metadata: Dict[str, Any]):
    """
    Merge new metadata into existing pipeline_job metadata without overwriting other keys.
    """
    result = supabase.table("pipeline_job").select("metadata").eq("id", pipeline_job_id).execute()
    current_metadata = result.data[0]["metadata"] if result.data and result.data[0].get("metadata") else {}
    merged = {**current_metadata, **new_metadata}
    supabase.table("pipeline_job").update({
        "metadata": merged,
        "updated_at": get_now(),
    }).eq("id", pipeline_job_id).execute()


async def chunk_task(
    pipeline_job_id: str,
    document_id: str,
    text_location: str,
    retry_count: int = 0,
    parent_phase_id: str = None,
    **kwargs
):
    """
    Chunking task for all sources (converge point).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        text_location: Supabase Storage path to extracted text
        retry_count: Current retry attempt (0 = first attempt, 1-3 = retries)
        parent_phase_id: ID of parent phase if this is a retry
        **kwargs: Additional metadata
            - source_name: Original filename
            - source_platform: Source platform
            - clerk_org_id: Organization ID

    Phase records created:
    - chunking: status="completed"

    Next phase:
    - Enqueues KG ingestion phase

    Retry behavior:
    - On retryable error: Creates new queued phase and enqueues retry with backoff
    - Delays and max retries configured in mentorfy.core.retry_policy
    """
    job = get_current_job()
    phase_id = None

    source_name = kwargs.get("source_name", "Unknown file")
    source_platform = kwargs.get("source_platform", "unknown")
    clerk_org_id = kwargs.get("clerk_org_id")

    logger.info(
        f"✂️ [Chunking] Starting for document {document_id} "
        f"(pipeline_job={pipeline_job_id}, source={source_platform})"
    )

    supabase = get_supabase_client()

    try:
        # Clear retry metadata if this is a retry attempt
        if retry_count > 0:
            update_job_metadata(supabase, pipeline_job_id, {
                "retry_at": None,
                "retry_count": retry_count,
                "last_error": None,
            })
            logger.info(f"🔄 Retry {retry_count} starting, cleared retry_at metadata")

        # ========================================================================
        # 1. Create chunking phase record
        # ========================================================================
        now = datetime.now(timezone.utc)
        timeout_seconds = get_phase_timeout('chunking')

        phase_result = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "chunking",
            "status": "processing",
            "input_location": text_location,
            "retry_count": retry_count,
            "parent_phase_id": parent_phase_id,
            "started_at": now.isoformat(),
            "expected_completion_at": (now + timedelta(seconds=timeout_seconds)).isoformat(),
        }).execute()

        phase_id = phase_result.data[0]["id"]
        logger.info(f"✅ Created chunking phase record: {phase_id}")

        if job:
            job.meta["progress"] = 10
            job.save_meta()

        # ========================================================================
        # 2. Load extracted text from Storage
        # ========================================================================
        logger.info(f"📥 Loading text from: {text_location}")
        text_content = await load_extracted_text(text_location)
        text_length = len(text_content)
        word_count = len(text_content.split())
        logger.info(f"✅ Loaded {text_length} chars, {word_count} words")

        if job:
            job.meta["progress"] = 20
            job.save_meta()

        # ========================================================================
        # 3. Chunk text with contextual retrieval
        # ========================================================================
        logger.info(f"✂️ Chunking with contextual retrieval...")

        # Get API key (Anthropic for contextual chunking)
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        # Initialize chunking service
        chunking_service = get_chunking_service(api_key=anthropic_api_key)

        # Chunk document
        chunks = await chunking_service.chunk_document(
            text=text_content,
            document_title=source_name
        )

        chunk_count = len(chunks)
        logger.info(f"✅ Created {chunk_count} chunks with contextual descriptions")

        if job:
            job.meta["progress"] = 70
            job.save_meta()

        # ========================================================================
        # 4. Store chunks in database (atomic batch insert)
        # ========================================================================
        logger.info(f"💾 Storing {chunk_count} chunks in database...")

        chunks_data = [
            {
                "document_id": document_id,
                "content": chunk.text,
                "context": chunk.context,
                "chunk_index": i,
                "token_count": chunk.token_count,
                "metadata": {
                    "char_start": chunk.char_start,
                    "char_end": chunk.char_end,
                },
            }
            for i, chunk in enumerate(chunks)
        ]

        # Atomic insert - all or nothing
        supabase.table("document_chunk").insert(chunks_data).execute()

        logger.info(f"✅ Stored {chunk_count} chunks")

        if job:
            job.meta["progress"] = 85
            job.save_meta()

        # ========================================================================
        # 5. Complete chunking phase
        # ========================================================================
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": get_now(),
            "output_location": None,  # Chunks stored in DB, not Storage
            "metadata": {
                "chunk_count": chunk_count,
                "text_length": text_length,
                "word_count": word_count,
            }
        }).eq("id", phase_id).execute()

        logger.info(f"✅ Completed chunking phase: {phase_id}")

        # ========================================================================
        # 6. Update pipeline_job
        # ========================================================================
        supabase.table("pipeline_job").update({
            "current_phase": "kg_ingest",
            "updated_at": get_now(),
        }).eq("id", pipeline_job_id).execute()

        if job:
            job.meta["progress"] = 95
            job.save_meta()

        # ========================================================================
        # 7. Enqueue KG ingestion phase
        # ========================================================================
        logger.info(f"📤 Enqueuing KG ingest phase...")
        enqueue_kg_ingest(
            pipeline_job_id=pipeline_job_id,
            document_id=document_id,
            source_name=source_name,
            source_platform=source_platform,
            clerk_org_id=clerk_org_id,
        )

        if job:
            job.meta["progress"] = 100
            job.save_meta()

        logger.info(
            f"✅ [Chunking] Complete for document {document_id} "
            f"({chunk_count} chunks created)"
        )

        return {
            "status": "success",
            "document_id": document_id,
            "chunk_count": chunk_count,
            "text_length": text_length,
        }

    except Exception as e:
        logger.error(f"❌ [Chunking] Failed for document {document_id}: {e}", exc_info=True)

        # ========================================================================
        # Error Handling: Mark phase as failed
        # ========================================================================
        if phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
                "error_type": type(e).__name__,
                "completed_at": get_now(),
            }).eq("id", phase_id).execute()

        # ========================================================================
        # Retry Decision: Should we retry or give up?
        # ========================================================================
        if retry_count < MAX_RETRIES and is_retryable_error(e):
            # RETRY: Schedule retry with backoff
            # Pass error to get_retry_delay so it can use retry-after header if available
            delay = get_retry_delay(retry_count, error=e)
            next_retry = retry_count + 1

            logger.info(
                f"🔄 [Chunking] Scheduling retry {next_retry}/{MAX_RETRIES} "
                f"in {delay}s for job {pipeline_job_id} (error: {type(e).__name__})"
            )

            # Create queued retry phase (linked to failed phase)
            now = datetime.now(timezone.utc)
            retry_phase = supabase.table("pipeline_phase").insert({
                "pipeline_job_id": pipeline_job_id,
                "phase": "chunking",
                "status": "queued",
                "parent_phase_id": phase_id,
                "retry_count": next_retry,
                "input_location": text_location,
                "queued_at": (now + timedelta(seconds=delay)).isoformat(),
            }).execute()

            logger.info(f"✅ Created queued retry phase: {retry_phase.data[0]['id']}")

            # Update job with retry info so frontend can show "Retrying in Xm"
            retry_at = (now + timedelta(seconds=delay)).isoformat()
            update_job_metadata(supabase, pipeline_job_id, {
                "retry_at": retry_at,
                "retry_count": next_retry,
                "last_error": str(e)[:500],
            })

            # Enqueue retry job with delay
            from mentorfy.core.queues import get_queue, QUEUE_CHUNKING
            queue = get_queue(QUEUE_CHUNKING)
            queue.enqueue_in(
                timedelta(seconds=delay),
                chunk_task,
                pipeline_job_id=pipeline_job_id,
                document_id=document_id,
                text_location=text_location,
                retry_count=next_retry,
                parent_phase_id=phase_id,
                **kwargs
            )

            logger.info(f"✅ Enqueued retry {next_retry} for chunking (delay: {delay}s)")

            # Sleep before returning to prevent next job from hitting same rate limit
            # This blocks the worker, but with limited chunking workers that's correct behavior
            if hasattr(e, "retry_after") and e.retry_after:
                logger.info(f"⏳ Sleeping {e.retry_after}s before next job (rate limit cooldown)")
                import time
                time.sleep(e.retry_after)

        else:
            # GIVE UP: Mark job as permanently failed
            reason = (
                f"max retries ({MAX_RETRIES}) exceeded"
                if retry_count >= MAX_RETRIES
                else f"non-retryable error ({type(e).__name__})"
            )

            logger.error(
                f"❌ [Chunking] Giving up on document {document_id} after "
                f"{retry_count} attempts ({reason})"
            )

            supabase.table("pipeline_job").update({
                "status": "failed",
                "completed_at": get_now(),
            }).eq("id", pipeline_job_id).execute()

        # Don't re-raise - error is handled
        return {
            "status": "failed" if retry_count >= MAX_RETRIES or not is_retryable_error(e) else "retrying",
            "error": str(e),
            "retry_count": retry_count,
        }
