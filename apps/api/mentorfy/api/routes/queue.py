"""
Queue Management Routes

API endpoints for queue and job management:
- Queue documents for batch processing
- Get job status
- Get queue statistics
"""

import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from rq.job import Job

from mentorfy.api.schemas import (
    BatchProcessRequest,
    JobResponse,
    JobStatus,
)
from mentorfy.core.queues import (
    get_redis_connection,
    get_queue,
    QUEUE_EXTRACTION,
    QUEUE_INGEST_EXTRACT,
    QUEUE_CHUNKING,
    QUEUE_KG_INGEST,
)
from mentorfy.core.pipeline_helpers import enqueue_pipeline_job


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue", tags=["queue"])


def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    """Get the status of a specific job by ID"""
    redis_conn = get_redis_connection()
    job = Job.fetch(job_id, connection=redis_conn)

    if not job:
        return None

    return {
        "job_id": job_id,
        "status": job.get_status(),
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
        "result": job.result,
        "error": str(job.exc_info) if job.exc_info else None,
        "progress": job.meta.get("progress", 0) if hasattr(job, "meta") else 0
    }


def get_queue_stats() -> Dict[str, Any]:
    """Get statistics for all pipeline queues"""
    stats = {}

    for queue_name in [QUEUE_EXTRACTION, QUEUE_INGEST_EXTRACT, QUEUE_CHUNKING, QUEUE_KG_INGEST]:
        q = get_queue(queue_name)
        stats[queue_name] = {
            "pending": len(q),
            "started": q.started_job_registry.count,
            "finished": q.finished_job_registry.count,
            "failed": q.failed_job_registry.count,
            "deferred": q.deferred_job_registry.count,
            "scheduled": q.scheduled_job_registry.count
        }

    return stats


@router.post("/process-documents")
async def queue_process_documents(request: BatchProcessRequest):
    """Queue multiple documents for processing"""
    try:
        job_responses = []

        for doc in request.documents:
            doc_dict = doc.dict()

            result = enqueue_pipeline_job(
                document_id=doc_dict["document_id"],
                source_platform=doc_dict.get("source_type", "manual_upload"),
                clerk_org_id=doc_dict.get("organization_id"),
                source_name=doc_dict.get("file_name", "Unknown"),
                file_type=doc_dict.get("file_type", "unknown"),
                raw_location=doc_dict.get("storage_path"),
                source_location=doc_dict.get("source_location"),
                user_id=doc_dict.get("user_id"),
            )

            job_responses.append(
                JobResponse(
                    job_id=result["job_id"],
                    document_id=doc.document_id,
                    status="queued"
                )
            )

        logger.info(f"Queued {len(request.documents)} documents for processing")

        return {
            "message": f"Queued {len(request.documents)} documents for processing",
            "jobs": [job.dict() for job in job_responses],
            "queue_stats": get_queue_stats(),
        }

    except Exception as e:
        logger.error(f"Error queueing documents: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to queue documents: {str(e)}"
        )


@router.get("/job/{job_id}", response_model=JobStatus)
async def get_job_status_endpoint(job_id: str):
    """Get the status of a specific processing job"""
    try:
        job_status = get_job_status(job_id)

        if not job_status:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        return JobStatus(**job_status)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get job status: {str(e)}"
        )


@router.get("/stats")
async def get_queue_stats_endpoint():
    """Get current queue statistics for all pipeline queues"""
    try:
        return get_queue_stats()
    except Exception as e:
        logger.error(f"Error getting queue stats: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get queue stats: {str(e)}"
        )
