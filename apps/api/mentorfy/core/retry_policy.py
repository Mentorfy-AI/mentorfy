"""
Retry and Timeout Policy Configuration

Single source of truth for retry delays, max retries, and phase timeouts.
All workers and orphaned job detection should use these functions.
"""

from typing import Dict

# Retry configuration
RETRY_DELAYS = [60, 300, 900]  # seconds: 1min, 5min, 15min
MAX_RETRIES = 3

# Base execution time per phase (time for actual work, not including retries)
# These are conservative estimates that should work for 95% of cases
PHASE_BASE_EXECUTION_TIME: Dict[str, int] = {
    'extraction': 600,    # 10 minutes - text extraction, transcription, etc.
    'chunking': 300,      # 5 minutes - splitting text into chunks
    'kg_ingest': 1200,    # 20 minutes - knowledge graph ingestion (Graphiti can be slow)
}

# Retryable vs non-retryable errors
RETRYABLE_ERRORS = {
    # Network/API errors
    "ConnectionError",
    "Timeout",
    "ReadTimeout",
    "TimeoutError",
    "HTTPError",  # Only if 5xx
    "APIError",

    # Temporary service issues
    "RateLimitError",
    "AnthropicRateLimitError",  # Custom wrapper with retry-after
    "ServiceUnavailable",

    # httpx/httpcore specific timeout errors (from Deepgram SDK)
    "httpx.ReadTimeout",
    "httpcore.ReadTimeout",
    "httpx.TimeoutException",
    "httpcore.TimeoutException",

    # Partial failures (retry may succeed if transient)
    "PartialIngestError",
}


class PartialIngestError(Exception):
    """Raised when some but not all chunks failed to ingest to KG. Retryable."""
    pass

NON_RETRYABLE_ERRORS = {
    # Client errors (fix required)
    "ValidationError",
    "ValueError",  # Invalid input (e.g., file has no audio)
    "FileNotFoundError",
    "InvalidFileFormat",
    "AuthenticationError",  # Bad API key
    "PermissionDenied",
}


def is_retryable_error(error: Exception, status_code: int = None) -> bool:
    """
    Determine if error should trigger automatic retry.

    Args:
        error: The exception that occurred
        status_code: HTTP status code if applicable

    Returns:
        True if error is retryable, False otherwise
    """
    error_type = type(error).__name__
    error_module = type(error).__module__
    full_error_type = f"{error_module}.{error_type}" if error_module != "builtins" else error_type

    # Non-retryable errors - give up immediately
    if error_type in NON_RETRYABLE_ERRORS or full_error_type in NON_RETRYABLE_ERRORS:
        return False

    # HTTP 4xx (except 429 rate limit) = client error, don't retry
    if status_code and 400 <= status_code < 500 and status_code != 429:
        return False

    # Check for timeout-related errors (check both simple name and full module path)
    if "timeout" in error_type.lower() or "timeout" in str(error).lower():
        return True

    # HTTP 5xx or known retryable = retry
    if error_type in RETRYABLE_ERRORS or full_error_type in RETRYABLE_ERRORS or (status_code and status_code >= 500):
        return True

    # Unknown error = retry (conservative approach)
    return True


def get_retry_delay(retry_count: int, error: Exception = None) -> int:
    """
    Get delay in seconds for retry attempt.

    If the error has a retry_after attribute (e.g., AnthropicRateLimitError),
    use that value instead of the default delay.

    Args:
        retry_count: Current retry count (0 = first retry, 1 = second, etc.)
        error: Optional exception that may contain retry_after hint

    Returns:
        Delay in seconds before next retry
    """
    # Check if error has retry_after hint from API
    if error and hasattr(error, "retry_after") and error.retry_after:
        return error.retry_after

    if retry_count >= len(RETRY_DELAYS):
        return RETRY_DELAYS[-1]  # Cap at longest delay
    return RETRY_DELAYS[retry_count]


def get_max_retry_duration() -> int:
    """
    Calculate total time (seconds) a job could spend in retry delays.

    Returns:
        Sum of all retry delays in seconds
    """
    return sum(RETRY_DELAYS)


def get_phase_timeout(phase: str) -> int:
    """
    Calculate total allowed time (seconds) for a phase including all retries.

    This is used to set expected_completion_at when creating a phase.
    Formula: base_execution_time + total_retry_delays + safety_buffer

    Args:
        phase: Phase name ('extraction', 'chunking', 'kg_ingest')

    Returns:
        Timeout in seconds
    """
    base_time = PHASE_BASE_EXECUTION_TIME.get(phase, 600)  # Default 10 min
    retry_duration = get_max_retry_duration()  # 21 minutes for 3 retries
    safety_buffer = 300  # 5 min buffer for queue delays, etc.

    return base_time + retry_duration + safety_buffer
