# Retry and Timeout Configuration

**Single source of truth:** `mentorfy/core/retry_policy.py`

All retry delays, max retry counts, and phase timeouts are centralized in this module. **Do not hardcode timeouts or retry logic elsewhere.**

## Quick Reference

### Retry Configuration

```python
from mentorfy.core.retry_policy import get_retry_delay, is_retryable_error, MAX_RETRIES

# In worker error handling:
if retry_count < MAX_RETRIES and is_retryable_error(exception):
    delay = get_retry_delay(retry_count)
    # Schedule retry with delay...
```

### Phase Timeouts

```python
from mentorfy.core.retry_policy import get_phase_timeout
from datetime import datetime, timezone, timedelta

# When creating pipeline_phase record:
now = datetime.now(timezone.utc)
timeout_seconds = get_phase_timeout('extraction')  # or 'chunking', 'kg_ingest'

phase_data = {
    'phase': 'extraction',
    'status': 'processing',
    'started_at': now.isoformat(),
    'expected_completion_at': (now + timedelta(seconds=timeout_seconds)).isoformat(),
    # ...
}
```

## Configuration Values

### Retry Delays

Exponential backoff with jitter:
- **Attempt 1**: Immediate (original job)
- **Attempt 2**: 60s delay (1 minute)
- **Attempt 3**: 300s delay (5 minutes)
- **Attempt 4**: 900s delay (15 minutes)
- **Max retries**: 3 (4 total attempts including original)

### Phase Base Execution Times

Conservative estimates for 95% of cases:

| Phase | Base Time | With Retries | Total Timeout |
|-------|-----------|--------------|---------------|
| `extraction` | 10 min | +21 min | **36 min** |
| `chunking` | 5 min | +21 min | **31 min** |
| `kg_ingest` | 20 min | +21 min | **46 min** |

Formula: `timeout = base_time + sum(retry_delays) + 5min_buffer`

## Error Classification

### Retryable Errors

Network/API errors (temporary):
- `ConnectionError`
- `Timeout`, `ReadTimeout`
- `HTTPError` (5xx only)
- `APIError`
- `RateLimitError`
- `ServiceUnavailable`

### Non-Retryable Errors

Client errors (require fixes):
- `ValidationError`
- `FileNotFoundError`
- `InvalidFileFormat`
- `AuthenticationError`
- `PermissionDenied`
- HTTP 4xx (except 429 rate limit)

**Unknown errors default to retryable** (conservative approach).

## Orphaned Job Detection

Orphaned phases are automatically detected and marked as failed by a scheduled job.

**Detection logic:**
```sql
SELECT * FROM pipeline_phase
WHERE status = 'processing'
  AND NOW() > expected_completion_at
```

**Cleanup script:**
```bash
# Dry run
python python/scripts/mark_orphaned_phases.py --dry-run

# Actually mark as failed
python python/scripts/mark_orphaned_phases.py
```

**Recommended cron:**
```
*/5 * * * * python python/scripts/mark_orphaned_phases.py >> /var/log/orphaned_cleanup.log 2>&1
```

## Updating Configuration

**To change retry delays:**
1. Edit `RETRY_DELAYS` in `retry_policy.py`
2. No other code changes needed - timeouts auto-adjust

**To change base execution time for a phase:**
1. Edit `PHASE_BASE_EXECUTION_TIME` dict in `retry_policy.py`
2. No other code changes needed - timeouts auto-adjust

**To add a new phase:**
1. Add entry to `PHASE_BASE_EXECUTION_TIME` dict
2. Workers will automatically use it via `get_phase_timeout(phase_name)`

## Testing

```python
from mentorfy.core.retry_policy import get_phase_timeout, get_max_retry_duration

# Check current timeouts
print(f"Extraction timeout: {get_phase_timeout('extraction')}s")
print(f"Max retry duration: {get_max_retry_duration()}s")

# Simulate error classification
from mentorfy.core.retry_policy import is_retryable_error

class FakeConnectionError(Exception):
    pass

assert is_retryable_error(FakeConnectionError("connection failed")) == True
assert is_retryable_error(ValueError("bad input"), status_code=400) == False
```

## Migration from Legacy

**Old system** (`mentorfy/core/retry.py`):
- Used for legacy `document_worker.py`
- Different retry strategies per error type
- Only used when `USE_NEW_PIPELINE=false`

**New system** (`mentorfy/core/retry_policy.py`):
- Used for phased pipeline workers (extraction, chunking, kg_ingest)
- Single retry strategy for all errors
- Activated when `USE_NEW_PIPELINE=true` (default)

Both coexist during transition period. Legacy system will be removed once all documents migrate to new pipeline.
