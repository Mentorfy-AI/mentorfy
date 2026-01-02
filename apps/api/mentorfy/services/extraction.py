"""
Text Extraction Service

Shared utilities for extracting text from documents and audio/video files.
Used by both extraction_worker and ingest_extract_worker.
"""

import os
import logging
import tempfile
from pathlib import Path

from mentorfy.services.transcription_service import TranscriptionService
from mentorfy.utils.text_extraction import ImprovedTextExtractor

logger = logging.getLogger(__name__)


# Extension to MIME type mapping
EXTENSION_TO_MIME = {
    # Audio
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "wav": "audio/wav",
    "flac": "audio/flac",
    "ogg": "audio/ogg",
    "opus": "audio/opus",
    # Video
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "avi": "video/x-msvideo",
    "mkv": "video/x-matroska",
    "webm": "video/webm",
    "mpeg": "video/mpeg",
    # Documents
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "txt": "text/plain",
    "gdoc": "application/vnd.google-apps.document",
    # Subtitles
    "vtt": "text/vtt",
    "srt": "text/srt",
}

# MIME type to extension mapping (for temp files)
MIME_TO_EXTENSION = {
    # Documents
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "text/plain": ".txt",
    "text/vtt": ".vtt",
    "text/srt": ".srt",
    # Audio
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    # Video
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
    "video/mpeg": ".mpeg",
}


def get_mime_type(file_type: str) -> str:
    """
    Convert file type label or MIME type to standardized MIME type.

    Args:
        file_type: File extension label (e.g., "mp3") or full MIME type

    Returns:
        MIME type string
    """
    # If already a MIME type (contains /), return as-is
    if "/" in file_type:
        return file_type

    return EXTENSION_TO_MIME.get(file_type.lower(), "application/octet-stream")


async def transcribe_audio_video(file_data: bytes, mime_type: str) -> str:
    """
    Transcribe audio/video file using Deepgram.

    Writes data to a temp file, transcribes, then cleans up.

    Args:
        file_data: Raw file bytes
        mime_type: MIME type of file (e.g., "video/mp4", "audio/mpeg")

    Returns:
        Transcribed text

    Raises:
        ValueError: If DEEPGRAM_API_KEY not set or unsupported MIME type
    """
    logger.info("Transcribing audio/video with Deepgram...")

    file_ext = MIME_TO_EXTENSION.get(mime_type)
    if not file_ext:
        raise ValueError(f"Unsupported MIME type for transcription: {mime_type}")
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(file_data)
            temp_path = tmp.name

        logger.info(f"Wrote temp file: {temp_path}")

        deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        if not deepgram_api_key:
            raise ValueError("DEEPGRAM_API_KEY environment variable not set")

        transcription_service = TranscriptionService(api_key=deepgram_api_key)
        result = await transcription_service.transcribe_file(temp_path)

        logger.info(
            f"Transcription complete: {result.word_count} words, "
            f"{result.duration_seconds}s, "
            f"${result.metadata.get('estimated_cost_usd', 0):.4f}"
        )

        return result.text

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.debug(f"Deleted temp file: {temp_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")


async def extract_document_text(file_data: bytes, mime_type: str) -> str:
    """
    Extract text from document file (PDF, DOCX, TXT, subtitles).

    Writes data to a temp file, extracts text, then cleans up.

    Args:
        file_data: Raw file bytes
        mime_type: MIME type of file

    Returns:
        Extracted text
    """
    logger.info(f"Extracting text from document (MIME: {mime_type})...")

    file_ext = MIME_TO_EXTENSION.get(mime_type, ".tmp")
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(file_data)
            temp_path = tmp.name

        logger.info(f"Wrote temp file: {temp_path}")

        text_content = ImprovedTextExtractor.extract_text(temp_path, mime_type)

        logger.info(f"Extracted {len(text_content)} chars from document")

        return text_content

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.debug(f"Deleted temp file: {temp_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")
