"""
Extraction Worker (Phased Pipeline V2)

Handles extraction phase for manual uploads where files are already in Supabase Storage.

Flow:
1. Download file from Supabase Storage (raw_documents/)
2. Extract text based on file type:
   - Audio/Video → Deepgram transcription
   - PDF/DOCX/TXT → Text extraction
   - Subtitles (VTT/SRT) → Direct text read
3. Store extracted text in Storage (extracted_text/)
4. Update pipeline_phase and pipeline_job records
5. Enqueue chunking phase

File types supported:
- Audio: MP3, M4A, WAV, FLAC, OGG, OPUS
- Video: MP4, MOV, AVI, MKV, WEBM, MPEG
- Documents: PDF, DOCX, DOC, TXT, Google Docs
- Subtitles: VTT, SRT
"""

import os
import sys
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from rq import get_current_job

# Supabase client
from supabase import create_client, Client

# Import services
from mentorfy.services.extraction import (
    get_mime_type,
    transcribe_audio_video,
    extract_document_text,
)
from mentorfy.utils.storage import (
    store_extracted_text,
    load_raw_document,
    get_supabase_client
)
from mentorfy.utils.file_utils import is_audio_video_file, get_file_type_label
from mentorfy.core.queues import enqueue_chunking
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
    format="%(asctime)s - [extraction] - %(levelname)s - %(message)s",
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


async def extract_task(
    pipeline_job_id: str,
    document_id: str,
    raw_location: str,
    retry_count: int = 0,
    parent_phase_id: str = None,
    **kwargs
):
    """
    Extraction task for manual uploads.

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        raw_location: Supabase Storage path (e.g., "raw_documents/123.mp4")
        retry_count: Current retry attempt (0 = first attempt, 1-3 = retries)
        parent_phase_id: ID of parent phase if this is a retry
        **kwargs: Additional metadata
            - source_name: Original filename
            - source_platform: "manual_upload"
            - clerk_org_id: Organization ID
            - file_type: File type label (e.g., "mp3", "pdf")

    Phase records created:
    - extraction: status="completed", output_location="extracted_text/{id}.txt"

    Next phase:
    - Enqueues chunking phase

    Retry behavior:
    - On retryable error: Creates new queued phase and enqueues retry with backoff
    - Delays and max retries configured in mentorfy.core.retry_policy
    """
    job = get_current_job()
    phase_id = None

    source_name = kwargs.get("source_name", "Unknown file")
    file_type = kwargs.get("file_type", "unknown")
    clerk_org_id = kwargs.get("clerk_org_id")

    logger.info(
        f"🔍 [Extraction] Starting for document {document_id} "
        f"(pipeline_job={pipeline_job_id}, file={source_name})"
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
        # 1. Create extraction phase record
        # ========================================================================
        now = datetime.now(timezone.utc)
        timeout_seconds = get_phase_timeout('extraction')

        phase_result = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "extraction",
            "status": "processing",
            "input_location": raw_location,
            "retry_count": retry_count,
            "parent_phase_id": parent_phase_id,
            "started_at": now.isoformat(),
            "expected_completion_at": (now + timedelta(seconds=timeout_seconds)).isoformat(),
        }).execute()

        phase_id = phase_result.data[0]["id"]
        logger.info(f"✅ Created extraction phase record: {phase_id}")

        if job:
            job.meta["progress"] = 10
            job.save_meta()

        # ========================================================================
        # 2. Download file from Supabase Storage
        # ========================================================================
        logger.info(f"📥 Downloading from storage: {raw_location}")
        file_data = await load_raw_document(raw_location)
        file_size_mb = len(file_data) / (1024 * 1024)
        logger.info(f"✅ Downloaded {file_size_mb:.1f} MB")

        if job:
            job.meta["progress"] = 30
            job.save_meta()

        # ========================================================================
        # 3. Extract text based on file type
        # ========================================================================
        logger.info(f"📝 Extracting text from {file_type} file...")

        # Determine MIME type from file_type
        mime_type = get_mime_type(file_type)

        if is_audio_video_file(mime_type):
            # Audio/video → Deepgram transcription
            text_content = await transcribe_audio_video(file_data, mime_type)
        else:
            # Documents/subtitles → Text extraction
            text_content = await extract_document_text(file_data, mime_type)

        text_length = len(text_content)
        word_count = len(text_content.split())

        # Validate extraction succeeded
        if text_length == 0:
            raise ValueError(
                f"No text extracted from {file_type} file (MIME: {mime_type}). "
                f"Source: {raw_location}"
            )

        logger.info(f"✅ Extracted {text_length} chars, {word_count} words")

        if job:
            job.meta["progress"] = 70
            job.save_meta()

        # ========================================================================
        # 4. Store extracted text
        # ========================================================================
        logger.info(f"💾 Storing extracted text...")
        text_location = await store_extracted_text(document_id, text_content)
        logger.info(f"✅ Stored text at: {text_location}")

        if job:
            job.meta["progress"] = 85
            job.save_meta()

        # ========================================================================
        # 5. Complete extraction phase
        # ========================================================================
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": get_now(),
            "output_location": text_location,
            "metadata": {
                "text_length": text_length,
                "word_count": word_count,
                "file_size_mb": file_size_mb,
            }
        }).eq("id", phase_id).execute()

        logger.info(f"✅ Completed extraction phase: {phase_id}")

        # ========================================================================
        # 6. Update pipeline_job
        # ========================================================================
        supabase.table("pipeline_job").update({
            "current_phase": "chunking",
            "updated_at": get_now(),
        }).eq("id", pipeline_job_id).execute()

        if job:
            job.meta["progress"] = 95
            job.save_meta()

        # ========================================================================
        # 7. Enqueue chunking phase
        # ========================================================================
        logger.info(f"📤 Enqueuing chunking phase...")
        enqueue_chunking(
            pipeline_job_id=pipeline_job_id,
            document_id=document_id,
            text_location=text_location,
            source_name=source_name,
            source_platform=kwargs.get("source_platform", "manual_upload"),
            clerk_org_id=clerk_org_id,
        )

        if job:
            job.meta["progress"] = 100
            job.save_meta()

        logger.info(
            f"✅ [Extraction] Complete for document {document_id} "
            f"({text_length} chars extracted)"
        )

        return {
            "status": "success",
            "document_id": document_id,
            "text_length": text_length,
            "word_count": word_count,
        }

    except Exception as e:
        logger.error(f"❌ [Extraction] Failed for document {document_id}: {e}", exc_info=True)

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
            delay = get_retry_delay(retry_count, error=e)
            next_retry = retry_count + 1

            logger.info(
                f"🔄 [Extraction] Scheduling retry {next_retry}/{MAX_RETRIES} "
                f"in {delay}s for job {pipeline_job_id} (error: {type(e).__name__})"
            )

            # Create queued retry phase (linked to failed phase)
            now = datetime.now(timezone.utc)
            retry_phase = supabase.table("pipeline_phase").insert({
                "pipeline_job_id": pipeline_job_id,
                "phase": "extraction",
                "status": "queued",
                "parent_phase_id": phase_id,
                "retry_count": next_retry,
                "input_location": raw_location,
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
            from mentorfy.core.queues import get_queue, QUEUE_EXTRACTION
            queue = get_queue(QUEUE_EXTRACTION)
            queue.enqueue_in(
                timedelta(seconds=delay),
                extract_task,
                pipeline_job_id=pipeline_job_id,
                document_id=document_id,
                raw_location=raw_location,
                retry_count=next_retry,
                parent_phase_id=phase_id,
                **kwargs
            )

            logger.info(f"✅ Enqueued retry {next_retry} for extraction (delay: {delay}s)")

        else:
            # GIVE UP: Mark job as permanently failed
            reason = (
                f"max retries ({MAX_RETRIES}) exceeded"
                if retry_count >= MAX_RETRIES
                else f"non-retryable error ({type(e).__name__})"
            )

            logger.error(
                f"❌ [Extraction] Giving up on document {document_id} after "
                f"{retry_count} attempts ({reason})"
            )

            supabase.table("pipeline_job").update({
                "status": "failed",
                "completed_at": get_now(),
                "metadata": supabase.rpc(
                    "jsonb_set",
                    {
                        "target": "metadata",
                        "path": ["{final_error}"],
                        "new_value": f'"{str(e)}"',
                    }
                ).execute() if hasattr(supabase, 'rpc') else None
            }).eq("id", pipeline_job_id).execute()

        # Don't re-raise - error is handled
        return {
            "status": "failed" if retry_count >= MAX_RETRIES or not is_retryable_error(e) else "retrying",
            "error": str(e),
            "retry_count": retry_count,
        }
