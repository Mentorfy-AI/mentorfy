"""
Audio transcription service using Deepgram API

Supports: MP3, MP4, WAV, M4A, FLAC, MOV, AVI
MP4/MOV/AVI handling: Extract audio only (no video processing)

Features:
- Pre-recorded audio transcription via Deepgram
- Automatic audio extraction from video containers (MP4, MOV, AVI)
- Timestamp support (optional)
- Rate limiting integration
- Error handling with retries
- Automatic temp file cleanup
"""

import os
import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any

import ffmpeg
from pydantic import BaseModel, Field
from deepgram import DeepgramClient


logger = logging.getLogger(__name__)


class TranscriptionResult(BaseModel):
    """Result from audio transcription"""

    text: str = Field(..., description="Transcribed text content")
    confidence: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Transcription confidence score"
    )
    duration_seconds: Optional[float] = Field(
        None, ge=0.0, description="Audio duration in seconds"
    )
    word_count: Optional[int] = Field(
        None, ge=0, description="Number of words in transcript"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    def model_post_init(self, __context):
        """Calculate word count if not provided"""
        if self.word_count is None and self.text:
            self.word_count = len(self.text.split())


class TranscriptionService:
    """
    Service for transcribing audio files using Deepgram API

    Handles:
    - Direct audio transcription (MP3, WAV, M4A, FLAC)
    - Video-to-audio extraction then transcription (MP4, MOV, AVI)
    - Temp file cleanup
    - Cost tracking

    Example:
        service = TranscriptionService(api_key="...")
        result = await service.transcribe_file("podcast.mp3")
        print(result.text)
    """

    # Video formats that need audio extraction
    VIDEO_FORMATS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

    # Audio formats supported directly by Deepgram
    AUDIO_FORMATS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus"}

    def __init__(
        self,
        api_key: str,
        model: str = "nova-3",
        language: str = "en",
        timeout_seconds: float = 600.0,
    ):
        """
        Initialize transcription service

        Args:
            api_key: Deepgram API key
            model: Deepgram model to use (default: nova-3 for best accuracy/cost)
            language: Language code (default: en)
            timeout_seconds: Request timeout in seconds (default: 600s = 10 minutes)
                           Large video files may need longer timeouts
        """
        self.api_key = api_key
        self.model = model
        self.language = language
        self.timeout_seconds = timeout_seconds

        # Deepgram SDK v5+ - simple initialization with api_key parameter
        self.client = DeepgramClient(api_key=api_key)

        logger.info(
            f"TranscriptionService initialized with model={model}, "
            f"language={language}, timeout={timeout_seconds}s"
        )

    def _is_video_file(self, file_path: str) -> bool:
        """Check if file is a video container that needs audio extraction"""
        ext = Path(file_path).suffix.lower()
        return ext in self.VIDEO_FORMATS

    def _is_audio_file(self, file_path: str) -> bool:
        """Check if file is a supported audio format"""
        ext = Path(file_path).suffix.lower()
        return ext in self.AUDIO_FORMATS

    async def _validate_audio_track(self, file_path: str) -> bool:
        """
        Validate that file contains an audio track using ffprobe.

        Prevents wasting API calls on video files with no audio.
        Fast operation (~100ms) that only reads file metadata, not content.

        Args:
            file_path: Path to video/audio file

        Returns:
            True if audio track exists, False otherwise
        """
        try:
            # Use ffprobe to check for audio streams (only reads metadata)
            probe = await asyncio.to_thread(lambda: ffmpeg.probe(file_path))

            # Check if any streams are audio
            audio_streams = [
                stream
                for stream in probe.get("streams", [])
                if stream.get("codec_type") == "audio"
            ]

            has_audio = len(audio_streams) > 0

            if not has_audio:
                logger.warning(
                    f"⚠️ File '{Path(file_path).name}' contains no audio tracks. "
                    "Deepgram transcription will fail."
                )
            else:
                logger.info(f"✅ Audio track detected: {len(audio_streams)} stream(s)")

            return has_audio

        except Exception as e:
            logger.warning(f"⚠️ Failed to probe audio tracks (will attempt anyway): {e}")
            # If probe fails, let Deepgram try anyway (conservative approach)
            return True

    async def _extract_audio_from_video(self, video_path: str) -> str:
        """
        Extract audio from video file using ffmpeg

        Converts video (MP4, MOV, AVI) to MP3 audio
        Reduces file size by ~95% (200MB MP4 → 8MB MP3)

        Args:
            video_path: Path to video file

        Returns:
            str: Path to temporary MP3 file

        Raises:
            Exception: If ffmpeg extraction fails
        """
        try:
            logger.info(f"Extracting audio from video: {video_path}")

            # Create temp file for extracted audio
            temp_fd, temp_path = tempfile.mkstemp(
                suffix=".mp3", prefix="audio_extracted_"
            )
            os.close(temp_fd)  # Close file descriptor, ffmpeg will write to path

            # Extract audio using ffmpeg
            # -vn: no video
            # -acodec libmp3lame: encode as MP3
            # -q:a 2: quality level 2 (high quality, ~192kbps)
            await asyncio.to_thread(
                lambda: (
                    ffmpeg.input(video_path)
                    .output(temp_path, vn=None, acodec="libmp3lame", **{"q:a": 2})
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True, quiet=True)
                )
            )

            # Verify audio file was created and has content
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                raise Exception(
                    "Audio extraction produced empty file - video may not have audio track"
                )

            extracted_size = os.path.getsize(temp_path) / (1024 * 1024)  # MB
            original_size = os.path.getsize(video_path) / (1024 * 1024)  # MB
            reduction_pct = ((original_size - extracted_size) / original_size) * 100

            logger.info(
                f"Audio extracted successfully: {original_size:.1f}MB → {extracted_size:.1f}MB "
                f"({reduction_pct:.1f}% reduction)"
            )

            return temp_path

        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"ffmpeg error extracting audio: {error_msg}")

            # Cleanup on error
            if "temp_path" in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)

            raise Exception(f"Failed to extract audio from video: {error_msg}")

        except Exception as e:
            logger.error(f"Error extracting audio from video: {e}")

            # Cleanup on error
            if "temp_path" in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)

            raise

    async def _transcribe_with_deepgram(
        self, audio_path: str, include_timestamps: bool = False
    ) -> Dict[str, Any]:
        """
        Call Deepgram API to transcribe audio file

        Args:
            audio_path: Path to audio file (MP3, WAV, etc.)
            include_timestamps: Include word-level timestamps

        Returns:
            dict: Deepgram API response

        Raises:
            Exception: If API call fails
        """
        try:
            logger.info(f"Transcribing audio file: {audio_path} (model={self.model})")

            # Read audio file
            with open(audio_path, "rb") as audio_file:
                audio_data = audio_file.read()

            # Prepare request options (as dict for SDK v5+)
            options = {
                "model": self.model,
                "language": self.language,
                "smart_format": True,  # Auto-formatting (punctuation, capitalization)
                "paragraphs": True,  # Paragraph detection
                "utterances": include_timestamps,  # Utterance-level timestamps if requested
                "punctuate": True,
                "diarize": False,  # Speaker diarization (disabled for now)
            }

            # Call Deepgram API with timeout configuration
            # SDK v5+ uses request_options parameter for timeout and retries
            response = await asyncio.to_thread(
                lambda: self.client.listen.v1.media.transcribe_file(
                    request=audio_data,
                    request_options={
                        "timeout_in_seconds": self.timeout_seconds,
                        "max_retries": 2,  # Retry on network failures
                    },
                    **options,
                )
            )

            logger.info(f"Transcription complete: {len(audio_data)} bytes processed")

            return response

        except Exception as e:
            logger.error(f"Deepgram API error: {e}")
            raise Exception(f"Transcription failed: {e}")

    async def transcribe_file(
        self, file_path: str, include_timestamps: bool = False
    ) -> TranscriptionResult:
        """
        Transcribe audio or video file

        Flow:
        1. Validate file format (audio or video)
        2. For video files: extract audio to MP3 first (avoids timeout on large files)
        3. Send audio to Deepgram for transcription
        4. Parse response and create TranscriptionResult
        5. Clean up temp files

        Args:
            file_path: Path to audio or video file
            include_timestamps: Include word-level timestamps (increases response size)

        Returns:
            TranscriptionResult: Transcript with metadata

        Raises:
            ValueError: If file format not supported
            Exception: If transcription fails
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Validate file format
        if not (self._is_audio_file(file_path) or self._is_video_file(file_path)):
            logger.info(f"file_path: {file_path}")
            raise ValueError(
                f"Unsupported file format: {Path(file_path).suffix}. "
                f"Supported: {self.AUDIO_FORMATS | self.VIDEO_FORMATS}"
            )

        # Validate audio track exists (prevents wasting API calls on files with no audio)
        has_audio = await self._validate_audio_track(file_path)
        if not has_audio:
            raise ValueError(
                f"File '{Path(file_path).name}' contains no audio tracks. "
                "Cannot transcribe a file without audio."
            )

        temp_audio_path = None

        try:
            # Video files: extract audio first (reduces 670MB MP4 → ~50MB MP3)
            # This avoids Deepgram timeout issues on large video files
            if self._is_video_file(file_path):
                logger.info(
                    f"Video file detected: {file_path} - extracting audio first"
                )
                temp_audio_path = await self._extract_audio_from_video(file_path)
                transcribe_path = temp_audio_path
            else:
                logger.info(f"Audio file detected: {file_path}")
                transcribe_path = file_path

            # Transcribe the audio file
            response = await self._transcribe_with_deepgram(
                transcribe_path, include_timestamps
            )

            # Step 3: Parse response
            try:
                # Access transcript from Deepgram response
                transcript = response.results.channels[0].alternatives[0].transcript
                confidence = response.results.channels[0].alternatives[0].confidence

                # Get audio duration from metadata
                duration = None
                if hasattr(response.metadata, "duration"):
                    duration = response.metadata.duration

                # Build metadata
                metadata = {
                    "model": self.model,
                    "language": self.language,
                    "confidence": confidence,
                    "was_video_extracted": temp_audio_path is not None,
                    "original_filename": Path(file_path).name,
                }

                if duration:
                    metadata["duration_seconds"] = duration
                    # Calculate cost estimate
                    cost = (duration / 60) * 0.0043  # $0.0043 per minute
                    metadata["estimated_cost_usd"] = round(cost, 4)

                logger.info(
                    f"✅ Transcription successful: {len(transcript)} chars, "
                    f"confidence={confidence:.2f}"
                )

                return TranscriptionResult(
                    text=transcript,
                    confidence=confidence,
                    duration_seconds=duration,
                    metadata=metadata,
                )

            except (AttributeError, IndexError, KeyError) as e:
                logger.error(f"Error parsing Deepgram response: {e}")
                raise Exception(f"Failed to parse transcription response: {e}")

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

        finally:
            # Clean up temp audio file if we extracted it
            if temp_audio_path and os.path.exists(temp_audio_path):
                try:
                    os.unlink(temp_audio_path)
                    logger.info(f"Cleaned up temp audio file: {temp_audio_path}")
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to clean up temp file {temp_audio_path}: {cleanup_error}"
                    )


def get_transcription_service(api_key: Optional[str] = None) -> TranscriptionService:
    """
    Factory function to create transcription service instance

    Args:
        api_key: Deepgram API key (defaults to DEEPGRAM_API_KEY env var)

    Returns:
        TranscriptionService: Configured service instance

    Raises:
        ValueError: If API key not provided and not in environment
    """
    api_key = api_key or os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise ValueError(
            "DEEPGRAM_API_KEY required. Set via environment variable or pass to function."
        )

    return TranscriptionService(
        api_key=api_key, model="nova-3", language="en"  # Best accuracy/cost balance
    )
