"""
Shared Graphiti client management with rate limiting
"""

import asyncio
import atexit
import logging
import os
import random

from graphiti_core import Graphiti

from mentorfy.core.rate_limiter import RateLimiter
from mentorfy.models.token_counter import TokenCounter

logger = logging.getLogger(__name__)

# Global Graphiti client (one per worker process)
_graphiti_client = None


class RateLimitedGraphiti:
    """Wrapper around Graphiti client that applies rate limiting to API calls.

    Uses unified Redis-backed RateLimiter for both RPM and TPM limiting,
    ensuring correct behavior across multiple worker processes.

    Note: remove_episode is NOT rate limited because it's a local Neo4j operation,
    not an external API call.
    """

    def __init__(self, graphiti_client: Graphiti):
        self.client = graphiti_client

        # Get rate limit config from env
        rpm_limit_str = os.getenv("OPENAI_RPM_LIMIT")
        tpm_limit_str = os.getenv("OPENAI_TPM_LIMIT")

        if not rpm_limit_str:
            raise ValueError("OPENAI_RPM_LIMIT environment variable is required")
        if not tpm_limit_str:
            raise ValueError("OPENAI_TPM_LIMIT environment variable is required")

        # Single rate limiter handles both RPM and TPM
        self.rate_limiter = RateLimiter(
            redis_key="openai",
            rpm_limit=int(rpm_limit_str),
            tpm_limit=int(tpm_limit_str),
        )

    async def add_episode(self, *args, **kwargs):
        """Rate-limited version of add_episode with RPM and TPM awareness"""
        episode_body = kwargs.get("episode_body", "")
        name = kwargs.get("name", "")

        # Estimate tokens (Graphiti makes multiple LLM calls per episode)
        estimated_tokens = TokenCounter.estimate_api_call_tokens(
            user_message=episode_body,
            model="gpt-4o-mini",
            expected_output_tokens=None,
        )

        logger.info(f"add_episode '{name}': estimated {estimated_tokens:,} tokens")

        # Acquire both RPM and TPM capacity with retry loop
        max_wait_attempts = 20
        attempts = 0

        while attempts < max_wait_attempts:
            # Check RPM first
            rpm_ok, rpm_wait = await self.rate_limiter.acquire_request()
            if not rpm_ok:
                wait = self._apply_jitter(rpm_wait, attempts)
                logger.warning(f"RPM limit, waiting {wait:.1f}s (attempt {attempts + 1})")
                await asyncio.sleep(wait)
                attempts += 1
                continue

            # Then check TPM
            tpm_ok, tpm_wait = await self.rate_limiter.acquire_tokens(estimated_tokens)
            if not tpm_ok:
                wait = self._apply_jitter(tpm_wait, attempts)
                logger.warning(f"TPM limit, waiting {wait:.1f}s (attempt {attempts + 1})")
                await asyncio.sleep(wait)
                attempts += 1
                continue

            # Both acquired successfully
            break

        if attempts >= max_wait_attempts:
            raise RuntimeError(
                f"Failed to acquire rate limit capacity after {max_wait_attempts} attempts"
            )

        return await self.client.add_episode(*args, **kwargs)

    def _apply_jitter(self, base_wait: float, attempt: int) -> float:
        """Apply exponential backoff with jitter"""
        backoff = min(2 ** attempt, 30)
        jitter = 0.8 + (random.random() * 0.4)  # 0.8 to 1.2
        return max(base_wait, backoff) * jitter

    async def search(self, *args, **kwargs):
        """Rate-limited version of search (RPM only, minimal tokens)"""
        max_attempts = 10
        for attempt in range(max_attempts):
            ok, wait = await self.rate_limiter.acquire_request()
            if ok:
                break
            await asyncio.sleep(self._apply_jitter(wait, attempt))
        return await self.client.search(*args, **kwargs)

    async def remove_episode(self, *args, **kwargs):
        """Direct pass-through (no rate limiting - local Neo4j operation)"""
        return await self.client.remove_episode(*args, **kwargs)

    def __getattr__(self, name):
        """Forward all other attributes to the underlying client"""
        return getattr(self.client, name)


def get_graphiti_client():
    """Get or create shared Graphiti client for this worker process"""
    global _graphiti_client

    if _graphiti_client is None:
        neo4j_uri = os.getenv("NEO4J_URI")
        neo4j_user = os.getenv("NEO4J_USER")
        neo4j_password = os.getenv("NEO4J_PASSWORD")

        if not neo4j_uri:
            raise ValueError("NEO4J_URI environment variable is required")
        if not neo4j_user:
            raise ValueError("NEO4J_USER environment variable is required")
        if not neo4j_password:
            raise ValueError("NEO4J_PASSWORD environment variable is required")

        base_client = Graphiti(neo4j_uri, neo4j_user, neo4j_password)
        _graphiti_client = RateLimitedGraphiti(base_client)

        logger.info(f"✓ Initialized rate-limited Graphiti client for worker {os.getpid()}")

    return _graphiti_client


def close_graphiti_client():
    """Close the Graphiti client"""
    global _graphiti_client
    if _graphiti_client is not None:
        _graphiti_client = None
        logger.info(f"Closed Graphiti client for worker {os.getpid()}")


atexit.register(close_graphiti_client)
