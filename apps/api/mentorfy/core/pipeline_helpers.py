"""
Pipeline Helper Functions

Utilities for creating and enqueuing pipeline jobs.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from mentorfy.utils.storage import get_supabase_client
from mentorfy.core.queues import (
    enqueue_extraction,
    enqueue_ingest_extract,
)

logger = logging.getLogger(__name__)


def get_now():
    """Get current UTC timestamp"""
    return datetime.now(timezone.utc).isoformat()


def create_pipeline_job(
    document_id: str,
    source_platform: str,
    clerk_org_id: str,
    source_name: str,
    **metadata
) -> str:
    """
    Create a pipeline_job record.

    Args:
        document_id: UUID of document
        source_platform: "manual_upload", "google_drive", etc.
        clerk_org_id: Organization ID
        source_name: Original filename
        **metadata: Additional metadata to store in JSONB

    Returns:
        Pipeline job ID
    """
    supabase = get_supabase_client()

    job_data = {
        "document_id": document_id,
        "clerk_org_id": clerk_org_id,
        "current_phase": "ingestion" if source_platform != "manual_upload" else "extraction",
        "status": "processing",
        "started_at": get_now(),
        "metadata": {
            "source_name": source_name,
            "source_platform": source_platform,
            **metadata
        }
    }

    result = supabase.table("pipeline_job").insert(job_data).execute()

    if not result.data:
        raise ValueError("Failed to create pipeline_job record")

    pipeline_job_id = result.data[0]["id"]
    logger.info(f"Created pipeline_job: {pipeline_job_id} for document {document_id}")

    return pipeline_job_id


def create_skipped_ingestion_phase(pipeline_job_id: str) -> None:
    """
    Create a skipped ingestion phase record for manual uploads.

    Args:
        pipeline_job_id: UUID of pipeline_job
    """
    supabase = get_supabase_client()

    phase_data = {
        "pipeline_job_id": pipeline_job_id,
        "phase": "ingestion",
        "status": "skipped",
        "queued_at": get_now(),
        "completed_at": get_now(),
        "metadata": {"reason": "manual_upload"}
    }

    supabase.table("pipeline_phase").insert(phase_data).execute()
    logger.info(f"Created skipped ingestion phase for job {pipeline_job_id}")


def enqueue_pipeline_job(
    document_id: str,
    source_platform: str,
    clerk_org_id: str,
    source_name: str,
    file_type: str,
    raw_location: Optional[str] = None,
    source_location: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Create pipeline job and enqueue for processing.

    Args:
        document_id: UUID of document
        source_platform: "manual_upload", "google_drive", etc.
        clerk_org_id: Organization ID
        source_name: Original filename
        file_type: File type label (e.g., "mp3", "pdf")
        raw_location: Storage path for manual uploads (e.g., "raw_documents/123.mp4")
        source_location: External URL for imports (e.g., "gdrive://file_xyz")
        **kwargs: Additional metadata
            - store_raw: Whether to store raw file (default False)
            - user_id: User ID for OAuth token lookup

    Returns:
        Dict with pipeline_job_id and job_id
    """
    # Create pipeline job
    pipeline_job_id = create_pipeline_job(
        document_id=document_id,
        source_platform=source_platform,
        clerk_org_id=clerk_org_id,
        source_name=source_name,
        store_raw=kwargs.get("store_raw", False)
    )

    if source_platform == "manual_upload":
        # Manual upload path: skip ingestion -> extraction
        if not raw_location:
            raise ValueError("raw_location required for manual uploads")

        create_skipped_ingestion_phase(pipeline_job_id)

        job_id = enqueue_extraction(
            pipeline_job_id=pipeline_job_id,
            document_id=document_id,
            raw_location=raw_location,
            source_name=source_name,
            source_platform=source_platform,
            clerk_org_id=clerk_org_id,
            file_type=file_type
        )

        logger.info(
            f"Enqueued extraction (manual upload): {job_id}, "
            f"file_type='{file_type}', raw_location='{raw_location}'"
        )

    else:
        # External source path: combined ingest+extract
        if not source_location:
            raise ValueError("source_location required for external sources")

        job_id = enqueue_ingest_extract(
            pipeline_job_id=pipeline_job_id,
            document_id=document_id,
            source_location=source_location,
            source_name=source_name,
            source_platform=source_platform,
            clerk_org_id=clerk_org_id,
            file_type=file_type,
            store_raw=kwargs.get("store_raw", False),
            user_id=kwargs.get("user_id")  # Required for Google Drive OAuth token lookup
        )

        logger.info(f"Enqueued ingest+extract (external source): {job_id}")

    return {
        "pipeline_job_id": pipeline_job_id,
        "job_id": job_id
    }
