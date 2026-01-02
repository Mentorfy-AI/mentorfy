"""
Token counting utilities for OpenAI API calls
Uses tiktoken to estimate tokens before API calls for rate limiting
"""

import logging
import os
from typing import List, Dict, Optional, Any

try:
    import tiktoken
except ImportError:
    tiktoken = None

logger = logging.getLogger(__name__)


class TokenCounter:
    """Utility for counting and estimating tokens for OpenAI models"""

    # Model encoding cache
    _encoding_cache: Dict[str, Any] = {}

    @classmethod
    def get_encoding(cls, model: str = "gpt-4"):
        """Get tiktoken encoding for a model"""
        if not tiktoken:
            logger.warning("tiktoken not installed, cannot count tokens accurately")
            return None

        if model not in cls._encoding_cache:
            try:
                cls._encoding_cache[model] = tiktoken.encoding_for_model(model)
            except KeyError:
                # Model not found, use cl100k_base (used by GPT-4)
                logger.warning(f"Model {model} not found in tiktoken, using cl100k_base")
                cls._encoding_cache[model] = tiktoken.get_encoding("cl100k_base")

        return cls._encoding_cache[model]

    @classmethod
    def count_text_tokens(cls, text: str, model: str = "gpt-4") -> int:
        """Count tokens in text using tiktoken"""
        if not tiktoken:
            # Rough estimation: ~4 characters per token
            return max(1, len(text) // 4)

        encoding = cls.get_encoding(model)
        if encoding:
            try:
                return len(encoding.encode(text))
            except Exception as e:
                logger.error(f"Error counting tokens: {e}")
                return max(1, len(text) // 4)

        return max(1, len(text) // 4)

    @classmethod
    def estimate_api_call_tokens(
        cls,
        system_prompt: str = "",
        user_message: str = "",
        model: str = "gpt-4.1-mini",
        expected_output_tokens: int = 500
    ) -> int:
        """
        Estimate total tokens for an API call (input + estimated output).

        Includes overhead for API formatting.
        """
        # Count input tokens
        system_tokens = cls.count_text_tokens(system_prompt, model) if system_prompt else 0
        user_tokens = cls.count_text_tokens(user_message, model) if user_message else 0

        # Add overhead for API formatting
        # System message uses ~1.5x the text length for formatting
        system_overhead = int(system_tokens * 0.5) if system_prompt else 0

        # Estimate output tokens (usually specified in API calls)
        # Default estimate: 10% of input + some base
        output_estimate = max(100, int((system_tokens + user_tokens) * 0.1))
        if expected_output_tokens:
            output_estimate = expected_output_tokens

        total = system_tokens + user_tokens + system_overhead + output_estimate

        logger.debug(f"Token estimate: system={system_tokens} + user={user_tokens} + overhead={system_overhead} + output={output_estimate} = {total}")

        return max(1, total)

    @classmethod
    def parse_openai_response_tokens(cls, response: Dict) -> int:
        """Extract actual tokens used from OpenAI API response"""
        try:
            if isinstance(response, dict):
                # Standard OpenAI response format
                if "usage" in response:
                    usage = response["usage"]
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    total = prompt_tokens + completion_tokens
                    logger.debug(f"Actual tokens from response: {total} (prompt={prompt_tokens}, completion={completion_tokens})")
                    return total
        except Exception as e:
            logger.error(f"Error parsing token usage from response: {e}")

        return 0
