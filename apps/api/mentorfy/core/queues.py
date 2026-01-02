"""
Queue management for document processing pipeline.

Pipeline queues:
- extraction: Manual uploads (file already in Storage)
- ingest_extract: External sources (Google Drive, etc.)
- chunking: Text chunking with contextual retrieval
- kg_ingest: Knowledge graph ingestion
"""
import redis
from rq import Queue
import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Global Redis connection
redis_conn = None

# Pipeline queues
extraction_queue = None
ingest_extract_queue = None
chunking_queue = None
kg_ingest_queue = None

# Queue names
QUEUE_EXTRACTION = "extraction"  # Manual uploads
QUEUE_INGEST_EXTRACT = "ingest_extract"  # External sources (combined phase)
QUEUE_CHUNKING = "chunking"  # All sources
QUEUE_KG_INGEST = "kg_ingest"  # All sources

def get_redis_connection():
    """Get or create Redis connection"""
    global redis_conn
    if redis_conn is None:
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            raise ValueError("REDIS_URL environment variable is required")
        redis_conn = redis.from_url(redis_url)
        logger.info(f"Connected to Redis at {redis_url}")
    return redis_conn

def get_queue(queue_name: str) -> Queue:
    """
    Get or create a queue by name.

    Args:
        queue_name: Name of the queue

    Returns:
        RQ Queue instance
    """
    global extraction_queue, ingest_extract_queue, chunking_queue, kg_ingest_queue

    # Map queue names to their global variables
    queue_map = {
        QUEUE_EXTRACTION: ("extraction_queue", extraction_queue),
        QUEUE_INGEST_EXTRACT: ("ingest_extract_queue", ingest_extract_queue),
        QUEUE_CHUNKING: ("chunking_queue", chunking_queue),
        QUEUE_KG_INGEST: ("kg_ingest_queue", kg_ingest_queue),
    }

    if queue_name not in queue_map:
        raise ValueError(f"Unknown queue: {queue_name}")

    var_name, queue_instance = queue_map[queue_name]

    if queue_instance is None:
        # Set default timeout based on queue type
        timeout = "30m"  # Default 30 minutes
        if queue_name == QUEUE_EXTRACTION:
            timeout = "45m"  # Extraction can be slow (audio/video transcription)
        elif queue_name == QUEUE_INGEST_EXTRACT:
            timeout = "60m"  # Combined phase needs more time
        elif queue_name == QUEUE_KG_INGEST:
            timeout = "20m"  # KG ingestion is typically faster

        queue_instance = Queue(
            queue_name,
            connection=get_redis_connection(),
            default_timeout=timeout
        )

        # Update the global variable
        if var_name == "extraction_queue":
            extraction_queue = queue_instance
        elif var_name == "ingest_extract_queue":
            ingest_extract_queue = queue_instance
        elif var_name == "chunking_queue":
            chunking_queue = queue_instance
        elif var_name == "kg_ingest_queue":
            kg_ingest_queue = queue_instance

    return queue_instance

def enqueue_extraction(
    pipeline_job_id: str,
    document_id: str,
    raw_location: str,
    **kwargs
) -> str:
    """
    Queue extraction for manual uploads (file already in Storage).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        raw_location: Supabase Storage path (e.g., "raw_documents/123.mp4")
        **kwargs: Additional metadata passed to worker
            - source_name: Original filename
            - source_platform: "manual_upload"
            - clerk_org_id: Organization ID
            - file_type: File type label (e.g., "mp3", "pdf")

    Returns:
        Job ID

    Examples:
        >>> enqueue_extraction(
        ...     pipeline_job_id="550e8400-e29b-41d4-a716-446655440000",
        ...     document_id="123e4567-e89b-12d3-a456-426614174000",
        ...     raw_location="raw_documents/123e4567-e89b-12d3-a456-426614174000.mp4",
        ...     source_name="lecture.mp4",
        ...     source_platform="manual_upload",
        ...     clerk_org_id="org_456",
        ...     file_type="mp4"
        ... )
    """
    q = get_queue(QUEUE_EXTRACTION)

    job_id = f"extract_{pipeline_job_id}"

    job = q.enqueue(
        "mentorfy.workers.extraction_worker.extract_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        raw_location=raw_location,
        **kwargs,
        job_id=job_id,
        description=f"Extracting {kwargs.get('source_name', 'Unknown file')}"
    )

    logger.info(
        f"Enqueued extraction for document {document_id} "
        f"(pipeline_job={pipeline_job_id}) as job {job.id}"
    )
    return job.id


def enqueue_ingest_extract(
    pipeline_job_id: str,
    document_id: str,
    source_location: str,
    **kwargs
) -> str:
    """
    Queue combined ingest+extract for external sources.

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        source_location: External URL (e.g., "gdrive://file_xyz", "youtube://video_123")
        **kwargs: Additional metadata passed to worker
            - source_name: Original filename
            - source_platform: "google_drive", "youtube", etc.
            - clerk_org_id: Organization ID
            - file_type: File type label
            - store_raw: Whether to store raw file (default False)

    Returns:
        Job ID

    Examples:
        >>> enqueue_ingest_extract(
        ...     pipeline_job_id="550e8400-e29b-41d4-a716-446655440000",
        ...     document_id="123e4567-e89b-12d3-a456-426614174000",
        ...     source_location="gdrive://1a2b3c4d5e6f",
        ...     source_name="presentation.pdf",
        ...     source_platform="google_drive",
        ...     clerk_org_id="org_456",
        ...     file_type="pdf",
        ...     store_raw=False
        ... )
    """
    q = get_queue(QUEUE_INGEST_EXTRACT)

    job_id = f"ingest_extract_{pipeline_job_id}"

    job = q.enqueue(
        "mentorfy.workers.ingest_extract_worker.ingest_extract_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        source_location=source_location,
        **kwargs,
        job_id=job_id,
        description=f"Ingesting+Extracting {kwargs.get('source_name', 'Unknown file')}"
    )

    logger.info(
        f"Enqueued ingest+extract for document {document_id} "
        f"(pipeline_job={pipeline_job_id}) from {source_location} as job {job.id}"
    )
    return job.id


def enqueue_chunking(
    pipeline_job_id: str,
    document_id: str,
    text_location: str,
    **kwargs
) -> str:
    """
    Queue chunking (all sources converge here).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        text_location: Supabase Storage path to extracted text
        **kwargs: Additional metadata passed to worker
            - source_name: Original filename
            - source_platform: Source platform
            - clerk_org_id: Organization ID

    Returns:
        Job ID

    Examples:
        >>> enqueue_chunking(
        ...     pipeline_job_id="550e8400-e29b-41d4-a716-446655440000",
        ...     document_id="123e4567-e89b-12d3-a456-426614174000",
        ...     text_location="extracted_text/123e4567-e89b-12d3-a456-426614174000.txt",
        ...     source_name="document.pdf",
        ...     source_platform="google_drive",
        ...     clerk_org_id="org_456"
        ... )
    """
    q = get_queue(QUEUE_CHUNKING)

    job_id = f"chunk_{pipeline_job_id}"

    job = q.enqueue(
        "mentorfy.workers.chunking_worker.chunk_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        text_location=text_location,
        **kwargs,
        job_id=job_id,
        description=f"Chunking {kwargs.get('source_name', 'Unknown file')}"
    )

    logger.info(
        f"Enqueued chunking for document {document_id} "
        f"(pipeline_job={pipeline_job_id}) as job {job.id}"
    )
    return job.id


def enqueue_kg_ingest(
    pipeline_job_id: str,
    document_id: str,
    **kwargs
) -> str:
    """
    Queue KG ingestion (all sources converge here).

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        **kwargs: Additional metadata passed to worker
            - source_name: Original filename
            - source_platform: Source platform
            - clerk_org_id: Organization ID

    Returns:
        Job ID

    Examples:
        >>> enqueue_kg_ingest(
        ...     pipeline_job_id="550e8400-e29b-41d4-a716-446655440000",
        ...     document_id="123e4567-e89b-12d3-a456-426614174000",
        ...     source_name="document.pdf",
        ...     source_platform="google_drive",
        ...     clerk_org_id="org_456"
        ... )
    """
    q = get_queue(QUEUE_KG_INGEST)

    job_id = f"kg_{pipeline_job_id}"

    job = q.enqueue(
        "mentorfy.workers.kg_worker.ingest_kg_task",
        pipeline_job_id=pipeline_job_id,
        document_id=document_id,
        **kwargs,
        job_id=job_id,
        description=f"KG ingesting {kwargs.get('source_name', 'Unknown file')}"
    )

    logger.info(
        f"Enqueued KG ingest for document {document_id} "
        f"(pipeline_job={pipeline_job_id}) as job {job.id}"
    )
    return job.id