"""
Contextual Chunking Service

Implements Anthropic's contextual retrieval pattern for document chunking.
Generates context-aware chunks with LLM-generated situating descriptions.

Reference: https://www.anthropic.com/news/contextual-retrieval
"""

import asyncio
import logging
import os
import re
import random
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field
from anthropic import AsyncAnthropic, RateLimitError

from mentorfy.core.rate_limiter import RateLimiter


from mentorfy.models.token_counter import TokenCounter

logger = logging.getLogger(__name__)


class AnthropicRateLimitError(Exception):
    """Rate limit error with retry-after information from Anthropic API"""

    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.retry_after = retry_after


class Chunk(BaseModel):
    """Represents a document chunk with contextual information"""

    text: str = Field(..., description="The chunk text content")
    context: str = Field(..., description="LLM-generated situating context")
    chunk_index: int = Field(..., ge=0, description="Zero-based chunk index")
    char_start: int = Field(
        ..., ge=0, description="Starting character position in document"
    )
    char_end: int = Field(
        ..., gt=0, description="Ending character position in document"
    )
    token_count: int = Field(..., gt=0, description="Estimated token count")


class ContextualChunkingService:
    """
    Service for chunking documents with contextual retrieval pattern

    Strategy:
    1. Split document into fixed-size chunks with overlap
    2. For each chunk, generate contextual description via LLM (concurrent)
    3. Return chunks with context for embedding as: f"{context}\n\n{chunk_text}"

    Cost: ~$0.02 per document (using Claude Haiku)
    Performance: Concurrent context generation for speed
    """

    @staticmethod
    def _raise_missing_env(var_name: str):
        raise ValueError(f"{var_name} environment variable is required")

    def __init__(
        self,
        anthropic_api_key: str,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
        model: str = "claude-3-haiku-20240307",
        max_concurrent_requests: int = None,
    ):
        """
        Initialize chunking service

        Args:
            anthropic_api_key: Anthropic API key
            chunk_size: Target chunk size in tokens (~800 recommended)
            chunk_overlap: Overlap between chunks in tokens (~100 recommended)
            model: Claude model to use (Haiku for cost efficiency)
            max_concurrent_requests: Max concurrent LLM requests (default from env or 10)
        """
        # Disable SDK internal retries - we handle rate limit retries at the job level
        self.client = AsyncAnthropic(api_key=anthropic_api_key, max_retries=0)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.model = model
        self.max_concurrent_requests = max_concurrent_requests or int(
            os.getenv("CHUNKING_MAX_CONCURRENT") or self._raise_missing_env("CHUNKING_MAX_CONCURRENT")
        )

        # Initialize Anthropic rate limiter (TPM only - no RPM limit needed currently)
        anthropic_tpm_limit_str = os.getenv("ANTHROPIC_TPM_LIMIT")
        if not anthropic_tpm_limit_str:
            raise ValueError("ANTHROPIC_TPM_LIMIT environment variable is required")
        self.rate_limiter = RateLimiter(
            redis_key="anthropic",
            tpm_limit=int(anthropic_tpm_limit_str),
        )

    def _split_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using simple heuristics

        Better than mid-word splits, respects sentence boundaries
        """
        # Simple sentence splitting (can be improved with spaCy if needed)
        # Handles common sentence endings: . ! ?
        sentence_pattern = r"(?<=[.!?])\s+"
        sentences = re.split(sentence_pattern, text)
        return [s.strip() for s in sentences if s.strip()]

    def _estimate_tokens(self, text: str) -> int:
        """
        Rough token estimation (4 chars ≈ 1 token)
        Good enough for chunking, not for billing
        """
        return len(text) // 4

    def _create_chunks_with_boundaries(self, text: str) -> List[Dict[str, Any]]:
        """
        Create fixed-size chunks that respect sentence boundaries

        Returns list of dicts with 'text', 'char_start', 'char_end'
        """
        sentences = self._split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_tokens = 0
        char_position = 0

        for sentence in sentences:
            sentence_tokens = self._estimate_tokens(sentence)

            # If adding this sentence exceeds chunk_size, finalize current chunk
            if current_tokens + sentence_tokens > self.chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk)
                chunk_start = char_position - len(chunk_text)

                chunks.append(
                    {
                        "text": chunk_text,
                        "char_start": chunk_start,
                        "char_end": char_position,
                        "token_count": current_tokens,
                    }
                )

                # Start new chunk with overlap (keep last few sentences)
                overlap_tokens = 0
                overlap_sentences = []
                for s in reversed(current_chunk):
                    s_tokens = self._estimate_tokens(s)
                    if overlap_tokens + s_tokens > self.chunk_overlap:
                        break
                    overlap_sentences.insert(0, s)
                    overlap_tokens += s_tokens

                current_chunk = overlap_sentences
                current_tokens = overlap_tokens

            current_chunk.append(sentence)
            current_tokens += sentence_tokens
            char_position += len(sentence) + 1  # +1 for space

        # Add final chunk
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunk_start = char_position - len(chunk_text)
            chunks.append(
                {
                    "text": chunk_text,
                    "char_start": chunk_start,
                    "char_end": char_position,
                    "token_count": current_tokens,
                }
            )

        return chunks

    async def _generate_chunk_context(
        self,
        full_document: str,
        chunk_text: str,
        document_title: Optional[str] = None,
        is_first_chunk: bool = False,
    ) -> str:
        """
        Generate contextual description for a chunk using Claude with prompt caching.

        Uses Anthropic's prompt caching to avoid re-processing the full document
        for each chunk. The document is placed in a cached system message, and only
        the chunk varies per request.

        Args:
            full_document: The complete document text (cached across chunks)
            chunk_text: The specific chunk to generate context for
            document_title: Optional title for better context
            is_first_chunk: If True, estimates full token cost (cache write).
                           If False, estimates only chunk tokens (cache read - free).
        """
        # System message contains the cacheable document prefix
        system_content = f"""<document>
{full_document}
</document>

You will receive chunks from this document. For each chunk, provide a brief (1-2 sentence) description that situates it within the context of the overall document. Focus on what the chunk is about and how it relates to the document's main topics.{f" The document is titled: {document_title}" if document_title else ""}

Provide only the contextual description, no preamble."""

        # User message contains only the variable chunk
        user_content = f"<chunk>\n{chunk_text}\n</chunk>"

        # Estimate tokens for TPM rate limiting
        # First chunk (cache write): full document + chunk counts against TPM
        # Subsequent chunks (cache read): only chunk counts (cached prefix is free)
        chunk_tokens = self._estimate_tokens(user_content)
        output_tokens = 100

        if is_first_chunk:
            doc_tokens = self._estimate_tokens(system_content)
            estimated_tokens = doc_tokens + chunk_tokens + output_tokens
        else:
            estimated_tokens = chunk_tokens + output_tokens

        # Wait until we have TPM capacity (retry loop with exponential backoff + jitter)
        max_wait_attempts = 20
        attempts = 0
        while attempts < max_wait_attempts:
            can_proceed, wait_time = await self.rate_limiter.acquire_tokens(estimated_tokens)

            if can_proceed:
                break

            # Apply exponential backoff with jitter
            backoff = min(2 ** attempts, 30)
            jitter = 0.8 + (random.random() * 0.4)
            actual_wait = max(wait_time, backoff) * jitter

            logger.info(f"Anthropic TPM limit, waiting {actual_wait:.1f}s (attempt {attempts + 1})")
            await asyncio.sleep(actual_wait)
            attempts += 1

        if attempts >= max_wait_attempts:
            raise RuntimeError(f"Failed to acquire TPM capacity after {max_wait_attempts} attempts")

        # Now make the API call with prompt caching
        # System message with cache_control contains the document (cacheable prefix)
        # User message contains only the chunk (variable per request)
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=100,
                system=[
                    {
                        "type": "text",
                        "text": system_content,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_content}],
            )
        except RateLimitError as e:
            # Extract retry-after header from response
            retry_after = None
            if hasattr(e, "response") and e.response is not None:
                retry_after_str = e.response.headers.get("retry-after")
                if retry_after_str:
                    try:
                        retry_after = int(retry_after_str)
                    except ValueError:
                        pass
            logger.warning(f"Anthropic rate limit hit, retry-after: {retry_after}s")
            raise AnthropicRateLimitError(str(e), retry_after=retry_after) from e

        context = response.content[0].text.strip()

        # Log cache performance
        usage = response.usage
        cache_read = getattr(usage, "cache_read_input_tokens", 0)
        cache_creation = getattr(usage, "cache_creation_input_tokens", 0)
        if cache_read > 0:
            logger.debug(f"Cache HIT: {cache_read} tokens read from cache")
        elif cache_creation > 0:
            logger.debug(f"Cache WRITE: {cache_creation} tokens written to cache")

        return context

    async def _generate_contexts_concurrent(
        self,
        full_document: str,
        base_chunks: List[Dict[str, Any]],
        document_title: Optional[str] = None,
    ) -> List[str]:
        """
        Generate contexts for all chunks in sequential batches.

        Uses prompt caching: first chunk pays full TPM cost (cache write),
        subsequent chunks only pay for chunk tokens (cache read is free).

        Processes chunks in small batches to respect Anthropic's acceleration limit,
        which restricts how quickly you can ramp up token usage per minute.

        When hitting rate limits (429), pauses for the retry-after period and continues
        rather than failing the entire job. This allows large documents to complete
        even when acceleration limits are hit multiple times.

        Args:
            full_document: Full document text for context
            base_chunks: List of base chunk dicts
            document_title: Optional document title

        Returns:
            List of context strings in same order as base_chunks

        Raises:
            Exception: If any non-rate-limit error occurs
        """
        batch_size = self.max_concurrent_requests  # Process this many at a time
        stagger_delay = 0.25  # 250ms between request starts within a batch
        batch_delay = 2.0  # 2s pause between batches to stay under acceleration limit
        max_rate_limit_retries = 10  # Safety valve to prevent infinite loops

        async def generate_single(chunk_dict: Dict[str, Any], is_first: bool) -> str:
            return await self._generate_chunk_context(
                full_document=full_document,
                chunk_text=chunk_dict["text"],
                document_title=document_title,
                is_first_chunk=is_first,
            )

        # Process first chunk alone to ensure cache is written before parallel requests
        # This guarantees all subsequent chunks hit the cache
        logger.info(f"Processing first chunk to establish cache...")
        first_context = await generate_single(base_chunks[0], is_first=True)
        contexts = [first_context]

        # Process remaining chunks in batches
        remaining_chunks = base_chunks[1:]
        if not remaining_chunks:
            return contexts

        batch_start = 0
        rate_limit_retries = 0

        while batch_start < len(remaining_chunks):
            batch_end = min(batch_start + batch_size, len(remaining_chunks))
            batch = remaining_chunks[batch_start:batch_end]
            batch_num = (batch_start // batch_size) + 1
            total_batches = (len(remaining_chunks) + batch_size - 1) // batch_size

            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} chunks)...")

            # Stagger requests within the batch
            async def generate_with_stagger(chunk_dict: Dict[str, Any], index: int) -> str:
                if index > 0:
                    await asyncio.sleep(index * stagger_delay)
                return await generate_single(chunk_dict, is_first=False)

            try:
                batch_contexts = await asyncio.gather(
                    *[generate_with_stagger(chunk, i) for i, chunk in enumerate(batch)]
                )
                contexts.extend(batch_contexts)
                rate_limit_retries = 0  # Reset on success

                # Move to next batch
                batch_start = batch_end

                # Pause between batches to respect acceleration limit (not after last batch)
                if batch_start < len(remaining_chunks):
                    logger.info(f"Batch {batch_num} complete, waiting {batch_delay}s before next batch...")
                    await asyncio.sleep(batch_delay)

            except AnthropicRateLimitError as e:
                rate_limit_retries += 1
                if rate_limit_retries > max_rate_limit_retries:
                    logger.error(f"Exceeded max rate limit retries ({max_rate_limit_retries}), giving up")
                    raise

                wait_time = e.retry_after or 60  # Default to 60s if no retry-after
                logger.warning(
                    f"Rate limit hit on batch {batch_num}, waiting {wait_time}s before retry "
                    f"(attempt {rate_limit_retries}/{max_rate_limit_retries})..."
                )
                await asyncio.sleep(wait_time)
                # Don't increment batch_start - retry the same batch

        return contexts

    async def chunk_document(
        self,
        text: str,
        document_title: Optional[str] = None,
        source_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        """
        Chunk a document with contextual descriptions

        Args:
            text: Full document text
            document_title: Optional document title for better context
            source_metadata: Optional source metadata (source_type, etc.)

        Returns:
            List of Chunk objects with text, context, and metadata
        """
        text = text.strip()

        if not text:
            raise ValueError("Document text is empty")

        # For documents shorter than a single chunk, skip contextual retrieval
        text_tokens = self._estimate_tokens(text)
        if text_tokens < self.chunk_size:
            logger.warning(
                f"Document too short for contextual chunking "
                f"({text_tokens} tokens < {self.chunk_size} target), "
                f"creating single chunk without LLM context"
            )

            chunk = Chunk(
                text=text,
                context=document_title or "Short document",
                chunk_index=0,
                char_start=0,
                char_end=len(text),
                token_count=text_tokens,
            )

            logger.info(
                f"Created 1 chunk for short document ({len(text)} chars, {text_tokens} tokens)"
            )
            return [chunk]

        # Normal chunking for longer documents
        logger.info(
            f"Chunking document: {len(text)} chars, ~{text_tokens} tokens, "
            f"target chunk size: {self.chunk_size} tokens"
        )

        # Step 1: Create base chunks with sentence boundaries
        base_chunks = self._create_chunks_with_boundaries(text)
        logger.info(f"Created {len(base_chunks)} base chunks")

        # Step 2: Generate contextual descriptions for all chunks concurrently
        logger.info(
            f"Generating contexts for {len(base_chunks)} chunks (concurrent)..."
        )
        contexts = await self._generate_contexts_concurrent(
            full_document=text, base_chunks=base_chunks, document_title=document_title
        )

        # Step 3: Build Chunk objects
        chunks = []
        for i, (base_chunk, context) in enumerate(zip(base_chunks, contexts)):
            chunk = Chunk(
                text=base_chunk["text"],
                context=context,
                chunk_index=i,
                char_start=base_chunk["char_start"],
                char_end=base_chunk["char_end"],
                token_count=base_chunk["token_count"],
            )
            chunks.append(chunk)

        logger.info(
            f"✅ Chunking complete: {len(chunks)} chunks with contextual descriptions"
        )
        return chunks


def get_chunking_service(api_key: str) -> ContextualChunkingService:
    """
    Factory function to create chunking service instance

    Args:
        api_key: Anthropic API key

    Returns:
        Configured ContextualChunkingService
    """
    return ContextualChunkingService(
        anthropic_api_key=api_key,
        chunk_size=800,  # Anthropic recommendation
        chunk_overlap=100,  # ~12% overlap
        model="claude-3-haiku-20240307",  # Cost-effective choice
        # max_concurrent_requests defaults to env var CHUNKING_MAX_CONCURRENT (or 2)
    )
