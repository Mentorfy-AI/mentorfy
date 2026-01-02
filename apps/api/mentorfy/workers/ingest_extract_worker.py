"""
Ingest+Extract Worker (Phased Pipeline V2)

Handles combined ingestion+extraction phase for external sources (Google Drive, etc.).
This is the KEY OPTIMIZATION: file stays in-memory between download and extraction.

Flow:
1. Create ingestion phase record (status="processing")
2. Download from external source (Google Drive) → in-memory
3. Complete ingestion phase (output_location=null for in-memory)
4. Create extraction phase record (status="processing")
5. Extract text from in-memory file data
6. Store extracted text in Storage (extracted_text/)
7. OPTIONAL: Store raw file if store_raw=True kwarg
8. Complete extraction phase
9. Update pipeline_job
10. Enqueue chunking phase

External sources supported:
- Google Drive (gdrive://file_id)
- YouTube (youtube://video_id) - future
- Slack (slack://message_id) - future
"""

import os
import sys
import logging
import asyncio
import tempfile
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from pathlib import Path

import io

from rq import get_current_job
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Supabase client
from mentorfy.utils.storage import (
    store_extracted_text,
    store_raw_document,
    get_supabase_client
)
from mentorfy.utils.file_utils import (
    is_audio_video_file,
    get_file_extension,
    get_file_type_label
)
from mentorfy.services.extraction import transcribe_audio_video, extract_document_text
from mentorfy.core.queues import enqueue_chunking, get_queue, QUEUE_INGEST_EXTRACT
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
    format="%(asctime)s - [ingest_extract] - %(levelname)s - %(message)s",
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
    # Fetch current metadata
    result = supabase.table("pipeline_job").select("metadata").eq("id", pipeline_job_id).execute()
    current_metadata = result.data[0]["metadata"] if result.data and result.data[0].get("metadata") else {}

    # Merge
    merged = {**current_metadata, **new_metadata}

    # Update
    supabase.table("pipeline_job").update({
        "metadata": merged,
        "updated_at": get_now(),
    }).eq("id", pipeline_job_id).execute()


async def ingest_extract_task(
    pipeline_job_id: str,
    document_id: str,
    source_location: str,
    file_type: str,
    retry_count: int = 0,
    parent_ingest_phase_id: str = None,
    parent_extract_phase_id: str = None,
    **kwargs
):
    """
    Combined ingest+extract task for external sources.

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        source_location: External URL (e.g., "gdrive://file_xyz")
        file_type: File type label (e.g., "mp3", "pdf")
        retry_count: Current retry attempt (0 = first attempt, 1-3 = retries)
        parent_ingest_phase_id: ID of parent ingestion phase if this is a retry
        parent_extract_phase_id: ID of parent extraction phase if this is a retry
        **kwargs: Additional metadata
            - source_name: Original filename
            - source_platform: "google_drive", "youtube", etc.
            - clerk_org_id: Organization ID
            - store_raw: Whether to store raw file (default False)

    Phase records created:
    - ingestion: status="completed", output_location=null (in-memory)
    - extraction: status="completed", output_location="extracted_text/{id}.txt"

    Next phase:
    - Enqueues chunking phase

    Retry behavior:
    - On retryable error: Creates new queued phase and enqueues retry with backoff
    - Delays and max retries configured in mentorfy.core.retry_policy
    """
    job = get_current_job()
    ingest_phase_id = None
    extract_phase_id = None

    source_name = kwargs.get("source_name", "Unknown file")
    source_platform = kwargs.get("source_platform", "unknown")
    clerk_org_id = kwargs.get("clerk_org_id")
    user_id = kwargs.get("user_id")  # Required for Google Drive OAuth
    store_raw = kwargs.get("store_raw", False)

    logger.info(
        f"📦 [Ingest+Extract] Starting for document {document_id} "
        f"(pipeline_job={pipeline_job_id}, source={source_platform}, file={source_name})"
    )

    supabase = get_supabase_client()

    try:
        # ========================================================================
        # DEFENSIVE CHECK: Verify pipeline_job still exists
        # ========================================================================
        # This prevents FK constraint violations when retries run after the
        # document/job was deleted. If the job is gone, silently exit.
        job_check = (
            supabase.table("pipeline_job")
            .select("id, status")
            .eq("id", pipeline_job_id)
            .execute()
        )

        if not job_check.data:
            logger.warning(
                f"⚠️ Pipeline job {pipeline_job_id} no longer exists. "
                f"Document may have been deleted. Skipping processing."
            )
            return {
                "status": "skipped",
                "reason": "pipeline_job_not_found",
                "document_id": document_id,
            }

        # Check if job was cancelled
        job_status = job_check.data[0]["status"]
        if job_status == "cancelled":
            logger.warning(
                f"⚠️ Pipeline job {pipeline_job_id} was cancelled. Skipping processing."
            )
            return {
                "status": "skipped",
                "reason": "pipeline_job_cancelled",
                "document_id": document_id,
            }

        # Clear retry metadata if this is a retry attempt (so frontend doesn't show stale "Retrying in...")
        if retry_count > 0:
            update_job_metadata(supabase, pipeline_job_id, {
                "retry_at": None,
                "retry_count": retry_count,
                "last_error": None,
            })
            logger.info(f"🔄 Retry {retry_count} starting, cleared retry_at metadata")

        # ========================================================================
        # INGESTION PHASE
        # ========================================================================

        # 1. Create ingestion phase record
        now = datetime.now(timezone.utc)
        ingestion_timeout = get_phase_timeout('extraction')  # Use extraction timeout for ingestion too

        ingest_phase_result = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "ingestion",
            "status": "processing",
            "input_location": source_location,
            "retry_count": retry_count,
            "parent_phase_id": parent_ingest_phase_id,
            "started_at": now.isoformat(),
            "expected_completion_at": (now + timedelta(seconds=ingestion_timeout)).isoformat(),
        }).execute()

        ingest_phase_id = ingest_phase_result.data[0]["id"]
        logger.info(f"✅ Created ingestion phase record: {ingest_phase_id}")

        if job:
            job.meta["progress"] = 10
            job.save_meta()

        # 2. Download from external source (in-memory)
        logger.info(f"📥 Downloading from {source_platform}: {source_location}")

        if source_location.startswith("gdrive://"):
            file_data, mime_type = await _download_from_google_drive(
                source_location=source_location,
                clerk_org_id=clerk_org_id,
                user_id=user_id,
                supabase=supabase
            )
        else:
            raise ValueError(f"Unsupported source platform: {source_location}")

        file_size_mb = len(file_data) / (1024 * 1024)
        logger.info(f"✅ Downloaded {file_size_mb:.1f} MB (in-memory)")

        if job:
            job.meta["progress"] = 30
            job.save_meta()

        # 3. Complete ingestion phase (no output_location - kept in-memory)
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": get_now(),
            "output_location": None,  # In-memory, not stored
            "metadata": {
                "file_size_mb": file_size_mb,
                "mime_type": mime_type,
            }
        }).eq("id", ingest_phase_id).execute()

        logger.info(f"✅ Completed ingestion phase: {ingest_phase_id} (in-memory)")

        # ========================================================================
        # EXTRACTION PHASE
        # ========================================================================

        # Update pipeline_job to reflect we're now in extraction phase
        supabase.table("pipeline_job").update({
            "current_phase": "extraction",
            "updated_at": get_now(),
        }).eq("id", pipeline_job_id).execute()

        # 4. Create extraction phase record
        extraction_now = datetime.now(timezone.utc)
        extraction_timeout = get_phase_timeout('extraction')

        extract_phase_result = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "extraction",
            "status": "processing",
            "input_location": source_location,  # Original source
            "retry_count": retry_count,
            "parent_phase_id": parent_extract_phase_id,
            "started_at": extraction_now.isoformat(),
            "expected_completion_at": (extraction_now + timedelta(seconds=extraction_timeout)).isoformat(),
        }).execute()

        extract_phase_id = extract_phase_result.data[0]["id"]
        logger.info(f"✅ Created extraction phase record: {extract_phase_id}")

        if job:
            job.meta["progress"] = 40
            job.save_meta()

        # 5. Extract text from in-memory file data
        logger.info(f"📝 Extracting text from {file_type} file...")

        if is_audio_video_file(mime_type):
            # Audio/video → Deepgram transcription
            text_content = await transcribe_audio_video(file_data, mime_type)
        else:
            # Documents/subtitles → Text extraction
            text_content = await extract_document_text(file_data, mime_type)

        text_length = len(text_content)
        word_count = len(text_content.split())
        logger.info(f"✅ Extracted {text_length} chars, {word_count} words")

        # Handle empty extraction - mark as completed (not failed) since there's nothing to process
        if text_length == 0 or word_count == 0:
            logger.warning(
                f"⚠️ Extraction produced no text content. "
                f"For audio/video files, this usually means the file has no speech. "
                f"File: {source_name}, MIME: {mime_type}"
            )

            # Complete extraction phase with empty result
            supabase.table("pipeline_phase").update({
                "status": "completed",
                "completed_at": get_now(),
                "output_location": None,
                "metadata": {
                    "empty_extraction": True,
                    "reason": "No text content extracted (file may have no speech or readable text)",
                }
            }).eq("id", extract_phase_id).execute()

            # Mark pipeline job as completed (nothing to chunk or ingest)
            supabase.table("pipeline_job").update({
                "current_phase": "completed",
                "status": "completed",
                "completed_at": get_now(),
                "updated_at": get_now(),
            }).eq("id", pipeline_job_id).execute()

            # Update document status
            supabase.table("document").update({
                "status": "available_to_ai",
                "updated_at": get_now(),
            }).eq("id", document_id).execute()

            logger.info(f"✅ Pipeline completed (empty extraction - no content to process)")

            return {
                "status": "success",
                "document_id": document_id,
                "empty_extraction": True,
                "message": "File processed but contained no extractable text content",
            }

        if job:
            job.meta["progress"] = 70
            job.save_meta()

        # 6. Store extracted text
        logger.info(f"💾 Storing extracted text...")
        text_location = await store_extracted_text(document_id, text_content)
        logger.info(f"✅ Stored text at: {text_location}")

        # 7. OPTIONAL: Store raw file (controlled by kwarg)
        raw_location = None
        if store_raw:
            logger.info(f"💾 Storing raw file (store_raw=True)...")
            file_ext = get_file_extension(mime_type, source_name)
            raw_location = await store_raw_document(document_id, file_data, file_ext)
            logger.info(f"✅ Stored raw file at: {raw_location}")

        if job:
            job.meta["progress"] = 85
            job.save_meta()

        # 8. Complete extraction phase
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": get_now(),
            "output_location": text_location,
            "metadata": {
                "text_length": text_length,
                "word_count": word_count,
                "raw_stored": store_raw,
                "raw_location": raw_location,
            }
        }).eq("id", extract_phase_id).execute()

        logger.info(f"✅ Completed extraction phase: {extract_phase_id}")

        # 9. Update pipeline_job
        supabase.table("pipeline_job").update({
            "current_phase": "chunking",
            "updated_at": get_now(),
        }).eq("id", pipeline_job_id).execute()

        if job:
            job.meta["progress"] = 95
            job.save_meta()

        # 10. Enqueue chunking phase
        logger.info(f"📤 Enqueuing chunking phase...")
        enqueue_chunking(
            pipeline_job_id=pipeline_job_id,
            document_id=document_id,
            text_location=text_location,
            source_name=source_name,
            source_platform=source_platform,
            clerk_org_id=clerk_org_id,
        )

        if job:
            job.meta["progress"] = 100
            job.save_meta()

        logger.info(
            f"✅ [Ingest+Extract] Complete for document {document_id} "
            f"({text_length} chars extracted, raw_stored={store_raw})"
        )

        return {
            "status": "success",
            "document_id": document_id,
            "text_length": text_length,
            "word_count": word_count,
            "raw_stored": store_raw,
        }

    except Exception as e:
        logger.error(f"❌ [Ingest+Extract] Failed for document {document_id}: {e}", exc_info=True)

        # ========================================================================
        # Error Handling: Mark phases as failed
        # ========================================================================
        if ingest_phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
                "error_type": type(e).__name__,
                "completed_at": get_now(),
            }).eq("id", ingest_phase_id).execute()

        if extract_phase_id:
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "error_message": str(e),
                "error_type": type(e).__name__,
                "completed_at": get_now(),
            }).eq("id", extract_phase_id).execute()

        # ========================================================================
        # Retry Decision: Should we retry or give up?
        # ========================================================================
        if retry_count < MAX_RETRIES and is_retryable_error(e):
            # RETRY: Schedule retry with backoff
            delay = get_retry_delay(retry_count, error=e)
            next_retry = retry_count + 1

            logger.info(
                f"🔄 [Ingest+Extract] Scheduling retry {next_retry}/{MAX_RETRIES} "
                f"in {delay}s for job {pipeline_job_id} (error: {type(e).__name__})"
            )

            # Create queued retry phases (linked to failed phases)
            now = datetime.now(timezone.utc)

            # Queued ingestion retry phase
            retry_ingest_phase = supabase.table("pipeline_phase").insert({
                "pipeline_job_id": pipeline_job_id,
                "phase": "ingestion",
                "status": "queued",
                "parent_phase_id": ingest_phase_id,
                "retry_count": next_retry,
                "input_location": source_location,
                "queued_at": (now + timedelta(seconds=delay)).isoformat(),
            }).execute()

            # Queued extraction retry phase
            retry_extract_phase = supabase.table("pipeline_phase").insert({
                "pipeline_job_id": pipeline_job_id,
                "phase": "extraction",
                "status": "queued",
                "parent_phase_id": extract_phase_id,
                "retry_count": next_retry,
                "input_location": source_location,
                "queued_at": (now + timedelta(seconds=delay)).isoformat(),
            }).execute()

            logger.info(
                f"✅ Created queued retry phases: "
                f"ingestion={retry_ingest_phase.data[0]['id']}, "
                f"extraction={retry_extract_phase.data[0]['id']}"
            )

            # Update job with retry info so frontend can show "Retrying in Xm"
            retry_at = (now + timedelta(seconds=delay)).isoformat()
            update_job_metadata(supabase, pipeline_job_id, {
                "retry_at": retry_at,
                "retry_count": next_retry,
                "last_error": str(e)[:500],
            })

            # Enqueue retry job with delay
            queue = get_queue(QUEUE_INGEST_EXTRACT)
            queue.enqueue_in(
                timedelta(seconds=delay),
                ingest_extract_task,
                pipeline_job_id=pipeline_job_id,
                document_id=document_id,
                source_location=source_location,
                file_type=file_type,
                retry_count=next_retry,
                parent_ingest_phase_id=ingest_phase_id,
                parent_extract_phase_id=extract_phase_id,
                **kwargs
            )

            logger.info(f"✅ Enqueued retry {next_retry} for ingest+extract (delay: {delay}s)")

        else:
            # GIVE UP: Mark job as permanently failed
            reason = (
                f"max retries ({MAX_RETRIES}) exceeded"
                if retry_count >= MAX_RETRIES
                else f"non-retryable error ({type(e).__name__})"
            )

            logger.error(
                f"❌ [Ingest+Extract] Giving up on document {document_id} after "
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


# ============================================================================
# Helper Functions
# ============================================================================


async def _download_from_google_drive(
    source_location: str,
    clerk_org_id: str,
    user_id: str,
    supabase
) -> tuple[bytes, str]:
    """
    Download file from Google Drive.

    Args:
        source_location: "gdrive://file_id"
        clerk_org_id: Organization ID for OAuth tokens
        user_id: User ID for OAuth tokens (must match token owner)
        supabase: Supabase client

    Returns:
        Tuple of (file_data, mime_type)
    """
    # Extract file ID from source_location
    file_id = source_location.replace("gdrive://", "")

    logger.info(f"Fetching Google Drive file: {file_id}")

    # Get user's Google Drive tokens for this organization
    # CRITICAL: Must query by BOTH user_id AND org_id because multiple users
    # in the same org can have tokens. Using wrong user's tokens causes
    # 'unauthorized_client' errors when accessing Google Drive.
    token_result = (
        supabase.table("google_drive_tokens")
        .select("*")
        .eq("clerk_org_id", clerk_org_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not token_result.data:
        raise ValueError(
            f"No Google Drive tokens found for user {user_id} in organization {clerk_org_id}. "
            f"User must re-authenticate Google Drive in this organization."
        )

    if len(token_result.data) > 1:
        logger.warning(
            f"Found {len(token_result.data)} token rows for user {user_id} in org {clerk_org_id}. "
            f"Using first row. This shouldn't happen with composite primary key."
        )

    token_data = token_result.data[0]

    # Initialize Google Drive client
    credentials = Credentials(
        token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    )

    drive_service = build("drive", "v3", credentials=credentials)

    # Get file metadata
    file_metadata = drive_service.files().get(
        fileId=file_id,
        fields="id, name, mimeType, size"
    ).execute()

    mime_type = file_metadata["mimeType"]
    file_name = file_metadata["name"]
    expected_size = int(file_metadata.get("size", 0))  # Size in bytes (0 for Google Docs)

    logger.info(f"File: {file_name}, MIME: {mime_type}, Expected size: {expected_size} bytes")

    # Handle Google Docs (export as DOCX)
    if mime_type == "application/vnd.google-apps.document":
        logger.info(f"Exporting Google Doc as DOCX: {file_name}")
        file_content = drive_service.files().export_media(
            fileId=file_id,
            mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ).execute()
        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        # Google Docs exports don't have a pre-known size, skip verification
    else:
        # Use chunked download for reliability - single-shot get_media() truncates large files
        # MediaIoBaseDownload handles network interruptions and provides progress tracking
        request = drive_service.files().get_media(fileId=file_id)
        file_buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(file_buffer, request, chunksize=50 * 1024 * 1024)  # 50MB chunks

        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                logger.info(f"Download progress: {int(status.progress() * 100)}%")

        file_content = file_buffer.getvalue()

        # Verify download completeness - truncated downloads cause MP4 corruption
        actual_size = len(file_content)
        if expected_size > 0 and actual_size != expected_size:
            raise ValueError(
                f"Google Drive download incomplete: expected {expected_size} bytes, "
                f"got {actual_size} bytes ({actual_size / expected_size * 100:.1f}%). "
                f"File '{file_name}' may be corrupted."
            )

    logger.info(f"✅ Downloaded {len(file_content)} bytes from Google Drive")

    return file_content, mime_type


