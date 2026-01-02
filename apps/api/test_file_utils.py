"""
Unit tests for mentorfy.utils.file_utils

Tests audio/video detection logic and processing mode determination
for the skip-storage optimization.
"""

import pytest
from mentorfy.utils.file_utils import (
    is_audio_video_file,
    is_document_file,
    is_subtitle_file,
    get_processing_mode,
    validate_file_size,
    get_file_extension,
    get_file_type_label,
    MAX_AUDIO_VIDEO_SIZE,
    MAX_DOCUMENT_SIZE,
)


class TestAudioVideoDetection:
    """Tests for is_audio_video_file()"""

    def test_audio_mime_types(self):
        """Test all supported audio MIME types are detected"""
        audio_types = [
            "audio/mpeg",  # MP3
            "audio/mp4",  # M4A
            "audio/wav",  # WAV
            "audio/flac",  # FLAC
            "audio/ogg",  # OGG
            "audio/opus",  # OPUS
            "audio/x-m4a",  # M4A alternative
            "audio/x-wav",  # WAV alternative
        ]
        for mime_type in audio_types:
            assert is_audio_video_file(
                mime_type
            ), f"{mime_type} should be detected as audio"

    def test_video_mime_types(self):
        """Test all supported video MIME types are detected"""
        video_types = [
            "video/mp4",  # MP4
            "video/quicktime",  # MOV
            "video/x-msvideo",  # AVI
            "video/x-matroska",  # MKV
            "video/webm",  # WEBM
            "video/mpeg",  # MPEG
        ]
        for mime_type in video_types:
            assert is_audio_video_file(
                mime_type
            ), f"{mime_type} should be detected as video"

    def test_document_mime_types_not_audio_video(self):
        """Test document MIME types are NOT detected as audio/video"""
        document_types = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "text/plain",
            "application/vnd.google-apps.document",
        ]
        for mime_type in document_types:
            assert not is_audio_video_file(
                mime_type
            ), f"{mime_type} should NOT be audio/video"

    def test_subtitle_mime_types_not_audio_video(self):
        """Test subtitle MIME types are NOT detected as audio/video"""
        subtitle_types = [
            "text/vtt",
            "text/srt",
            "application/x-subrip",
        ]
        for mime_type in subtitle_types:
            assert not is_audio_video_file(
                mime_type
            ), f"{mime_type} should NOT be audio/video"

    def test_fallback_detection(self):
        """Test fallback detection for MIME types starting with audio/ or video/"""
        # Test MIME types not explicitly in our list
        assert is_audio_video_file(
            "audio/aac"
        ), "audio/aac should match audio/* fallback"
        assert is_audio_video_file(
            "video/x-flv"
        ), "video/x-flv should match video/* fallback"
        assert not is_audio_video_file(
            "text/html"
        ), "text/html should not match fallback"

    def test_empty_mime_type(self):
        """Test empty MIME type is not detected as audio/video"""
        assert not is_audio_video_file("")
        assert not is_audio_video_file("unknown/type")


class TestDocumentDetection:
    """Tests for is_document_file()"""

    def test_document_detection(self):
        """Test document MIME types are correctly detected"""
        assert is_document_file("application/pdf")
        assert is_document_file(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        assert is_document_file("application/msword")
        assert is_document_file("text/plain")
        assert is_document_file("application/vnd.google-apps.document")

    def test_non_documents(self):
        """Test non-document types return False"""
        assert not is_document_file("audio/mpeg")
        assert not is_document_file("video/mp4")
        assert not is_document_file("text/vtt")


class TestSubtitleDetection:
    """Tests for is_subtitle_file()"""

    def test_subtitle_detection(self):
        """Test subtitle MIME types are correctly detected"""
        assert is_subtitle_file("text/vtt")
        assert is_subtitle_file("text/srt")
        assert is_subtitle_file("application/x-subrip")

    def test_non_subtitles(self):
        """Test non-subtitle types return False"""
        assert not is_subtitle_file("audio/mpeg")
        assert not is_subtitle_file("video/mp4")
        assert not is_subtitle_file("application/pdf")


class TestProcessingMode:
    """Tests for get_processing_mode()"""

    def test_audio_uses_direct_transcription(self):
        """Test audio files use direct_transcription mode"""
        assert get_processing_mode("audio/mpeg") == "direct_transcription"
        assert get_processing_mode("audio/wav") == "direct_transcription"
        assert get_processing_mode("audio/flac") == "direct_transcription"

    def test_video_uses_direct_transcription(self):
        """Test video files use direct_transcription mode"""
        assert get_processing_mode("video/mp4") == "direct_transcription"
        assert get_processing_mode("video/quicktime") == "direct_transcription"
        assert get_processing_mode("video/webm") == "direct_transcription"

    def test_documents_use_standard_processing(self):
        """Test documents use standard_document mode"""
        assert get_processing_mode("application/pdf") == "standard_document"
        assert (
            get_processing_mode(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            == "standard_document"
        )
        assert get_processing_mode("text/plain") == "standard_document"

    def test_subtitles_use_standard_processing(self):
        """Test subtitles use standard_document mode"""
        assert get_processing_mode("text/vtt") == "standard_document"
        assert get_processing_mode("text/srt") == "standard_document"


class TestFileSizeValidation:
    """Tests for validate_file_size()"""

    def test_audio_video_within_limit(self):
        """Test audio/video files within the limit are valid"""
        # 10MB MP3
        is_valid, error = validate_file_size(10 * 1024 * 1024, "audio/mpeg")
        assert is_valid
        assert error is None

        # 700MB MP4
        is_valid, error = validate_file_size(700 * 1024 * 1024, "video/mp4")
        assert is_valid
        assert error is None

    def test_audio_video_exceeds_limit(self):
        """Test audio/video files over the limit are rejected"""
        is_valid, error = validate_file_size(1300 * 1024 * 1024, "audio/mpeg")
        assert not is_valid
        assert error is not None
        assert "1300" in error
        assert "1200 MB" in error
        assert "audio/video" in error

        # 1.3GB MP4
        is_valid, error = validate_file_size(1300 * 1024 * 1024, "video/mp4")
        assert not is_valid
        assert error is not None

    def test_document_within_limit(self):
        """Test documents within 50MB limit are valid"""
        # 10MB PDF
        is_valid, error = validate_file_size(10 * 1024 * 1024, "application/pdf")
        assert is_valid
        assert error is None

        # 49MB DOCX
        is_valid, error = validate_file_size(
            49 * 1024 * 1024,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        assert is_valid
        assert error is None

    def test_document_exceeds_limit(self):
        """Test documents over 50MB limit are rejected"""
        # 60MB PDF
        is_valid, error = validate_file_size(60 * 1024 * 1024, "application/pdf")
        assert not is_valid
        assert error is not None
        assert "60" in error
        assert "50 MB" in error
        assert "document" in error

    def test_zero_size(self):
        """Test zero-size files are valid (edge case)"""
        is_valid, error = validate_file_size(0, "audio/mpeg")
        assert is_valid
        assert error is None

    def test_exact_limits(self):
        """Test files at exact size limits"""
        # Exactly max sized audio
        is_valid, error = validate_file_size(MAX_AUDIO_VIDEO_SIZE, "audio/mpeg")
        assert is_valid
        assert error is None

        # Exactly 50MB document
        is_valid, error = validate_file_size(MAX_DOCUMENT_SIZE, "application/pdf")
        assert is_valid
        assert error is None

        # 1 byte over audio limit
        is_valid, error = validate_file_size(MAX_AUDIO_VIDEO_SIZE + 1, "audio/mpeg")
        assert not is_valid

        # 1 byte over document limit
        is_valid, error = validate_file_size(MAX_DOCUMENT_SIZE + 1, "application/pdf")
        assert not is_valid


class TestFileExtension:
    """Tests for get_file_extension()"""

    def test_extension_from_filename(self):
        """Test extension is extracted from filename when provided"""
        assert get_file_extension("audio/mpeg", "song.mp3") == ".mp3"
        assert get_file_extension("video/mp4", "video.mp4") == ".mp4"
        assert get_file_extension("application/pdf", "document.pdf") == ".pdf"

    def test_extension_from_mime_type(self):
        """Test extension is determined from MIME type when no filename"""
        assert get_file_extension("audio/mpeg", "") == ".mp3"
        assert get_file_extension("audio/wav", "") == ".wav"
        assert get_file_extension("video/mp4", "") == ".mp4"
        assert get_file_extension("application/pdf", "") == ".pdf"

    def test_all_audio_extensions(self):
        """Test all audio MIME types map to correct extensions"""
        assert get_file_extension("audio/mpeg") == ".mp3"
        assert get_file_extension("audio/mp4") == ".m4a"
        assert get_file_extension("audio/wav") == ".wav"
        assert get_file_extension("audio/flac") == ".flac"
        assert get_file_extension("audio/ogg") == ".ogg"
        assert get_file_extension("audio/opus") == ".opus"

    def test_all_video_extensions(self):
        """Test all video MIME types map to correct extensions"""
        assert get_file_extension("video/mp4") == ".mp4"
        assert get_file_extension("video/quicktime") == ".mov"
        assert get_file_extension("video/x-msvideo") == ".avi"
        assert get_file_extension("video/x-matroska") == ".mkv"
        assert get_file_extension("video/webm") == ".webm"

    def test_unknown_mime_type(self):
        """Test unknown MIME type returns empty string"""
        assert get_file_extension("unknown/type", "") == ""


class TestFileTypeLabel:
    """Tests for get_file_type_label()"""

    def test_audio_labels(self):
        """Test audio MIME types map to correct labels"""
        assert get_file_type_label("audio/mpeg") == "mp3"
        assert get_file_type_label("audio/mp4") == "m4a"
        assert get_file_type_label("audio/wav") == "wav"
        assert get_file_type_label("audio/flac") == "flac"

    def test_video_labels(self):
        """Test video MIME types map to correct labels"""
        assert get_file_type_label("video/mp4") == "mp4"
        assert get_file_type_label("video/quicktime") == "mov"
        assert get_file_type_label("video/webm") == "webm"

    def test_document_labels(self):
        """Test document MIME types map to correct labels"""
        assert get_file_type_label("application/pdf") == "pdf"
        assert (
            get_file_type_label(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            == "docx"
        )
        assert get_file_type_label("application/msword") == "doc"
        assert get_file_type_label("text/plain") == "txt"
        assert get_file_type_label("application/vnd.google-apps.document") == "gdoc"

    def test_subtitle_labels(self):
        """Test subtitle MIME types map to correct labels"""
        assert get_file_type_label("text/vtt") == "vtt"
        assert get_file_type_label("text/srt") == "srt"
        assert get_file_type_label("application/x-subrip") == "srt"

    def test_unknown_type(self):
        """Test unknown MIME type returns 'unknown'"""
        assert get_file_type_label("unknown/type") == "unknown"


class TestConstantsExist:
    """Verify expected constants are defined"""

    def test_size_limits_defined(self):
        """Test size limit constants exist and are reasonable"""
        assert MAX_AUDIO_VIDEO_SIZE > 0
        assert MAX_DOCUMENT_SIZE > 0
        assert (
            MAX_AUDIO_VIDEO_SIZE > MAX_DOCUMENT_SIZE
        )  # Audio/video limit should be higher
        assert MAX_AUDIO_VIDEO_SIZE == 1200 * 1024 * 1024  # 1200MB
        assert MAX_DOCUMENT_SIZE == 50 * 1024 * 1024  # 50MB


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
