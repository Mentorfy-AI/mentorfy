"""
Metadata utilities for document processing pipeline

Handles merging of source metadata (from uploads) with processing metadata
to maintain deduplication capabilities while adding processing results.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone


def merge_document_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    processing_results: Dict[str, Any],
    preserve_source: bool = True
) -> Dict[str, Any]:
    """
    Merge processing results with existing source metadata
    
    Args:
        existing_metadata: Current document metadata (may be old flat format or new namespaced)
        processing_results: New processing data to add
        preserve_source: Whether to preserve source namespace (default: True)
    
    Returns:
        Combined metadata with source and processing namespaces
    """
    if not existing_metadata:
        existing_metadata = {}
    
    # Initialize result with namespaced structure
    result = {
        "source": {},
        "processing": {}
    }
    
    # Handle existing metadata based on structure
    if "source" in existing_metadata and "processing" in existing_metadata:
        # Already in new format - preserve both namespaces
        result["source"] = existing_metadata.get("source", {}).copy()
        result["processing"] = existing_metadata.get("processing", {}).copy()
    
    elif "source" in existing_metadata:
        # Partial new format - preserve source, initialize processing
        result["source"] = existing_metadata.get("source", {}).copy()
        result["processing"] = existing_metadata.get("processing", {}).copy()
    
    else:
        # Old flat format - try to identify what belongs where
        result["source"] = extract_source_metadata(existing_metadata)
        result["processing"] = extract_processing_metadata(existing_metadata)
    
    # Add new processing results to processing namespace
    result["processing"].update(processing_results)
    
    # Add timestamp for when this merge occurred
    result["processing"]["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    return result


def extract_source_metadata(flat_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract source-related metadata from flat structure
    
    Identifies Google Drive, upload, and source-related fields
    """
    source_fields = {
        "google_drive_file_id",
        "original_name", 
        "parents",
        "mime_type",
        "uploaded_by",
        "uploaded_at",
        "imported_by",
        "imported_at",
        "folder_context"
    }
    
    source_metadata = {}
    for field in source_fields:
        if field in flat_metadata:
            source_metadata[field] = flat_metadata[field]
    
    return source_metadata


def extract_processing_metadata(flat_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract processing-related metadata from flat structure
    
    Identifies Graphiti, processing, and result-related fields
    """
    processing_fields = {
        "graphiti_ingested_at",
        "content_length",
        "word_count", 
        "entities_extracted",
        "quality_rating",
        "processing_version",
        "last_processed_at",
        "error",
        "failed_at"
    }
    
    processing_metadata = {}
    for field in processing_fields:
        if field in flat_metadata:
            processing_metadata[field] = flat_metadata[field]
    
    return processing_metadata


def is_legacy_metadata(metadata: Dict[str, Any]) -> bool:
    """
    Check if metadata is in legacy flat format
    
    Returns True if metadata lacks the new namespace structure
    """
    if not metadata:
        return True
    
    # If it has both source and processing keys, it's new format
    if "source" in metadata and "processing" in metadata:
        return False
    
    # If it has either source or processing but not both, it's partial migration
    if "source" in metadata or "processing" in metadata:
        return False
    
    # Otherwise it's legacy flat format
    return True


def validate_metadata_structure(metadata: Dict[str, Any]) -> bool:
    """
    Validate that metadata follows expected structure
    
    Returns True if metadata has proper namespace structure
    """
    if not isinstance(metadata, dict):
        return False
    
    # Must have both source and processing namespaces
    if "source" not in metadata or "processing" not in metadata:
        return False
    
    # Both must be dictionaries
    if not isinstance(metadata["source"], dict) or not isinstance(metadata["processing"], dict):
        return False
    
    return True


def create_initial_metadata(source_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create initial metadata structure for new documents
    
    Args:
        source_data: Source information (Google Drive, upload context, etc.)
    
    Returns:
        Properly structured metadata with source data and empty processing namespace
    """
    return {
        "source": source_data.copy(),
        "processing": {}
    }