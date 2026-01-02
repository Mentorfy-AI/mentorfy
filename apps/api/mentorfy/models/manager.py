"""
Model Manager for Anthropic Claude APIs

This module provides an interface for Anthropic Claude models,
handling API calls, token tracking, cost calculation, and error handling.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Any, Callable

from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)


# Models that support extended thinking
THINKING_CAPABLE_MODELS = frozenset(
    [
        "claude-3-7-sonnet-20250219",
        "claude-sonnet-4-20250514",
        "claude-sonnet-4-5-20250929",
        "claude-opus-4-20250514",
        "claude-opus-4-1-20250805",
        "claude-haiku-4-5-20251001",
    ]
)

# Supported models configuration
SUPPORTED_MODELS = {
    # Claude 3 Models
    "claude-3-haiku-20240307": "Fast and cost-effective Claude 3 model with 200K context",
    "claude-3-sonnet-20240229": "Balanced Claude 3 model with 200K context",
    "claude-3-opus-20240229": "Most capable Claude 3 model with 200K context",
    # Claude 3.5 Models
    "claude-3-5-haiku-20241022": "Enhanced speed and efficiency with improved capabilities",
    # Claude 4 Haiku Models
    "claude-3-5-sonnet-20240620": "Improved reasoning and coding with 200K context",
    # Claude 3.7 Models
    "claude-3-7-sonnet-20250219": "Advanced reasoning with 128K output capability",
    # Claude 4 Models
    "claude-sonnet-4-20250514": "Latest generation performance with 1M context window",
    "claude-sonnet-4-5-20250929": "Enhanced Sonnet 4.5 with improved capabilities",
    "claude-opus-4-20250514": "Most capable Claude 4 model with 1M context window",
    "claude-opus-4-1-20250805": "Latest flagship model with enhanced capabilities",
    "claude-haiku-4-5-20251001": "Fast and efficient Claude Haiku 4.5 with enhanced capabilities",
}


class ModelManagerError(Exception):
    """Base exception for ModelManager errors"""

    pass


class UnsupportedModelError(ModelManagerError):
    """Raised when an unsupported model is requested"""

    pass


class ToolRegistry:
    """Registry for managing available tools"""

    def __init__(self):
        self.tools = {}
        self.handlers = {}

    def register(self, name: str, tool_def: dict, handler: Callable):
        """Register a tool with Anthropic definition"""
        self.tools[name] = tool_def
        self.handlers[name] = handler

    def get_tools(self, tool_names: List[str]):
        """Get tool definitions for specified tool names"""
        return [self.tools[name] for name in tool_names if name in self.tools]

    async def execute(self, name: str, arguments: dict, context: dict):
        """Execute a tool handler with required context"""
        if name in self.handlers:
            return await self.handlers[name](**arguments, _context=context)
        raise ValueError(f"Unknown tool: {name}")


class ModelManager:
    """Manager for Anthropic Claude models with token tracking"""

    # Model configurations
    MODELS = {
        # Claude 3 Models
        "claude-3-haiku-20240307": {
            "context_window": 200000,
            "input_price": 0.25,
            "output_price": 1.25,
        },
        "claude-3-sonnet-20240229": {
            "context_window": 200000,
            "input_price": 3.0,
            "output_price": 15.0,
        },
        "claude-3-opus-20240229": {
            "context_window": 200000,
            "input_price": 15.0,
            "output_price": 75.0,
        },
        # Claude 3.5 Models
        "claude-3-5-haiku-20241022": {
            "context_window": 200000,
            "input_price": 1.0,  # Updated pricing for 3.5 Haiku
            "output_price": 5.0,
        },
        # Claude 4 Haiku Models
        "claude-haiku-4-5-20251001": {
            "context_window": 200000,
            "input_price": 1.0,
            "output_price": 5.0,
        },
        "claude-3-5-sonnet-20240620": {
            "context_window": 200000,
            "input_price": 3.0,
            "output_price": 15.0,
        },
        # Claude 3.7 Models
        "claude-3-7-sonnet-20250219": {
            "context_window": 200000,
            "input_price": 3.0,
            "output_price": 15.0,
            "max_output_tokens": 128000,  # Enhanced output capability
        },
        # Claude 4 Models
        "claude-sonnet-4-20250514": {
            "context_window": 1000000,  # 1M token context window
            "input_price": 3.0,  # Standard rate for ≤200K tokens
            "output_price": 15.0,  # Standard rate for ≤200K tokens
            "long_context": {  # Premium rates for >200K tokens
                "input_price": 6.0,
                "output_price": 22.5,
            },
        },
        "claude-opus-4-20250514": {
            "context_window": 1000000,  # 1M token context window
            "input_price": 15.0,  # Standard rate for ≤200K tokens
            "output_price": 75.0,  # Standard rate for ≤200K tokens
            "long_context": {  # Premium rates for >200K tokens
                "input_price": 30.0,
                "output_price": 112.5,
            },
        },
        "claude-opus-4-1-20250805": {
            "context_window": 1000000,  # 1M token context window
            "input_price": 15.0,  # Standard rate for ≤200K tokens
            "output_price": 75.0,  # Standard rate for ≤200K tokens
            "long_context": {  # Premium rates for >200K tokens
                "input_price": 30.0,
                "output_price": 112.5,
            },
        },
        "claude-sonnet-4-5-20250929": {
            "context_window": 1000000,  # 1M token context window
            "input_price": 3.0,  # Assumed pricing similar to Sonnet 4
            "output_price": 15.0,
            "long_context": {  # Premium rates for >200K tokens
                "input_price": 6.0,
                "output_price": 22.5,
            },
        },
    }

    def __init__(
        self,
        anthropic_api_key: str,
        supabase_client=None,
        redis_client=None,
        graphiti_client=None,
    ):
        """
        Initialize ModelManager with API key and clients

        Args:
            anthropic_api_key: Anthropic API key (required)
            supabase_client: Supabase client for database operations
            redis_client: Optional Redis client for caching
            graphiti_client: Optional Graphiti client for knowledge base
        """
        import os

        if not anthropic_api_key:
            raise ModelManagerError("Anthropic API key is required")

        self.supabase = supabase_client
        self.redis = redis_client
        self.graphiti_client = graphiti_client

        # Initialize Anthropic client (direct connection)
        self.anthropic_client = AsyncAnthropic(api_key=anthropic_api_key)

        # Initialize Supermemory client (Memory API approach)
        supermemory_api_key = os.getenv("SUPERMEMORY_API_KEY")
        if supermemory_api_key:
            from supermemory import Supermemory

            self.supermemory_client = Supermemory(api_key=supermemory_api_key)
            self.supermemory_enabled = True
            logger.info("✅ Supermemory Memory API initialized (SDK v3.4.0)")
        else:
            self.supermemory_client = None
            self.supermemory_enabled = False
            logger.info("⚠️  Supermemory DISABLED - no API key")

        # Initialize tool registry
        self.tool_registry = ToolRegistry()

        # Register knowledge search tool if graphiti client available
        if self.graphiti_client:
            self._register_tools()

    def _register_tools(self):
        """Register available tools with the tool registry"""
        # Define knowledge search tool for Anthropic
        knowledge_search_tool = {
            "name": "search_knowledge_base",
            "description": "Search the mentor's knowledge base for specific information, examples, case studies, or domain expertise. Use when you need concrete information beyond general knowledge.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"},
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results",
                        "default": 7,
                    },
                },
                "required": ["query"],
            },
        }

        # Define the handler
        async def search_knowledge_base_handler(
            query: str, _context: dict, num_results: int = 7
        ) -> str:
            """Tool handler for knowledge base search with required context"""
            if not self.graphiti_client:
                return "Knowledge base unavailable"

            # Extract bot_id and org_id from context - both are required
            if "bot_id" not in _context:
                raise ValueError("bot_id required in context for knowledge base search")

            bot_id = _context["bot_id"]
            org_id = _context.get("org_id")

            try:
                logger.info(
                    f"🔍 Searching knowledge base: query='{query}', org_id={org_id}, limit={num_results}"
                )

                # Use search() to get Edge objects with fact snippets (not full documents)
                # CRITICAL: Pass group_ids to ensure organization-level isolation in multi-tenant setup
                search_kwargs = {"num_results": num_results}
                if org_id:
                    search_kwargs["group_ids"] = [org_id]

                results = await self.graphiti_client.search(
                    query=query, **search_kwargs
                )

                if not results:
                    logger.warning(
                        f"⚠️ No results found for query='{query}' with org_id={org_id}"
                    )
                    return "No relevant information found"

                formatted = []
                for i, result in enumerate(results[:num_results], 1):
                    fact = result.fact if hasattr(result, "fact") else str(result)
                    formatted.append(f"{i}. {fact}")
                    logger.debug(f"Result {i}: {fact[:100]}...")

                logger.info(
                    f"✅ Knowledge search for bot {bot_id} (org {org_id}): query='{query}', found {len(formatted)} results"
                )
                return (
                    "\n".join(formatted)
                    if formatted
                    else "No relevant information found"
                )
            except Exception as e:
                logger.error(
                    f"❌ Knowledge search failed for bot {bot_id}: {e}", exc_info=True
                )
                return "Error searching knowledge base"

        # Register the knowledge search tool
        self.tool_registry.register(
            "search_knowledge_base",
            knowledge_search_tool,
            search_knowledge_base_handler,
        )
        logger.info("Registered knowledge search tool")

    def get_model_config(self, model_name: str) -> Dict[str, Any]:
        """
        Get configuration for a specific model

        Args:
            model_name: Name of the model

        Returns:
            Model configuration dictionary

        Raises:
            UnsupportedModelError: If model is not supported
        """
        if model_name not in self.MODELS:
            raise UnsupportedModelError(f"Unsupported model: {model_name}")
        return self.MODELS[model_name]

    @classmethod
    def get_supported_models(cls) -> List[str]:
        """
        Get list of all supported models

        Returns:
            List of supported model names
        """
        return list(cls.MODELS.keys())

    @classmethod
    def get_model_info(cls, model_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific model

        Args:
            model_name: Name of the model

        Returns:
            Dictionary with model info including description and pricing
        """
        if model_name not in cls.MODELS:
            raise UnsupportedModelError(f"Model {model_name} not supported")

        config = cls.MODELS[model_name]
        description = SUPPORTED_MODELS.get(model_name, "Anthropic Claude model")

        info = {
            "name": model_name,
            "provider": "anthropic",
            "description": description,
            "context_window": config["context_window"],
            "input_price_per_1m": config["input_price"],
            "output_price_per_1m": config["output_price"],
        }

        # Add long context pricing info if available
        if "long_context" in config:
            info["long_context_pricing"] = {
                "threshold_tokens": 200_000,
                "input_price_per_1m": config["long_context"]["input_price"],
                "output_price_per_1m": config["long_context"]["output_price"],
            }

        return info

    async def generate(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        system: str = None,
        max_tokens: int = None,
        temperature: float = None,
        org_id: str = None,
        user_id: str = None,
        bot_id: str = None,
        tools: List[str] = None,
        debug_mode: bool = False,
        conversation_id: str = None,
    ) -> Dict[str, Any]:
        """
        Generate a complete response using the specified model (non-streaming).

        Args:
            messages: List of message dicts with 'role' and 'content'
            model_name: Name of the model to use
            system: System prompt (separate from messages)
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            org_id: Organization ID for tracking
            user_id: User ID for tracking
            bot_id: Bot ID for tracking
            tools: List of tool names to make available
            debug_mode: Include debug information in response
            conversation_id: Conversation ID for usage tracking

        Returns:
            Unified response object with content and usage information
        """
        try:
            # Validate context window
            await self._validate_context_window(
                messages, model_name, max_tokens, system
            )

            # Call Anthropic API
            response = await self._complete_anthropic(
                messages,
                model_name,
                system,
                max_tokens,
                temperature,
                tools,
                debug_mode,
                org_id,
                user_id,
                bot_id,
            )

            # Track token usage
            await self._track_usage(
                response=response,
                model=model_name,
                org_id=org_id,
                user_id=user_id,
                bot_id=bot_id,
                conversation_id=conversation_id,
            )

            # Check organization limits
            await self._check_org_limits(org_id)

            return response

        except Exception as e:
            # Log error
            await self._log_error(e, model_name, org_id, user_id, bot_id)
            raise

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        system: str = None,
        max_tokens: int = None,
        temperature: float = None,
        org_id: str = None,
        user_id: str = None,
        bot_id: str = None,
        tools: List[str] = None,
        event_mode: str = "minimal",
        conversation_id: str = None,
    ):
        """
        Generate streaming response with SSE-ready events.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model_name: Name of the model to use
            system: System prompt (separate from messages)
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            org_id: Organization ID for tracking
            user_id: User ID for tracking
            bot_id: Bot ID for tracking
            tools: List of tool names to make available
            event_mode: Event granularity - "minimal" or "verbose"
            conversation_id: Conversation ID for usage tracking
                - "minimal": text_delta, done, error (production chat)
                - "verbose": thinking_start, tool_start, tool_executing, etc. (agent console)

        Yields:
            Dict[str, Any]: Events with 'type' and 'data' keys
                Minimal mode events:
                - {"type": "text_delta", "data": {"delta": "..."}}
                - {"type": "done", "data": {"content": "...", "tokens": {...}}}
                - {"type": "error", "data": {"error": "..."}}

                Verbose mode events (includes all minimal events plus):
                - {"type": "metadata", "data": {"model": "...", "max_tokens": ..., ...}}
                - {"type": "thinking_start", "data": {"iteration": 0, "order": 0}}
                - {"type": "thinking_delta", "data": {"delta": "..."}}
                - {"type": "tool_start", "data": {"tool": "...", "tool_id": "...", ...}}
                - {"type": "tool_input_delta", "data": {"delta": "..."}}
                - {"type": "tool_executing", "data": {"tool": "...", "query": "...", ...}}
                - {"type": "tool_result", "data": {"tool": "...", "result": "...", ...}}
                - {"type": "final_answer", "data": {"content": "...", ...}}
                - {"type": "complete", "data": {"total_tokens": {...}, "response_time_ms": ...}}
        """
        try:
            # Validate context window
            await self._validate_context_window(
                messages, model_name, max_tokens, system
            )

            # Prepare API parameters
            api_params = {
                "model": model_name,
                "messages": messages.copy(),
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            if system:
                # Use prompt caching for system prompts (90% cost reduction on cache hits)
                # Requires minimum 1024 tokens to cache - large prompts benefit most
                api_params["system"] = [
                    {
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ]

            # Add extended thinking for supported models
            if model_name in THINKING_CAPABLE_MODELS:
                thinking_budget = min(10000, int(max_tokens * 0.5))
                if thinking_budget >= 1024:
                    api_params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": thinking_budget,
                    }
                    api_params["temperature"] = 1.0  # Required for extended thinking
                    logger.info(
                        f"🧠 Extended Thinking ENABLED for {model_name} | "
                        f"Budget: {thinking_budget} tokens (50% of max_tokens={max_tokens}) | "
                        f"Temperature forced to 1.0"
                    )
                else:
                    logger.warning(
                        f"⚠️  Extended Thinking NOT enabled for {model_name} | "
                        f"Reason: Budget {thinking_budget} < 1024 tokens (minimum required) | "
                        f"max_tokens={max_tokens} is too low. Increase to at least 2048 to enable thinking."
                    )
            else:
                logger.info(
                    f"ℹ️  Extended Thinking not available for {model_name} | "
                    f"Supported models: {', '.join(THINKING_CAPABLE_MODELS)}"
                )

            # Add tools if provided
            if tools:
                tool_defs = self.tool_registry.get_tools(tools)
                if tool_defs:
                    api_params["tools"] = tool_defs
                    api_params["tool_choice"] = {"type": "auto"}

            # Emit metadata event for verbose mode
            if event_mode == "verbose":
                yield {
                    "type": "metadata",
                    "data": {
                        "model": model_name,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "tools": tools or [],
                        "system_prompt": system or "",
                    },
                }

            # Multi-iteration streaming loop for tool use
            messages_for_api = messages.copy()
            total_input_tokens = 0
            total_output_tokens = 0
            max_iterations = 5
            iteration = 0
            event_order = 0
            import re

            # Regex for extracting inline <thinking> tags (minimal mode only)
            THINKING_TAG_PATTERN = re.compile(r"<thinking>(.*?)</thinking>", re.DOTALL)

            while iteration < max_iterations:
                api_params["messages"] = messages_for_api

                current_text = ""
                current_thinking = ""
                current_thinking_signature = None
                current_tool_calls = []
                stop_reason = None

                # For minimal mode: inline <thinking> tag parsing
                text_buffer = ""
                in_thinking_tag = False
                thinking_buffer = ""
                has_extended_thinking = False

                async with self.anthropic_client.messages.stream(
                    **api_params
                ) as stream:
                    async for event in stream:
                        if event.type == "message_start":
                            if hasattr(event.message, "usage"):
                                total_input_tokens += event.message.usage.input_tokens
                                # Log prompt cache metrics
                                usage = event.message.usage
                                cache_created = getattr(
                                    usage, "cache_creation_input_tokens", 0
                                )
                                cache_read = getattr(
                                    usage, "cache_read_input_tokens", 0
                                )
                                if cache_created or cache_read:
                                    logger.info(
                                        f"💾 Prompt cache: created={cache_created}, read={cache_read} tokens"
                                    )

                        elif event.type == "content_block_start":
                            if event.content_block.type == "thinking":
                                has_extended_thinking = True
                                current_thinking = ""
                                if hasattr(event.content_block, "signature"):
                                    current_thinking_signature = (
                                        event.content_block.signature
                                    )

                                if event_mode == "verbose":
                                    yield {
                                        "type": "thinking_start",
                                        "data": {
                                            "iteration": iteration,
                                            "order": event_order,
                                        },
                                    }
                                    event_order += 1

                            elif event.content_block.type == "tool_use":
                                current_tool_calls.append(
                                    {
                                        "id": event.content_block.id,
                                        "name": event.content_block.name,
                                        "input": {},
                                        "input_json": "",
                                    }
                                )

                                if event_mode == "verbose":
                                    yield {
                                        "type": "tool_start",
                                        "data": {
                                            "iteration": iteration,
                                            "order": event_order,
                                            "tool": event.content_block.name,
                                            "tool_id": event.content_block.id,
                                        },
                                    }
                                    event_order += 1

                        elif event.type == "content_block_delta":
                            if event.delta.type == "thinking_delta":
                                has_extended_thinking = True
                                current_thinking += event.delta.thinking

                                if event_mode == "verbose":
                                    yield {
                                        "type": "thinking_delta",
                                        "data": {"delta": event.delta.thinking},
                                    }

                            elif event.delta.type == "text_delta":
                                if event_mode == "minimal":
                                    # Parse out <thinking> tags for minimal mode
                                    text_buffer += event.delta.text

                                    while True:
                                        if not in_thinking_tag:
                                            thinking_start = text_buffer.find(
                                                "<thinking>"
                                            )
                                            if thinking_start != -1:
                                                if thinking_start > 0:
                                                    text_before = text_buffer[
                                                        :thinking_start
                                                    ]
                                                    current_text += text_before
                                                    yield {
                                                        "type": "text_delta",
                                                        "data": {"delta": text_before},
                                                    }

                                                in_thinking_tag = True
                                                thinking_buffer = ""
                                                text_buffer = text_buffer[
                                                    thinking_start + 10 :
                                                ]
                                            else:
                                                if len(text_buffer) > 10:
                                                    emit_text = text_buffer[:-10]
                                                    current_text += emit_text
                                                    yield {
                                                        "type": "text_delta",
                                                        "data": {"delta": emit_text},
                                                    }
                                                    text_buffer = text_buffer[-10:]
                                                break
                                        else:
                                            thinking_end = text_buffer.find(
                                                "</thinking>"
                                            )
                                            if thinking_end != -1:
                                                if thinking_end > 0:
                                                    thinking_delta = text_buffer[
                                                        :thinking_end
                                                    ]
                                                    thinking_buffer += thinking_delta
                                                    current_thinking += thinking_delta

                                                in_thinking_tag = False
                                                text_buffer = text_buffer[
                                                    thinking_end + 11 :
                                                ]
                                            else:
                                                if len(text_buffer) > 12:
                                                    thinking_delta = text_buffer[:-12]
                                                    thinking_buffer += thinking_delta
                                                    current_thinking += thinking_delta
                                                    text_buffer = text_buffer[-12:]
                                                break
                                else:
                                    # Verbose mode: emit all text
                                    current_text += event.delta.text
                                    yield {
                                        "type": "text_delta",
                                        "data": {"delta": event.delta.text},
                                    }

                            elif event.delta.type == "input_json_delta":
                                if current_tool_calls:
                                    current_tool_calls[-1][
                                        "input_json"
                                    ] += event.delta.partial_json

                                    if event_mode == "verbose":
                                        yield {
                                            "type": "tool_input_delta",
                                            "data": {"delta": event.delta.partial_json},
                                        }

                        elif event.type == "content_block_stop":
                            if current_tool_calls and current_tool_calls[-1].get(
                                "input_json"
                            ):
                                try:
                                    current_tool_calls[-1]["input"] = json.loads(
                                        current_tool_calls[-1]["input_json"]
                                    )
                                except json.JSONDecodeError:
                                    current_tool_calls[-1]["input"] = {}

                            if hasattr(event, "content_block") and hasattr(
                                event.content_block, "type"
                            ):
                                if event.content_block.type == "thinking" and hasattr(
                                    event.content_block, "signature"
                                ):
                                    current_thinking_signature = (
                                        event.content_block.signature
                                    )

                        elif event.type == "message_delta":
                            stop_reason = event.delta.stop_reason
                            if hasattr(event, "usage"):
                                total_output_tokens += event.usage.output_tokens

                # Flush remaining buffer for minimal mode
                if event_mode == "minimal" and text_buffer:
                    if in_thinking_tag:
                        thinking_buffer += text_buffer
                        current_thinking += text_buffer
                    else:
                        current_text += text_buffer
                        yield {"type": "text_delta", "data": {"delta": text_buffer}}

                # Handle tool execution
                if stop_reason == "tool_use":
                    iteration += 1

                    # Build assistant message with thinking and tools
                    final_assistant_content = []

                    # Add thinking block based on mode
                    if event_mode == "minimal":
                        # Production mode: Only add Extended Thinking with signature
                        # Inline <thinking> tags were already parsed out (not part of API message)
                        if current_thinking and has_extended_thinking:
                            if current_thinking_signature:
                                final_assistant_content.append(
                                    {
                                        "type": "thinking",
                                        "thinking": current_thinking,
                                        "signature": current_thinking_signature,
                                    }
                                )
                            else:
                                logger.warning(
                                    "Extended Thinking detected but no signature captured. "
                                    "Skipping thinking block to prevent API error."
                                )
                    else:
                        # Verbose mode (agent console): Add thinking if present
                        if current_thinking:
                            thinking_block = {
                                "type": "thinking",
                                "thinking": current_thinking,
                            }
                            if current_thinking_signature:
                                thinking_block["signature"] = current_thinking_signature
                            final_assistant_content.append(thinking_block)

                    if current_text:
                        final_assistant_content.append(
                            {"type": "text", "text": current_text}
                        )

                    for tool_call in current_tool_calls:
                        final_assistant_content.append(
                            {
                                "type": "tool_use",
                                "id": tool_call["id"],
                                "name": tool_call["name"],
                                "input": tool_call["input"],
                            }
                        )

                    messages_for_api.append(
                        {"role": "assistant", "content": final_assistant_content}
                    )

                    # Execute tools
                    if not bot_id:
                        raise ModelManagerError(
                            "Cannot execute tools without bot context"
                        )

                    context = {"bot_id": bot_id, "user_id": user_id, "org_id": org_id}
                    tool_results = []

                    for tool_call in current_tool_calls:
                        if event_mode == "verbose":
                            yield {
                                "type": "tool_executing",
                                "data": {
                                    "tool": tool_call["name"],
                                    "query": tool_call["input"].get("query", ""),
                                    "order": event_order,
                                },
                            }
                            event_order += 1

                        result = await self.tool_registry.execute(
                            tool_call["name"], tool_call["input"], context
                        )

                        if event_mode == "verbose":
                            yield {
                                "type": "tool_result",
                                "data": {
                                    "tool": tool_call["name"],
                                    "query": tool_call["input"].get("query", ""),
                                    "result": result,
                                    "tokens_used": len(result.split()),
                                    "order": event_order,
                                },
                            }
                            event_order += 1

                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_call["id"],
                                "content": result,
                            }
                        )

                    messages_for_api.append({"role": "user", "content": tool_results})

                    # Re-enable thinking for next iteration
                    if model_name in THINKING_CAPABLE_MODELS:
                        thinking_budget_iter = min(10000, int(max_tokens * 0.5))
                        if thinking_budget_iter >= 1024:
                            api_params["thinking"] = {
                                "type": "enabled",
                                "budget_tokens": thinking_budget_iter,
                            }
                            api_params["temperature"] = 1.0

                    continue
                else:
                    # Final response completed
                    if event_mode == "minimal":
                        yield {
                            "type": "done",
                            "data": {
                                "content": current_text,
                                "tokens": {
                                    "input": total_input_tokens,
                                    "output": total_output_tokens,
                                },
                            },
                        }
                    else:
                        if current_text:
                            yield {
                                "type": "final_answer",
                                "data": {"content": current_text, "order": event_order},
                            }
                            event_order += 1

                        yield {
                            "type": "complete",
                            "data": {
                                "total_tokens": {
                                    "input": total_input_tokens,
                                    "output": total_output_tokens,
                                },
                                "response_time_ms": 0,  # Caller can track this
                            },
                        }

                    # Track token usage
                    await self._track_usage(
                        response={
                            "usage": {
                                "input_tokens": total_input_tokens,
                                "output_tokens": total_output_tokens,
                            }
                        },
                        model=model_name,
                        org_id=org_id,
                        user_id=user_id,
                        bot_id=bot_id,
                        conversation_id=conversation_id,
                    )

                    break

        except Exception as e:
            logger.error(f"Streaming generation error: {str(e)}", exc_info=True)
            yield {"type": "error", "data": {"error": str(e)}}

    async def _complete_anthropic(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        system: str,
        max_tokens: int,
        temperature: float,
        tools: List[str] = None,
        debug_mode: bool = False,
        org_id: str = None,
        user_id: str = None,
        bot_id: str = None,
    ) -> Dict[str, Any]:
        """Complete using Anthropic API with tool support"""
        if not self.anthropic_client:
            raise ModelManagerError("Anthropic client not initialized")

        # Prepare API parameters
        api_params = {
            "model": model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        if system:
            # Use prompt caching for system prompts (90% cost reduction on cache hits)
            # Requires minimum 1024 tokens to cache - large prompts benefit most
            api_params["system"] = [
                {
                    "type": "text",
                    "text": system,
                    "cache_control": {"type": "ephemeral"},
                }
            ]

        # Add extended thinking for supported models (Claude 3.7+, Claude 4+)
        if model_name in THINKING_CAPABLE_MODELS:
            # Enable extended thinking with a budget
            # Budget calculation: Use up to 50% of max_tokens or 10000, whichever is smaller
            # This ensures we always have room for the actual response
            thinking_budget = min(10000, int(max_tokens * 0.5))
            if thinking_budget >= 1024:  # Minimum budget requirement
                api_params["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": thinking_budget,
                }
                # Anthropic requires temperature=1 when extended thinking is enabled
                api_params["temperature"] = 1.0
                logger.info(
                    f"Extended thinking ENABLED for {model_name} with budget: {thinking_budget} tokens (max_tokens={max_tokens}, temperature forced to 1.0)"
                )
            else:
                logger.warning(
                    f"Extended thinking NOT enabled for {model_name}: budget {thinking_budget} < 1024 tokens (max_tokens={max_tokens}). Increase max_tokens to at least 2048 to enable thinking."
                )
        else:
            logger.debug(f"Extended thinking not supported for model: {model_name}")

        # Add tools if provided
        if tools:
            tool_defs = self.tool_registry.get_tools(tools)
            if tool_defs:
                api_params["tools"] = tool_defs
                api_params["tool_choice"] = {"type": "auto"}

        response = await self.anthropic_client.messages.create(**api_params)

        # Track thinking_models for later iterations
        thinking_models = THINKING_CAPABLE_MODELS

        # Log prompt cache metrics
        if hasattr(response, "usage"):
            cache_created = getattr(response.usage, "cache_creation_input_tokens", 0)
            cache_read = getattr(response.usage, "cache_read_input_tokens", 0)
            if cache_created or cache_read:
                logger.info(
                    f"💾 Prompt cache: created={cache_created}, read={cache_read} tokens"
                )

        # Log initial response for debugging
        block_types = [block.type for block in response.content]
        logger.info(
            f"Initial API response - stop_reason: {response.stop_reason}, content blocks: {len(response.content)}, types: {block_types}"
        )

        # Initialize variables for multi-round tool use
        messages_for_api = messages.copy()
        all_tool_calls_made = []
        all_thinking_blocks = []  # Collect thinking from all rounds
        timeline = []  # NEW: Chronological timeline of events
        event_order = 0  # Track order of events
        total_input_tokens = response.usage.input_tokens
        total_output_tokens = response.usage.output_tokens
        iteration_count = 0
        max_iterations = 5  # Prevent infinite loops

        # Capture thinking blocks from initial response (iteration 0)
        for block in response.content:
            if block.type == "thinking":
                if hasattr(block, "thinking") and block.thinking:
                    all_thinking_blocks.append(block.thinking)
                    timeline.append(
                        {
                            "type": "thinking",
                            "iteration": 0,
                            "content": block.thinking,
                            "order": event_order,
                            "tokens_used": len(block.thinking.split()),
                        }
                    )
                    event_order += 1
                    logger.info(
                        f"Captured thinking block from round 0: {len(block.thinking)} chars"
                    )

        # Multi-round tool use loop
        while response.stop_reason == "tool_use" and iteration_count < max_iterations:
            iteration_count += 1
            logger.debug(f"Tool use iteration {iteration_count} for bot {bot_id}")

            # Add the assistant's response with tool use blocks
            # When extended thinking is enabled, we must include thinking blocks before other content
            assistant_content = []
            for block in response.content:
                if block.type == "thinking":
                    # Include complete thinking block with signature (required when extended thinking is enabled)
                    thinking_block = {"type": "thinking", "thinking": block.thinking}
                    # The signature field is required and must be preserved
                    if hasattr(block, "signature") and block.signature:
                        thinking_block["signature"] = block.signature
                    assistant_content.append(thinking_block)
                elif block.type == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_content.append(
                        {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )

            messages_for_api.append({"role": "assistant", "content": assistant_content})

            # Build execution context
            if not bot_id:
                raise ModelManagerError("Cannot execute tools without bot context")

            context = {"bot_id": bot_id, "user_id": user_id, "org_id": org_id}

            # Execute tools and collect results
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    # Log each tool call with pretty-printed input
                    import json

                    logger.info(
                        f"Tool use detected in round {iteration_count}: {block.name}"
                    )
                    logger.info(f"Tool input:\n{json.dumps(block.input, indent=2)}")

                    # Execute tool via registry with context
                    result = await self.tool_registry.execute(
                        block.name, block.input, context
                    )

                    tool_call_data = {
                        "tool": block.name,
                        "query": block.input.get("query", ""),
                        "results": result,
                        "tokens_used": len(result.split()),
                        "iteration": iteration_count,
                    }
                    all_tool_calls_made.append(tool_call_data)

                    # Add to timeline
                    timeline.append(
                        {
                            "type": "tool_call",
                            "iteration": iteration_count,
                            "tool": block.name,
                            "query": block.input.get("query", ""),
                            "results": result,
                            "tokens_used": len(result.split()),
                            "order": event_order,
                        }
                    )
                    event_order += 1

                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        }
                    )

            # Add tool results as a user message
            messages_for_api.append({"role": "user", "content": tool_results})

            # Make the next API call with updated messages
            next_params = {
                "model": model_name,
                "messages": messages_for_api,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            if system:
                # Use prompt caching for system prompts (consistent with initial call)
                next_params["system"] = [
                    {
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ]

            # Re-enable extended thinking for this iteration (if it was enabled initially)
            if model_name in thinking_models:
                thinking_budget_iter = min(10000, int(max_tokens * 0.5))
                if thinking_budget_iter >= 1024:
                    next_params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": thinking_budget_iter,
                    }
                    next_params["temperature"] = 1.0  # Required for extended thinking

            if tools:
                next_params["tools"] = tool_defs
                next_params["tool_choice"] = {"type": "auto"}

            response = await self.anthropic_client.messages.create(**next_params)

            # Capture thinking blocks from this round
            for block in response.content:
                if block.type == "thinking":
                    if hasattr(block, "thinking") and block.thinking:
                        all_thinking_blocks.append(block.thinking)
                        timeline.append(
                            {
                                "type": "thinking",
                                "iteration": iteration_count
                                + 1,  # This thinking comes after tool execution
                                "content": block.thinking,
                                "order": event_order,
                                "tokens_used": len(block.thinking.split()),
                            }
                        )
                        event_order += 1
                        logger.info(
                            f"Captured thinking block from round {iteration_count}: {len(block.thinking)} chars"
                        )

            # Update totals
            total_input_tokens += response.usage.input_tokens
            total_output_tokens += response.usage.output_tokens

        # After the loop, response contains the final answer (stop_reason != "tool_use")
        # Log if we hit the iteration limit
        if iteration_count >= max_iterations and response.stop_reason == "tool_use":
            logger.warning(
                f"Hit max tool use iterations ({max_iterations}) for bot {bot_id}"
            )

        # Log completion of tool use
        if iteration_count > 0:
            total_tools_called = len(all_tool_calls_made)
            logger.info(
                f"Completed tool use for bot {bot_id}: {iteration_count} rounds, {total_tools_called} total tool calls"
            )

        # Extract text from final response
        final_text = ""
        if response.content and len(response.content) > 0:
            logger.info(
                f"Processing {len(response.content)} content blocks from final response"
            )
            for block in response.content:
                logger.debug(
                    f"Content block type: {block.type if hasattr(block, 'type') else 'unknown'}"
                )
                if hasattr(block, "type") and block.type == "text":
                    if hasattr(block, "text") and block.text:
                        final_text = block.text

        # Use all collected thinking blocks from all rounds
        thinking_content = all_thinking_blocks
        if thinking_content:
            logger.info(
                f"Total thinking blocks captured across all rounds: {len(thinking_content)}"
            )

        if not final_text and iteration_count > 0:
            logger.warning(
                f"No text in final response after {iteration_count} tool rounds for bot {bot_id}"
            )

        # Add final answer to timeline
        if final_text:
            timeline.append(
                {
                    "type": "final_answer",
                    "content": final_text,
                    "order": event_order,
                    "tokens_used": len(final_text.split()),
                }
            )
            event_order += 1

        # Build return object
        if iteration_count > 0:
            # Had tool use
            return_obj = {
                "content": [{"text": final_text}],
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                },
                "provider": "anthropic",
                "model": model_name,
            }
        else:
            # No tool calls
            # Extract text from response, handling empty content
            response_text = ""
            if response.content and len(response.content) > 0:
                response_text = response.content[0].text
            else:
                logger.warning(f"Empty content in response for bot {bot_id}")

            return_obj = {
                "content": [{"text": response_text}],
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
                "provider": "anthropic",
                "model": model_name,
            }

        if debug_mode:
            return_obj["debug_tool_calls"] = all_tool_calls_made
            return_obj["debug_system_prompt"] = system
            if iteration_count > 0:
                return_obj["debug_tool_iterations"] = iteration_count
            if thinking_content:
                return_obj["debug_thinking"] = thinking_content
            # Add timeline for chronological view
            return_obj["debug_timeline"] = timeline
            logger.info(f"Timeline contains {len(timeline)} events")

        return return_obj

    async def _validate_context_window(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        max_tokens: int,
        system: str = None,
    ):
        """Validate that the request fits within the model's context window"""
        config = self.get_model_config(model_name)
        context_limit = config["context_window"]

        # Estimate token count (rough estimate: 4 chars per token)
        total_chars = sum(len(msg["content"]) for msg in messages)
        if system:
            total_chars += len(system)

        estimated_tokens = total_chars // 4

        if estimated_tokens + max_tokens > context_limit:
            raise ModelManagerError(
                f"Request exceeds context window for {model_name}. "
                f"Estimated tokens: {estimated_tokens}, Max output: {max_tokens}, "
                f"Context limit: {context_limit}"
            )

    async def _track_usage(
        self,
        response: Dict[str, Any],
        model: str,
        org_id: str = None,
        user_id: str = None,
        bot_id: str = None,
        conversation_id: str = None,
    ):
        """Track token usage in database"""
        if not self.supabase:
            return

        try:
            usage = response["usage"]
            cost = self._calculate_cost(
                model, usage["input_tokens"], usage["output_tokens"]
            )

            # Insert into database
            result = (
                self.supabase.table("token_usage")
                .insert(
                    {
                        "id": str(uuid.uuid4()),
                        "clerk_org_id": org_id,
                        "mentor_bot_id": bot_id,
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "model": model,
                        "input_tokens": usage["input_tokens"],
                        "output_tokens": usage["output_tokens"],
                        "cost_usd": float(cost),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
                .execute()
            )

            # Update Redis cache for quick lookups
            if self.redis:
                daily_key = f"usage:{org_id}:{datetime.now(timezone.utc).date()}"
                await self.redis.incrby(
                    daily_key, usage["input_tokens"] + usage["output_tokens"]
                )
                await self.redis.expire(daily_key, 86400)  # 24 hours

        except Exception as e:
            logger.error(f"Failed to track usage: {str(e)}")

    def _calculate_cost(
        self, model: str, input_tokens: int, output_tokens: int
    ) -> Decimal:
        """Calculate cost in USD for token usage"""
        config = self.get_model_config(model)

        # Check if this is a Claude 4 model with long context pricing
        claude_4_models = [
            "claude-sonnet-4-20250514",
            "claude-opus-4-20250514",
            "claude-opus-4-1-20250805",
        ]
        if (
            model in claude_4_models
            and "long_context" in config
            and input_tokens > 200_000
        ):
            # Use long context pricing for >200K input tokens
            long_config = config["long_context"]
            input_cost = (
                Decimal(input_tokens)
                * Decimal(long_config["input_price"])
                / Decimal(1_000_000)
            )
            output_cost = (
                Decimal(output_tokens)
                * Decimal(long_config["output_price"])
                / Decimal(1_000_000)
            )
        else:
            # Use standard pricing
            input_cost = (
                Decimal(input_tokens)
                * Decimal(config["input_price"])
                / Decimal(1_000_000)
            )
            output_cost = (
                Decimal(output_tokens)
                * Decimal(config["output_price"])
                / Decimal(1_000_000)
            )

        return input_cost + output_cost

    async def _check_org_limits(self, org_id: str):
        """Check if organization is approaching token limits"""
        if not org_id or not self.supabase:
            return

        try:
            # Get today's usage
            today = datetime.now(timezone.utc).date()
            result = self.supabase.rpc(
                "get_org_token_usage",
                {"org_id": org_id, "date_param": today.isoformat()},
            ).execute()

            if result.data and len(result.data) > 0:
                total_tokens = result.data[0].get("total_tokens", 0)

                # Alert at 90% of daily limit (90k of 100k)
                if total_tokens > 90_000:
                    await self._send_limit_alert(org_id, total_tokens)

                # Hard stop at 100k
                if total_tokens >= 100_000:
                    raise ModelManagerError("Organization daily token limit exceeded")

        except Exception as e:
            logger.error(f"Failed to check org limits: {str(e)}")

    async def _send_limit_alert(self, org_id: str, current_usage: int):
        """Send alert when approaching limits"""
        if not self.supabase:
            return

        try:
            # Log alert to database
            self.supabase.table("alerts").insert(
                {
                    "clerk_org_id": org_id,
                    "alert_type": "token_limit_warning",
                    "details": {
                        "current_usage": current_usage,
                        "limit": 100_000,
                        "percentage": (current_usage / 100_000) * 100,
                    },
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()

            logger.warning(
                f"Organization {org_id} approaching token limit: {current_usage}/100000"
            )

        except Exception as e:
            logger.error(f"Failed to send limit alert: {str(e)}")

    async def _log_error(
        self,
        error: Exception,
        model: str,
        org_id: str = None,
        user_id: str = None,
        bot_id: str = None,
    ):
        """Log errors to database"""
        if not self.supabase:
            return

        try:
            self.supabase.table("error_log").insert(
                {
                    "error_type": type(error).__name__,
                    "error_message": str(error),
                    "context": {
                        "model": model,
                        "org_id": org_id,
                        "user_id": user_id,
                        "bot_id": bot_id,
                    },
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()

        except Exception as e:
            logger.error(f"Failed to log error: {str(e)}")

    async def get_usage_stats(
        self, org_id: str, start_date: str = None, end_date: str = None
    ) -> Dict[str, Any]:
        """Get usage statistics for an organization"""
        if not self.supabase:
            return {"error": "Database not available"}

        try:
            query = (
                self.supabase.table("token_usage")
                .select("*")
                .eq("clerk_org_id", org_id)
            )

            if start_date:
                query = query.gte("created_at", start_date)
            if end_date:
                query = query.lte("created_at", end_date)

            result = query.execute()

            if not result.data:
                return {
                    "total_tokens": 0,
                    "total_cost": 0,
                    "by_model": {},
                    "by_bot": {},
                }

            # Aggregate statistics
            total_tokens = 0
            total_cost = Decimal(0)
            by_model = {}
            by_bot = {}

            for record in result.data:
                tokens = record["input_tokens"] + record["output_tokens"]
                cost = Decimal(str(record["cost_usd"]))

                total_tokens += tokens
                total_cost += cost

                # By model
                model = record["model"]
                if model not in by_model:
                    by_model[model] = {"tokens": 0, "cost": Decimal(0)}
                by_model[model]["tokens"] += tokens
                by_model[model]["cost"] += cost

                # By bot
                bot_id = record.get("mentor_bot_id")
                if bot_id:
                    if bot_id not in by_bot:
                        by_bot[bot_id] = {"tokens": 0, "cost": Decimal(0)}
                    by_bot[bot_id]["tokens"] += tokens
                    by_bot[bot_id]["cost"] += cost

            return {
                "total_tokens": total_tokens,
                "total_cost": float(total_cost),
                "by_model": {
                    k: {"tokens": v["tokens"], "cost": float(v["cost"])}
                    for k, v in by_model.items()
                },
                "by_bot": {
                    k: {"tokens": v["tokens"], "cost": float(v["cost"])}
                    for k, v in by_bot.items()
                },
            }

        except Exception as e:
            logger.error(f"Failed to get usage stats: {str(e)}")
            return {
                "total_tokens": 0,
                "total_cost": 0,
                "by_model": {},
                "by_bot": {},
                "error": str(e),
            }
