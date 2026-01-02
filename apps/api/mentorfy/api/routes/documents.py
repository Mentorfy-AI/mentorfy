"""
Document Management Routes

This module contains document management API endpoints:
- Single document deletion
- Batch document deletion

These routes handle document deletion operations, ensuring both
database records and knowledge graph entries are properly cleaned up.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from supabase import Client

from mentorfy.api.schemas import (
    DocumentDeleteRequest,
    DocumentDeleteResponse,
    BatchDeleteRequest,
    BatchDeleteResponse,
)
from mentorfy.utils.deletion import delete_documents_batch, delete_document_complete


# Set up logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/documents", tags=["documents"])

# Global Supabase client (set by main app)
supabase_client: Optional[Client] = None


def set_supabase_client(client: Client):
    """Set the global Supabase client for this router"""
    global supabase_client
    supabase_client = client


@router.delete("/batch", response_model=BatchDeleteResponse)
async def batch_delete_documents(request: BatchDeleteRequest):
    """
    Batch delete multiple documents from both Graphiti and Supabase

    This endpoint:
    1. Accepts multiple document IDs
    2. Uses optimized batch deletion for efficiency:
       - Single query to fetch all documents
       - Single query to fetch all episode mappings
       - Parallel deletion of episodes from Graphiti
       - Single Supabase delete call for all documents
    3. Aggregates results and returns counts

    Used by folder deletion and bulk document operations to ensure all documents
    go through the same knowledge graph cleanup process.
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase service not available")

    if not request.document_ids or len(request.document_ids) == 0:
        raise HTTPException(
            status_code=400, detail="No documents specified for deletion"
        )

    # Limit batch operations to prevent abuse
    if len(request.document_ids) > 100:
        raise HTTPException(
            status_code=400, detail="Cannot delete more than 100 documents at once"
        )

    try:
        logger.info(
            f"🗑️  Batch delete request for {len(request.document_ids)} documents "
            f"(Org: {request.organization_id})"
        )

        deleted_count, errors = await delete_documents_batch(
            supabase_client, request.document_ids, request.organization_id
        )

        if errors:
            logger.warning(f"Batch delete completed with {len(errors)} error(s)")

        return BatchDeleteResponse(
            success=deleted_count > 0,
            deleted_count=deleted_count,
            errors=errors if errors else None,
        )

    except ValueError as e:
        logger.warning(f"Validation error in batch deletion: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Batch delete endpoint error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error in batch deletion: {str(e)}"
        )


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(document_id: str, request: DocumentDeleteRequest):
    """
    Delete a document from both Graphiti and Supabase

    This endpoint:
    1. Verifies document ownership (org_id)
    2. Deletes episode from Graphiti (cascades orphan node deletion)
    3. Soft deletes document from Supabase

    The episode UUID is retrieved from source_metadata during the process.

    IMPORTANT: This route MUST come after /batch to avoid path conflicts.
    FastAPI matches routes in order, so /batch must be defined before /{document_id}.
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase service not available")

    try:
        # Validate organization match
        if request.document_id != document_id:
            raise HTTPException(
                status_code=400, detail="Document ID mismatch in request"
            )

        logger.info(
            f"🗑️  Delete request for document {document_id} "
            f"(Org: {request.organization_id})"
        )

        # Perform complete deletion
        await delete_document_complete(
            supabase_client, document_id, request.organization_id
        )

        return DocumentDeleteResponse(
            success=True,
            document_id=document_id,
            message=f"Document {document_id} successfully deleted from Graphiti and marked as deleted in Supabase",
        )

    except ValueError as e:
        logger.warning(f"Validation error during deletion: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"❌ Error deleting document {document_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting document: {str(e)}"
        )
