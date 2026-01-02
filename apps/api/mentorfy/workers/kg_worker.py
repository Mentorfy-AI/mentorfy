"""
KG Ingest Worker (Phased Pipeline V2)

Handles knowledge graph ingestion phase - the final phase where chunks are added to Graphiti.

Flow:
1. Load chunks from document_chunk table
2. For each chunk, add episode to Graphiti with:
   - Combined context + content for embedding (Anthropic pattern)
   - Organization-level isolation (group_id)
   - Provenance tracking in kg_entity_mapping
3. Update pipeline_phase and pipeline_job records
4. Mark pipeline as completed

KG Provider: Graphiti (Neo4j-backed knowledge graph)
Organization Isolation: Uses group_id for multi-tenant separation
"""

import os
import sys
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from rq import get_current_job

# Supabase client
from mentorfy.utils.storage import get_supabase_client
from mentorfy.db.neo4j import get_graphiti_client
from mentorfy.core.retry_policy import (
    get_phase_timeout,
    is_retryable_error,
    get_retry_delay,
    MAX_RETRIES,
    PartialIngestError,
)

# Configure logging for worker process (RQ forks don't inherit logging config)
# Use stdout so Railway doesn't treat INFO logs as errors
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [kg_ingest] - %(levelname)s - %(message)s",
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


async def ingest_kg_task(
    pipeline_job_id: str,
    document_id: str,
    retry_count: int = 0,
    parent_phase_id: str = None,
    **kwargs
):
    """
    KG ingestion task - adds chunks to Graphiti knowledge graph.

    Args:
        pipeline_job_id: UUID of pipeline_job
        document_id: UUID of document
        retry_count: Current retry attempt (0 = first attempt, 1-3 = retries)
        parent_phase_id: ID of parent phase if this is a retry
        **kwargs: Additional metadata
            - source_name: Original filename
            - source_platform: Source platform
            - clerk_org_id: Organization ID (for KG isolation)

    Phase records created:
    - kg_ingest: status="completed"

    Final state:
    - pipeline_job: status="completed", current_phase="completed"

    Retry behavior:
    - On retryable error: Creates new queued phase and enqueues retry with backoff
    - Delays and max retries configured in mentorfy.core.retry_policy
    """
    job = get_current_job()
    phase_id = None

    source_name = kwargs.get("source_name", "Unknown file")
    clerk_org_id = kwargs.get("clerk_org_id")

    logger.info(
        f"🧠 [KG Ingest] Starting for document {document_id} "
        f"(pipeline_job={pipeline_job_id}, org={clerk_org_id})"
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
        # 1. Create KG ingest phase record
        # ========================================================================
        now = datetime.now(timezone.utc)
        timeout_seconds = get_phase_timeout('kg_ingest')

        phase_result = supabase.table("pipeline_phase").insert({
            "pipeline_job_id": pipeline_job_id,
            "phase": "kg_ingest",
            "status": "processing",
            "input_location": None,  # Chunks from DB, not Storage
            "retry_count": retry_count,
            "parent_phase_id": parent_phase_id,
            "started_at": now.isoformat(),
            "expected_completion_at": (now + timedelta(seconds=timeout_seconds)).isoformat(),
        }).execute()

        phase_id = phase_result.data[0]["id"]
        logger.info(f"✅ Created KG ingest phase record: {phase_id}")

        if job:
            job.meta["progress"] = 10
            job.save_meta()

        # ========================================================================
        # 2. Load chunks from database
        # ========================================================================
        logger.info(f"📥 Loading chunks for document {document_id}...")
        chunks_result = (
            supabase.table("document_chunk")
            .select("*")
            .eq("document_id", document_id)
            .order("chunk_index")
            .execute()
        )

        chunks = chunks_result.data
        if not chunks:
            raise ValueError(f"No chunks found for document {document_id}")

        chunk_count = len(chunks)
        logger.info(f"✅ Loaded {chunk_count} chunks")

        if job:
            job.meta["progress"] = 20
            job.save_meta()

        # ========================================================================
        # 3. Get document metadata for KG context
        # ========================================================================
        doc_result = (
            supabase.table("document")
            .select("title, created_at")
            .eq("id", document_id)
            .single()
            .execute()
        )

        document_title = doc_result.data.get("title", source_name) if doc_result.data else source_name
        document_created_at = doc_result.data.get("created_at") if doc_result.data else None

        # ========================================================================
        # 4. Initialize Graphiti client
        # ========================================================================
        logger.info(f"🔗 Initializing Graphiti client...")
        graphiti_client = get_graphiti_client()

        if not graphiti_client:
            raise ValueError("Failed to initialize Graphiti client")

        # ========================================================================
        # 5. Add chunks to Graphiti with provenance tracking (concurrent)
        # ========================================================================
        kg_max_concurrent_str = os.getenv("KG_MAX_CONCURRENT")
        if not kg_max_concurrent_str:
            raise ValueError("KG_MAX_CONCURRENT environment variable is required")
        kg_max_concurrent = int(kg_max_concurrent_str)

        logger.info(f"🧠 Adding {chunk_count} chunks to knowledge graph (max {kg_max_concurrent} concurrent)...")

        episode_ids = []
        semaphore = asyncio.Semaphore(kg_max_concurrent)

        async def add_chunk_to_kg(chunk: Dict[str, Any]) -> str | None:
            """Add a single chunk to Graphiti, return episode_id or None on failure"""
            async with semaphore:
                try:
                    # Combine context + content for embedding (Anthropic contextual retrieval pattern)
                    embedding_text = f"{chunk['context']}\n\n{chunk['content']}"

                    result = await graphiti_client.add_episode(
                        name=f"{document_title} - Chunk {chunk['chunk_index']}",
                        episode_body=embedding_text,
                        source_description=chunk['context'],
                        reference_time=document_created_at or datetime.now(timezone.utc),
                        group_id=clerk_org_id  # Organization-level isolation
                    )

                    # Extract episode UUID
                    episode_id = result.episode.uuid if hasattr(result, "episode") else None

                    if episode_id:
                        # Track provenance in kg_entity_mapping
                        supabase.table("kg_entity_mapping").insert({
                            "organization_id": clerk_org_id,
                            "document_id": document_id,
                            "entity_id": episode_id,
                            "provider": "graphiti",
                            "entity_type": "episode",
                            "source_chunk_ids": [chunk['id']]
                        }).execute()

                    return episode_id

                except Exception as chunk_error:
                    logger.warning(
                        f"⚠️ Failed to add chunk {chunk['chunk_index']} to KG: {chunk_error}"
                    )
                    return None

        # Run all chunks concurrently with semaphore limiting
        results = await asyncio.gather(
            *[add_chunk_to_kg(chunk) for chunk in chunks],
            return_exceptions=True
        )

        # Collect successful episode IDs
        for result in results:
            if isinstance(result, str):  # Valid episode_id
                episode_ids.append(result)
            elif isinstance(result, Exception):
                logger.warning(f"⚠️ Chunk failed with exception: {result}")

        episode_count = len(episode_ids)
        failed_count = chunk_count - episode_count
        logger.info(f"✅ Added {episode_count}/{chunk_count} episodes to knowledge graph")

        if job:
            job.meta["progress"] = 85
            job.save_meta()

        # ========================================================================
        # 5b. Check for partial failure - fail if any chunks didn't make it
        # ========================================================================
        if failed_count > 0:
            logger.warning(
                f"⚠️ Partial failure detected: {failed_count}/{chunk_count} chunks failed. "
                f"Cleaning up {episode_count} successfully created episodes before retry..."
            )

            # Clean up: delete kg_entity_mapping entries for this document
            # This prevents duplicates on retry
            supabase.table("kg_entity_mapping").delete().eq(
                "document_id", document_id
            ).execute()
            logger.info(f"🧹 Deleted kg_entity_mapping entries for document {document_id}")

            # Clean up: delete the episodes from Neo4j that were successfully created
            if episode_ids and graphiti_client:
                for episode_id in episode_ids:
                    try:
                        await graphiti_client.remove_episode(episode_id)
                    except Exception as delete_error:
                        logger.warning(f"⚠️ Failed to remove episode {episode_id}: {delete_error}")
                logger.info(f"🧹 Removed {len(episode_ids)} episodes from Neo4j")

            # Update phase with partial results before failing
            supabase.table("pipeline_phase").update({
                "status": "failed",
                "completed_at": get_now(),
                "error_message": f"Partial failure: {failed_count}/{chunk_count} chunks failed to ingest",
                "error_type": "PartialIngestFailure",
                "metadata": {
                    "episode_count": episode_count,
                    "chunk_count": chunk_count,
                    "failed_count": failed_count,
                    "cleaned_up_episodes": len(episode_ids),
                }
            }).eq("id", phase_id).execute()

            # Raise to trigger retry logic (PartialIngestError is retryable)
            raise PartialIngestError(
                f"Partial KG ingest failure: {failed_count}/{chunk_count} chunks failed. "
                f"Cleaned up {episode_count} episodes. Retry will re-process all chunks."
            )

        # ========================================================================
        # 6. Complete KG ingest phase
        # ========================================================================
        supabase.table("pipeline_phase").update({
            "status": "completed",
            "completed_at": get_now(),
            "output_location": None,  # Entities in Neo4j, not Storage
            "metadata": {
                "episode_count": episode_count,  # Episodes added (each can create 0+ entities)
                "chunk_count": chunk_count,
                "episode_ids": episode_ids[:10],  # Store first 10 for reference
            }
        }).eq("id", phase_id).execute()

        logger.info(f"✅ Completed KG ingest phase: {phase_id}")

        # ========================================================================
        # 7. Update pipeline_job - MARK AS COMPLETED
        # ========================================================================
        supabase.table("pipeline_job").update({
            "current_phase": "completed",
            "status": "completed",
            "completed_at": get_now(),
            "updated_at": get_now(),
        }).eq("id", pipeline_job_id).execute()

        logger.info(f"✅ Pipeline job completed: {pipeline_job_id}")

        if job:
            job.meta["progress"] = 100
            job.save_meta()

        logger.info(
            f"✅ [KG Ingest] Complete for document {document_id} "
            f"({episode_count} episodes added)"
        )

        return {
            "status": "success",
            "document_id": document_id,
            "episode_count": episode_count,  # Episodes added (not entities - those are created by Graphiti)
            "chunk_count": chunk_count,
        }

    except Exception as e:
        logger.error(f"❌ [KG Ingest] Failed for document {document_id}: {e}", exc_info=True)

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
                f"🔄 [KG Ingest] Scheduling retry {next_retry}/{MAX_RETRIES} "
                f"in {delay}s for job {pipeline_job_id} (error: {type(e).__name__})"
            )

            # Create queued retry phase (linked to failed phase)
            now = datetime.now(timezone.utc)
            retry_phase = supabase.table("pipeline_phase").insert({
                "pipeline_job_id": pipeline_job_id,
                "phase": "kg_ingest",
                "status": "queued",
                "parent_phase_id": phase_id,
                "retry_count": next_retry,
                "input_location": None,
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
            from mentorfy.core.queues import get_queue, QUEUE_KG_INGEST
            queue = get_queue(QUEUE_KG_INGEST)
            queue.enqueue_in(
                timedelta(seconds=delay),
                ingest_kg_task,
                pipeline_job_id=pipeline_job_id,
                document_id=document_id,
                retry_count=next_retry,
                parent_phase_id=phase_id,
                **kwargs
            )

            logger.info(f"✅ Enqueued retry {next_retry} for KG ingest (delay: {delay}s)")

        else:
            # GIVE UP: Mark job as permanently failed
            reason = (
                f"max retries ({MAX_RETRIES}) exceeded"
                if retry_count >= MAX_RETRIES
                else f"non-retryable error ({type(e).__name__})"
            )

            logger.error(
                f"❌ [KG Ingest] Giving up on document {document_id} after "
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
