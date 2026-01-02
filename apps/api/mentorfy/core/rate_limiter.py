"""
Unified Redis-backed rate limiter for API calls.
Supports both RPM (requests per minute) and TPM (tokens per minute) limiting.
All state is stored in Redis for cross-worker coordination.
"""

import time
import logging
import os
from typing import Tuple

import redis

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Redis-backed rate limiter supporting both RPM and TPM limits.

    Uses Redis sorted sets with sliding window for accurate rate limiting
    across multiple worker processes.

    Args:
        redis_key: Unique key prefix for this limiter (e.g., "openai", "anthropic")
        rpm_limit: Requests per minute limit (None to disable)
        tpm_limit: Tokens per minute limit (None to disable)
    """

    def __init__(
        self,
        redis_key: str,
        rpm_limit: int | None = None,
        tpm_limit: int | None = None,
    ):
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            raise ValueError("REDIS_URL environment variable is required")

        self.redis_key = redis_key
        self.rpm_limit = rpm_limit
        self.tpm_limit = tpm_limit
        self.redis_conn = redis.from_url(redis_url, decode_responses=True)

        limits = []
        if rpm_limit:
            limits.append(f"{rpm_limit:,} RPM")
        if tpm_limit:
            limits.append(f"{tpm_limit:,} TPM")
        logger.info(f"RateLimiter [{redis_key}]: {', '.join(limits)}")

    def _rpm_key(self) -> str:
        return f"rate_limit:{self.redis_key}:rpm"

    def _tpm_key(self) -> str:
        return f"rate_limit:{self.redis_key}:tpm"

    async def acquire_request(self) -> Tuple[bool, float]:
        """
        Acquire permission for one request (RPM limiting).

        Returns:
            (can_proceed, wait_time_seconds)
        """
        if not self.rpm_limit:
            return True, 0

        now = time.time()
        key = self._rpm_key()

        # Clean entries older than 60 seconds
        self.redis_conn.zremrangebyscore(key, 0, now - 60)

        # Count current requests in window
        current_count = self.redis_conn.zcard(key)

        if current_count < self.rpm_limit:
            # Add this request
            self.redis_conn.zadd(key, {f"{now}": now})
            self.redis_conn.expire(key, 61)
            logger.debug(f"RPM [{self.redis_key}]: {current_count + 1}/{self.rpm_limit}")
            return True, 0
        else:
            # Get oldest entry to calculate wait time
            oldest = self.redis_conn.zrange(key, 0, 0, withscores=True)
            if oldest:
                oldest_time = oldest[0][1]
                wait = max(0, (oldest_time + 60) - now)
            else:
                wait = 1.0

            logger.warning(f"RPM limit [{self.redis_key}]: {current_count}/{self.rpm_limit}, wait {wait:.1f}s")
            return False, wait

    async def acquire_tokens(self, token_count: int) -> Tuple[bool, float]:
        """
        Acquire permission to use tokens (TPM limiting).

        Args:
            token_count: Number of tokens to reserve

        Returns:
            (can_proceed, wait_time_seconds)
        """
        if not self.tpm_limit:
            return True, 0

        now = time.time()
        key = self._tpm_key()

        # Clean entries older than 60 seconds
        self.redis_conn.zremrangebyscore(key, 0, now - 60)

        # Sum current tokens in window
        # Format: "timestamp:tokens" as member, timestamp as score
        entries = self.redis_conn.zrange(key, 0, -1, withscores=True) or []
        current_tokens = sum(float(entry.split(':')[1]) for entry, _ in entries)

        if current_tokens + token_count <= self.tpm_limit:
            # Reserve these tokens
            self.redis_conn.zadd(key, {f"{now}:{token_count}": now})
            self.redis_conn.expire(key, 61)
            logger.debug(
                f"TPM [{self.redis_key}]: {current_tokens:,.0f} + {token_count:,} = "
                f"{current_tokens + token_count:,.0f}/{self.tpm_limit:,}"
            )
            return True, 0
        else:
            # Calculate wait time - find when enough tokens expire
            deficit = (current_tokens + token_count) - self.tpm_limit
            freed = 0
            wait = 1.0  # Default fallback

            for entry, timestamp in entries:
                tokens = float(entry.split(':')[1])
                freed += tokens
                if freed >= deficit:
                    wait = max(0, (timestamp + 60) - now)
                    break

            logger.warning(
                f"TPM limit [{self.redis_key}]: {current_tokens:,.0f} + {token_count:,} > "
                f"{self.tpm_limit:,}, wait {wait:.1f}s"
            )
            return False, wait

    async def get_current_rpm(self) -> int:
        """Get current requests in the window"""
        if not self.rpm_limit:
            return 0
        now = time.time()
        key = self._rpm_key()
        self.redis_conn.zremrangebyscore(key, 0, now - 60)
        return self.redis_conn.zcard(key)

    async def get_current_tpm(self) -> int:
        """Get current tokens in the window"""
        if not self.tpm_limit:
            return 0
        now = time.time()
        key = self._tpm_key()
        self.redis_conn.zremrangebyscore(key, 0, now - 60)
        entries = self.redis_conn.zrange(key, 0, -1, withscores=True) or []
        return int(sum(float(entry.split(':')[1]) for entry, _ in entries))
