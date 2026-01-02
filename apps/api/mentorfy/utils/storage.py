"""
Storage Utilities

Utilities for storing and retrieving files from Supabase Storage.
Used by the phased pipeline for managing extracted text and raw documents.
"""

import os
from typing import Optional
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """
    Get initialized Supabase client.

    Returns:
        Supabase client instance

    Raises:
        ValueError: If required environment variables are not set
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
        )

    return create_client(supabase_url, supabase_key)


async def store_extracted_text(document_id: str, text: str) -> str:
    """
    Store extracted text in Supabase Storage.

    Used by extraction workers to store text output after processing
    documents (transcripts from audio/video, extracted text from PDFs, etc.).

    Args:
        document_id: UUID of the document
        text: Extracted text content to store

    Returns:
        Storage path (e.g., "extracted_text/123e4567-e89b-12d3-a456-426614174000.txt")

    Raises:
        Exception: If storage upload fails

    Examples:
        >>> path = await store_extracted_text("123e4567-e89b-12d3-a456-426614174000", "Hello world")
        >>> print(path)
        'extracted_text/123e4567-e89b-12d3-a456-426614174000.txt'
    """
    supabase = get_supabase_client()
    path = f"extracted_text/{document_id}.txt"

    # Upload text as UTF-8 encoded bytes (upsert to handle retries)
    supabase.storage.from_("documents").upload(
        path,
        text.encode("utf-8"),
        file_options={
            "content-type": "text/plain; charset=utf-8",
            "upsert": "true"  # Overwrite if exists (handles retries)
        }
    )

    return path


async def load_extracted_text(text_location: str) -> str:
    """
    Load extracted text from Supabase Storage.

    Used by chunking workers to retrieve extracted text for processing.

    Args:
        text_location: Storage path (e.g., "extracted_text/123.txt")
                      Should be the value returned by store_extracted_text()

    Returns:
        Text content as string

    Raises:
        Exception: If storage download fails or file not found

    Examples:
        >>> text = await load_extracted_text("extracted_text/123e4567-e89b-12d3-a456-426614174000.txt")
        >>> print(text)
        'Hello world'
    """
    supabase = get_supabase_client()

    # Download file from storage
    data = supabase.storage.from_("documents").download(text_location)

    # Decode UTF-8 bytes to string
    return data.decode("utf-8")


async def store_raw_document(
    document_id: str,
    file_data: bytes,
    file_extension: str
) -> str:
    """
    Store raw document file in Supabase Storage.

    Used by ingest_extract worker when store_raw=True kwarg is set.
    This is optional for external sources - only used when we want to
    preserve the original file (e.g., for expensive-to-reprocess files
    like long audio/video recordings).

    Args:
        document_id: UUID of the document
        file_data: Raw file bytes
        file_extension: File extension with leading dot (e.g., ".mp4", ".pdf")
                       Can be obtained from file_utils.get_file_extension()

    Returns:
        Storage path (e.g., "raw_documents/123e4567-e89b-12d3-a456-426614174000.mp4")

    Raises:
        Exception: If storage upload fails

    Examples:
        >>> path = await store_raw_document(
        ...     "123e4567-e89b-12d3-a456-426614174000",
        ...     audio_bytes,
        ...     ".mp3"
        ... )
        >>> print(path)
        'raw_documents/123e4567-e89b-12d3-a456-426614174000.mp3'
    """
    supabase = get_supabase_client()

    # Remove leading dot from extension if present
    ext = file_extension.lstrip(".")
    path = f"raw_documents/{document_id}.{ext}"

    # Upload raw file (upsert to handle retries)
    supabase.storage.from_("documents").upload(
        path,
        file_data,
        file_options={"upsert": "true"}  # Overwrite if exists (handles retries)
    )

    return path


async def load_raw_document(raw_location: str) -> bytes:
    """
    Load raw document from Supabase Storage.

    Used by extraction workers to retrieve uploaded files for processing.

    Args:
        raw_location: Storage path (e.g., "raw_documents/123.mp4")
                     For manual uploads, this comes from document.source_metadata.raw_location

    Returns:
        Raw file bytes

    Raises:
        Exception: If storage download fails or file not found

    Examples:
        >>> file_data = await load_raw_document("raw_documents/123e4567-e89b-12d3-a456-426614174000.mp4")
        >>> print(len(file_data))
        52428800  # 50MB
    """
    supabase = get_supabase_client()

    # Download file from storage
    return supabase.storage.from_("documents").download(raw_location)


async def get_storage_url(storage_path: str, expires_in: int = 3600) -> str:
    """
    Get signed URL for a file in Supabase Storage.

    Useful for generating temporary download links for files.

    Args:
        storage_path: Path to file in storage (e.g., "raw_documents/123.mp4")
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Signed URL that expires after specified time

    Raises:
        Exception: If URL generation fails

    Examples:
        >>> url = await get_storage_url("raw_documents/123.mp4", expires_in=3600)
        >>> print(url)
        'https://qnkaisqmmgboexzxtybh.supabase.co/storage/v1/object/sign/...'
    """
    supabase = get_supabase_client()

    # Create signed URL
    response = supabase.storage.from_("documents").create_signed_url(
        storage_path,
        expires_in
    )

    return response.get("signedURL")


async def delete_file(storage_path: str) -> None:
    """
    Delete a file from Supabase Storage.

    Used for cleanup operations (e.g., removing failed uploads,
    cleaning up temporary files).

    Args:
        storage_path: Path to file in storage (e.g., "raw_documents/123.mp4")

    Raises:
        Exception: If deletion fails

    Examples:
        >>> await delete_file("raw_documents/123e4567-e89b-12d3-a456-426614174000.mp4")
    """
    supabase = get_supabase_client()

    # Delete file
    supabase.storage.from_("documents").remove([storage_path])
