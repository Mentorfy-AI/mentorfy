"""
File Utilities

This module provides utilities for file type detection and processing mode determination.
Used to optimize processing for audio/video files (skip storage, direct transcription)
vs standard documents (upload to storage, standard processing).
"""

from typing import Literal

# Type definitions
ProcessingMode = Literal["direct_transcription", "standard_document"]

# Constants
MAX_AUDIO_VIDEO_SIZE = 1200 * 1024 * 1024  # 1200MB limit for audio/video
MAX_DOCUMENT_SIZE = 50 * 1024 * 1024  # 50MB limit for documents

# Supported audio MIME types
AUDIO_MIME_TYPES = {
    "audio/mpeg",  # MP3
    "audio/mp4",  # M4A
    "audio/wav",  # WAV
    "audio/flac",  # FLAC
    "audio/ogg",  # OGG
    "audio/opus",  # OPUS
    "audio/x-m4a",  # M4A (alternative)
    "audio/x-wav",  # WAV (alternative)
}

# Supported video MIME types
VIDEO_MIME_TYPES = {
    "video/mp4",  # MP4
    "video/quicktime",  # MOV
    "video/x-msvideo",  # AVI
    "video/x-matroska",  # MKV
    "video/webm",  # WEBM
    "video/mpeg",  # MPEG
}

# Supported document MIME types (for reference)
DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
    "application/msword",  # DOC
    "text/plain",  # TXT
    "application/vnd.google-apps.document",  # Google Docs
}

# Supported subtitle MIME types (for reference)
SUBTITLE_MIME_TYPES = {
    "text/vtt",  # VTT (WebVTT subtitle format)
    "text/srt",  # SRT (SubRip subtitle format)
    "application/x-subrip",  # SRT (alternative MIME type)
}


def is_audio_video_file(mime_type: str) -> bool:
    """
    Check if file is audio or video that should skip storage and use direct transcription.

    Audio/video files are processed differently:
    - Downloaded directly from source (Google Drive)
    - Transcribed with Deepgram
    - Chunks created from transcript
    - Original file never stored in Supabase Storage
    - Saves storage costs and processing time

    Args:
        mime_type: MIME type of the file (e.g., "audio/mpeg", "video/mp4")

    Returns:
        True if file is audio/video that should use direct transcription

    Examples:
        >>> is_audio_video_file("audio/mpeg")
        True
        >>> is_audio_video_file("video/mp4")
        True
        >>> is_audio_video_file("application/pdf")
        False
    """
    # Check explicit MIME types first (most accurate)
    if mime_type in AUDIO_MIME_TYPES or mime_type in VIDEO_MIME_TYPES:
        return True

    # Fallback: check if MIME type starts with audio/ or video/
    # This catches edge cases where specific MIME type isn't in our list
    return mime_type.startswith("audio/") or mime_type.startswith("video/")


def is_document_file(mime_type: str) -> bool:
    """
    Check if file is a standard document (PDF, DOCX, TXT, etc.).

    Document files use standard processing:
    - Uploaded to Supabase Storage
    - Processed by worker
    - Text extracted and chunked

    Args:
        mime_type: MIME type of the file

    Returns:
        True if file is a standard document

    Examples:
        >>> is_document_file("application/pdf")
        True
        >>> is_document_file("text/plain")
        True
        >>> is_document_file("audio/mpeg")
        False
    """
    return mime_type in DOCUMENT_MIME_TYPES


def is_subtitle_file(mime_type: str) -> bool:
    """
    Check if file is a subtitle file (VTT, SRT).

    Subtitle files are treated as documents:
    - Uploaded to Supabase Storage
    - Text extracted directly (no transcription needed)
    - Chunked like regular documents

    Args:
        mime_type: MIME type of the file

    Returns:
        True if file is a subtitle file

    Examples:
        >>> is_subtitle_file("text/vtt")
        True
        >>> is_subtitle_file("text/srt")
        True
        >>> is_subtitle_file("video/mp4")
        False
    """
    return mime_type in SUBTITLE_MIME_TYPES


def get_processing_mode(mime_type: str) -> ProcessingMode:
    """
    Determine processing mode based on file type.

    Processing modes:

    1. "direct_transcription": Audio/video files
       - Skip Supabase Storage upload
       - Download directly from source (e.g., Google Drive)
       - Transcribe with Deepgram
       - Create chunks from transcript
       - Store transcript in document metadata
       - Delete temp file after processing
       - Benefits: Faster, cheaper, no storage limits

    2. "standard_document": Documents, subtitles, and other files
       - Upload to Supabase Storage
       - Process via worker
       - Extract text and chunk
       - Benefits: Reliable, retryable from storage

    Args:
        mime_type: MIME type of the file

    Returns:
        Processing mode: "direct_transcription" or "standard_document"

    Examples:
        >>> get_processing_mode("audio/mpeg")
        'direct_transcription'
        >>> get_processing_mode("video/mp4")
        'direct_transcription'
        >>> get_processing_mode("application/pdf")
        'standard_document'
        >>> get_processing_mode("text/plain")
        'standard_document'
    """
    if is_audio_video_file(mime_type):
        return "direct_transcription"
    else:
        return "standard_document"


def validate_file_size(file_size_bytes: int, mime_type: str) -> tuple[bool, str | None]:
    """
    Validate file size based on type.

    Size limits:
    - Audio/video: 750MB (prevents excessive transcription time/cost)
    - Documents: 50MB (Supabase storage limit considerations)

    Args:
        file_size_bytes: Size of file in bytes
        mime_type: MIME type of the file

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if file size is acceptable
        - error_message: None if valid, error string if invalid

    Examples:
        >>> validate_file_size(10 * 1024 * 1024, "audio/mpeg")  # 10MB MP3
        (True, None)
        >>> validate_file_size(600 * 1024 * 1024, "audio/mpeg")  # 600MB MP3
        (False, 'File too large: 600.0 MB exceeds maximum of 500 MB for audio/video files')
        >>> validate_file_size(10 * 1024 * 1024, "application/pdf")  # 10MB PDF
        (True, None)
    """
    size_mb = file_size_bytes / (1024 * 1024)

    if is_audio_video_file(mime_type):
        max_size = MAX_AUDIO_VIDEO_SIZE
        file_type = "audio/video"
    else:
        max_size = MAX_DOCUMENT_SIZE
        file_type = "document"

    if file_size_bytes > max_size:
        max_size_mb = max_size / (1024 * 1024)
        return (
            False,
            f"File too large: {size_mb:.1f} MB exceeds maximum of {max_size_mb:.0f} MB for {file_type} files",
        )

    return True, None


def get_file_extension(mime_type: str, filename: str = "") -> str:
    """
    Get file extension from MIME type or filename.

    Args:
        mime_type: MIME type of the file
        filename: Optional filename to extract extension from

    Returns:
        File extension with leading dot (e.g., ".mp3", ".pdf")
        Returns empty string if extension cannot be determined

    Examples:
        >>> get_file_extension("audio/mpeg", "song.mp3")
        '.mp3'
        >>> get_file_extension("application/pdf", "")
        '.pdf'
        >>> get_file_extension("audio/mpeg", "")
        '.mp3'
    """
    # First try to get extension from filename
    if filename:
        from pathlib import Path

        ext = Path(filename).suffix
        if ext:
            return ext

    # Fallback: map MIME type to extension
    mime_to_ext = {
        # Audio
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/wav": ".wav",
        "audio/flac": ".flac",
        "audio/ogg": ".ogg",
        "audio/opus": ".opus",
        "audio/x-m4a": ".m4a",
        "audio/x-wav": ".wav",
        # Video
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/x-matroska": ".mkv",
        "video/webm": ".webm",
        "video/mpeg": ".mpeg",
        # Documents
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/msword": ".doc",
        "text/plain": ".txt",
        "application/vnd.google-apps.document": ".docx",
        # Subtitles
        "text/vtt": ".vtt",
        "text/srt": ".srt",
        "application/x-subrip": ".srt",
    }

    return mime_to_ext.get(mime_type, "")


def get_file_type_label(mime_type: str) -> str:
    """
    Get human-readable file type label from MIME type.

    Used for document.file_type field in database.

    Args:
        mime_type: MIME type of the file

    Returns:
        File type label (e.g., "mp3", "pdf", "docx")

    Examples:
        >>> get_file_type_label("audio/mpeg")
        'mp3'
        >>> get_file_type_label("video/mp4")
        'mp4'
        >>> get_file_type_label("application/pdf")
        'pdf'
    """
    mime_to_type = {
        # Audio
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/flac": "flac",
        "audio/ogg": "ogg",
        "audio/opus": "opus",
        "audio/x-m4a": "m4a",
        "audio/x-wav": "wav",
        # Video
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/x-msvideo": "avi",
        "video/x-matroska": "mkv",
        "video/webm": "webm",
        "video/mpeg": "mpeg",
        # Documents
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/msword": "doc",
        "text/plain": "txt",
        "application/vnd.google-apps.document": "gdoc",
        # Subtitles
        "text/vtt": "vtt",
        "text/srt": "srt",
        "application/x-subrip": "srt",
    }

    return mime_to_type.get(mime_type, "unknown")
