"""
Document deletion handlers for Graphiti knowledge graph
Handles cascading deletion of episodes and related nodes
"""
import asyncio
import logging
from typing import Optional, List
from datetime import datetime, timezone

from mentorfy.db.neo4j import get_graphiti_client

logger = logging.getLogger(__name__)


async def cancel_pipeline_jobs_for_document(
    supabase_client,
    document_id: str,
    org_id: str
) -> int:
    """
    Cancel any in-flight pipeline jobs for a document.

    Marks pipeline_job and all related pipeline_phase records as cancelled
    to prevent workers from processing them further.

    IMPORTANT: This only marks jobs as cancelled in the database. It does NOT
    cancel jobs already enqueued in Redis/RQ because RQ doesn't support remote
    job cancellation well. Instead, workers check job status at startup and
    skip processing if the job was cancelled or deleted. This means:
    - Active workers will complete their current task (can't be stopped mid-flight)
    - Queued workers will check status and skip processing when they start
    - Delayed retry jobs will check status and skip when they run

    This is acceptable because:
    1. Worker check happens before any expensive operations (download, transcription)
    2. Worst case: worker runs briefly, checks DB, then exits cleanly
    3. All phase records are marked cancelled, preventing downstream phases

    Args:
        supabase_client: Supabase client instance
        document_id: Document ID to cancel jobs for
        org_id: Organization ID for verification

    Returns:
        Number of pipeline jobs cancelled
    """
    try:
        logger.info(f"🚫 Cancelling pipeline jobs for document {document_id}")

        # Find all active pipeline jobs for this document
        jobs_result = (
            supabase_client.table("pipeline_job")
            .select("id, status, current_phase")
            .eq("document_id", document_id)
            .eq("clerk_org_id", org_id)
            .in_("status", ["processing", "pending"])  # Only cancel active jobs
            .execute()
        )

        if not jobs_result.data:
            logger.info(f"No active pipeline jobs found for document {document_id}")
            return 0

        pipeline_job_ids = [job["id"] for job in jobs_result.data]
        logger.info(
            f"Found {len(pipeline_job_ids)} active pipeline job(s) to cancel: {pipeline_job_ids}"
        )

        # Cancel all pipeline jobs
        now = datetime.now(timezone.utc).isoformat()
        (
            supabase_client.table("pipeline_job")
            .update({
                "status": "cancelled",
                "completed_at": now,
            })
            .in_("id", pipeline_job_ids)
            .execute()
        )

        # Cancel all related pipeline phases
        (
            supabase_client.table("pipeline_phase")
            .update({
                "status": "cancelled",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error_message": "Document was deleted"
            })
            .in_("pipeline_job_id", pipeline_job_ids)
            .in_("status", ["queued", "processing"])  # Only cancel active phases
            .execute()
        )

        logger.info(
            f"✅ Cancelled {len(pipeline_job_ids)} pipeline job(s) and their phases "
            f"for document {document_id}"
        )

        return len(pipeline_job_ids)

    except Exception as e:
        logger.error(f"❌ Error cancelling pipeline jobs for document {document_id}: {e}")
        # Don't raise - deletion should continue even if cancellation fails
        return 0


async def delete_document_from_graphiti(
    document_id: str,
    episode_uuid: str,
    org_id: str
) -> bool:
    """
    Delete a document's episode and associated nodes from Graphiti

    Args:
        document_id: The document ID for logging
        episode_uuid: The episode UUID to delete
        org_id: Organization ID for audit logging

    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        graphiti_client = get_graphiti_client()

        logger.info(
            f"🗑️  Deleting episode {episode_uuid} for document {document_id} "
            f"(Org: {org_id})"
        )

        # Remove the episode - Graphiti handles cascading deletions of orphan nodes
        result = await graphiti_client.remove_episode(episode_uuid)

        logger.info(
            f"✅ Successfully deleted episode {episode_uuid} for document {document_id}"
        )

        return True

    except Exception as e:
        # If episode doesn't exist, that's fine - just log and continue
        if "not found" in str(e).lower():
            logger.warning(
                f"⚠️  Episode {episode_uuid} not found in Neo4j (may not have been created). Continuing with Supabase deletion."
            )
            return True
        else:
            logger.error(
                f"❌ Error deleting episode {episode_uuid} for document {document_id}: {e}"
            )
            raise


async def delete_document_from_supabase(
    supabase_client,
    document_id: str,
    org_id: str
) -> bool:
    """
    Delete document record from Supabase

    Args:
        supabase_client: Supabase client instance
        document_id: Document ID to delete
        org_id: Organization ID for verification

    Returns:
        True if deletion was successful
    """
    try:
        logger.info(f"📋 Deleting document {document_id} from Supabase")

        # Hard delete the document record
        result = (
            supabase_client.table("document")
            .eq("id", document_id)
            .eq("clerk_org_id", org_id)  # Organization isolation
            .delete()
            .execute()
        )

        logger.info(f"✅ Successfully deleted document {document_id} from Supabase")
        return True

    except Exception as e:
        logger.error(f"❌ Error deleting document {document_id} from Supabase: {e}")
        raise


async def delete_document_complete(
    supabase_client,
    document_id: str,
    org_id: str
) -> bool:
    """
    Perform complete document deletion from both Graphiti and Supabase

    Steps:
    1. Verify document exists and organization match
    2. Cancel any in-flight pipeline jobs
    3. Query episode_mappings for all episodes linked to this document
    4. Delete all episodes from Graphiti (cascades to orphan nodes)
    5. Delete document from Supabase

    Args:
        supabase_client: Supabase client instance
        document_id: Document ID to delete
        org_id: Organization ID

    Returns:
        True if deletion was successful
    """
    try:
        logger.info(f"🗑️  Starting complete deletion for document {document_id}")

        # Step 1: Verify document exists
        result = (
            supabase_client.table("document")
            .select("clerk_org_id")
            .eq("id", document_id)
            .execute()
        )

        if not result.data:
            logger.error(f"❌ Document {document_id} not found")
            raise ValueError(f"Document {document_id} not found")

        doc_org_id = result.data[0].get("clerk_org_id")

        # Verify organization isolation
        if doc_org_id != org_id:
            logger.error(
                f"❌ Organization mismatch for document {document_id}: "
                f"expected {org_id}, got {doc_org_id}"
            )
            raise ValueError("Organization mismatch - cannot delete document")

        # Step 2: Cancel any in-flight pipeline jobs
        await cancel_pipeline_jobs_for_document(supabase_client, document_id, org_id)

        # Step 3: Query kg_entity_mapping for all entities linked to this document
        mappings = (
            supabase_client.table("kg_entity_mapping")
            .select("entity_id, provider")
            .eq("document_id", document_id)
            .eq("organization_id", org_id)
            .execute()
        )

        entity_ids = [m["entity_id"] for m in mappings.data] if mappings.data else []

        # Step 4: Delete all entities from knowledge graph (Graphiti for now)
        if entity_ids:
            logger.info(f"Found {len(entity_ids)} KG entities to delete for document {document_id}")
            for entity_id in entity_ids:
                await delete_document_from_graphiti(document_id, entity_id, org_id)
        else:
            logger.warning(
                f"⚠️  No episodes found in mappings for document {document_id}, "
                f"skipping Graphiti deletion"
            )

        # Step 5: Delete from Supabase
        await delete_document_from_supabase(supabase_client, document_id, org_id)

        logger.info(f"✅ Complete deletion successful for document {document_id}")
        return True

    except Exception as e:
        logger.error(f"❌ Error in complete document deletion: {e}")
        raise


async def delete_documents_batch(
    supabase_client,
    document_ids: list,
    org_id: str
) -> tuple:
    """
    Perform batch deletion of multiple documents efficiently

    Optimizations:
    1. Verifies all documents belong to organization
    2. Cancels all in-flight pipeline jobs in batch
    3. Queries all episode_mappings in a single call using IN clause
    4. Deletes all Graphiti episodes in parallel using asyncio
    5. Deletes all documents in a single Supabase call using IN clause

    Args:
        supabase_client: Supabase client instance
        document_ids: List of document IDs to delete
        org_id: Organization ID

    Returns:
        Tuple of (deleted_count, errors_list)
    """
    if not document_ids:
        return 0, []

    try:
        logger.info(f"🗑️  Starting batch deletion for {len(document_ids)} documents")

        # Step 1: Verify all documents exist and belong to org
        docs_result = (
            supabase_client.table("document")
            .select("id, clerk_org_id")
            .in_("id", document_ids)
            .execute()
        )

        if not docs_result.data or len(docs_result.data) != len(document_ids):
            missing_docs = set(document_ids) - {d["id"] for d in docs_result.data}
            logger.warning(f"⚠️  Some documents not found: {missing_docs}")

        # Verify all retrieved docs belong to the org
        for doc in docs_result.data:
            if doc.get("clerk_org_id") != org_id:
                raise ValueError(
                    f"Organization mismatch for document {doc['id']}: "
                    f"expected {org_id}, got {doc.get('clerk_org_id')}"
                )

        # Step 2: Cancel all in-flight pipeline jobs for these documents
        cancellation_tasks = [
            cancel_pipeline_jobs_for_document(supabase_client, doc_id, org_id)
            for doc_id in document_ids
        ]
        cancellation_results = await asyncio.gather(*cancellation_tasks, return_exceptions=True)
        total_cancelled = sum(r for r in cancellation_results if isinstance(r, int))
        logger.info(f"✅ Cancelled {total_cancelled} total pipeline job(s) across {len(document_ids)} documents")

        # Step 3: Query all kg_entity_mapping in a single call
        mappings_result = (
            supabase_client.table("kg_entity_mapping")
            .select("document_id, entity_id, provider")
            .in_("document_id", document_ids)
            .eq("organization_id", org_id)
            .execute()
        )

        # Group entities by document and provider
        entities_by_doc = {}
        all_entities = []
        if mappings_result.data:
            for mapping in mappings_result.data:
                doc_id = mapping["document_id"]
                entity_id = mapping["entity_id"]
                provider = mapping.get("provider", "graphiti")  # Default to graphiti for backwards compat
                if doc_id not in entities_by_doc:
                    entities_by_doc[doc_id] = []
                entities_by_doc[doc_id].append(entity_id)
                all_entities.append((doc_id, entity_id, provider))

        # Step 4: Delete all entities from knowledge graph in parallel
        # TODO: Add support for multiple KG providers (Supermemory, etc.)
        # For now, only Graphiti is supported. Raise error for other providers.
        if all_entities:
            logger.info(f"Found {len(all_entities)} KG entities to delete across {len(document_ids)} documents")

            # Filter for Graphiti entities and validate no unsupported providers
            graphiti_entities = []
            unsupported_providers = set()

            for doc_id, entity_id, provider in all_entities:
                if provider == "graphiti":
                    graphiti_entities.append((doc_id, entity_id))
                else:
                    unsupported_providers.add(provider)

            if unsupported_providers:
                raise ValueError(
                    f"Unsupported KG providers found: {unsupported_providers}. "
                    f"Only 'graphiti' is currently supported."
                )

            delete_tasks = [
                delete_document_from_graphiti(doc_id, entity_id, org_id)
                for doc_id, entity_id in graphiti_entities
            ]
            results = await asyncio.gather(*delete_tasks, return_exceptions=True)

            # Log any errors but continue
            errors = [str(r) for r in results if isinstance(r, Exception)]
            if errors:
                logger.warning(f"⚠️  Some episode deletions failed: {errors}")

        # Step 5: Delete all documents from Supabase in a single call
        logger.info(f"📋 Deleting {len(document_ids)} documents from Supabase")
        try:
            delete_result = (
                supabase_client.table("document")
                .delete()
                .in_("id", document_ids)
                .eq("clerk_org_id", org_id)
                .execute()
            )
            logger.info(f"✅ Batch deletion successful for {len(document_ids)} documents")
        except Exception as db_error:
            logger.error(f"❌ Database delete error: {db_error}")
            logger.error(f"Delete result data: {delete_result if 'delete_result' in locals() else 'N/A'}")
            raise

        return len(document_ids), []

    except Exception as e:
        logger.error(f"❌ Error in batch document deletion: {e}")
        raise
