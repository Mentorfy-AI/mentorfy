#!/usr/bin/env python3
"""
Simple test script for audio/video transcription with local files

Tests the transcription pipeline with a local MP3/MP4 file.
Usage:
    python test_audio_local.py <path_to_audio_or_video_file>

Example:
    python test_audio_local.py /path/to/podcast.mp3
    python test_audio_local.py /path/to/video.mp4
"""

import sys
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

from mentorfy.services.transcription_service import TranscriptionService


async def test_transcription(file_path: str):
    """Test audio/video transcription from local file"""

    print(f"\n{'='*60}")
    print(f"Testing Audio/Video Transcription")
    print(f"{'='*60}\n")

    # Check file exists
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return None

    # Check environment
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    if not deepgram_key:
        print("❌ DEEPGRAM_API_KEY not found in environment")
        print("   Add it to .env.local and try again")
        return None

    print(f"✅ DEEPGRAM_API_KEY found")
    print(f"✅ File: {file_path}")

    file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
    print(f"   Size: {file_size:.2f} MB")
    print(f"   Extension: {Path(file_path).suffix}\n")

    try:
        # Initialize transcription service
        print("Initializing transcription service...")
        transcription_service = TranscriptionService(
            api_key=deepgram_key,
            model="nova-3",
            language="en"
        )

        # Transcribe
        print("\nTranscribing audio...")
        print("(This may take 10-30 seconds depending on file length)\n")

        result = await transcription_service.transcribe_file(file_path)

        # Show results
        print(f"\n{'='*60}")
        print("✅ TRANSCRIPTION SUCCESSFUL!")
        print(f"{'='*60}\n")

        print(f"Transcript length: {len(result.text)} characters")
        print(f"Word count: {result.word_count} words")
        print(f"Duration: {result.duration_seconds:.1f} seconds" if result.duration_seconds else "")
        print(f"Confidence: {result.confidence:.2f}" if result.confidence else "")

        if result.metadata.get('estimated_cost_usd'):
            print(f"Cost: ${result.metadata['estimated_cost_usd']:.4f}")

        if result.metadata.get('was_video_extracted'):
            print(f"\n⚙️  Video detected - audio extracted with ffmpeg")

        print(f"\nFirst 500 characters of transcript:")
        print("-" * 60)
        print(result.text[:500])
        if len(result.text) > 500:
            print("...")
        print("-" * 60)

        return result.text

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_audio_local.py <path_to_audio_or_video_file>")
        print("\nSupported formats:")
        print("  Audio: MP3, WAV, M4A, FLAC, OGG, OPUS")
        print("  Video: MP4, MOV, AVI, MKV, WEBM")
        print("\nExample:")
        print("  python test_audio_local.py ~/Downloads/podcast.mp3")
        sys.exit(1)

    file_path = sys.argv[1]

    # Expand home directory if needed
    file_path = os.path.expanduser(file_path)

    # Run test
    result = asyncio.run(test_transcription(file_path))

    if result:
        print(f"\n✅ Test completed successfully!")
        sys.exit(0)
    else:
        print(f"\n❌ Test failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
