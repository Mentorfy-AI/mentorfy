"""
Chat Routes

This module contains all chat-related API endpoints:
- Production streaming chat endpoint with thinking and tool visualization
- Debug chat endpoints for testing with full transparency
- Support for Extended Thinking and inline <thinking> tags

These routes handle AI-powered chat interactions with mentor bots,
including tool use, knowledge base search, and user memory integration.
"""

import asyncio
import json
import logging
import re
import time
from datetime import datetime
from typing import Optional

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from supabase import Client

from mentorfy.api.schemas import (
    ChatRequest,
    ChatResponse,
    AgentConsoleRequest,
)
from mentorfy.models.manager import ModelManager, THINKING_CAPABLE_MODELS
from mentorfy.api.routes.forms import format_form_answers


# Set up logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(tags=["chat"])

# Global services (set by main app)
supabase_client: Optional[Client] = None
model_manager: Optional[ModelManager] = None


def set_services(supabase: Client, manager: ModelManager):
    """Set the global services for this router"""
    global supabase_client, model_manager
    supabase_client = supabase
    model_manager = manager


# Production Streaming Chat Endpoint
@router.post("/api/chat/stream", response_model=None)
async def chat_stream(request: ChatRequest, http_request: Request):
    """
    Production streaming chat endpoint with thinking and tool call visualization.
    Returns SSE (Server-Sent Events) for real-time updates.

    Supports both Extended Thinking (when max_tokens >= 2048) and inline <thinking> tags.
    """

    # Tool messages are no longer sent to frontend - status words handle all UI feedback

    # Regex for extracting inline <thinking> tags
    THINKING_TAG_PATTERN = re.compile(r"<thinking>(.*?)</thinking>", re.DOTALL)

    async def event_generator():
        """Generate SSE events for streaming chat"""
        start_time = time.time()

        try:
            # Log incoming request for debugging
            logger.info(f"📥 Chat request: message='{request.message[:50] if request.message else 'EMPTY'}', "
                       f"bot_id={request.bot_id}, "
                       f"file_attachments={len(request.file_attachments) if request.file_attachments else 0}, "
                       f"file_id={request.file_id}, file_base64={'present' if request.file_base64 else 'none'}")

            # Validate inputs
            if not model_manager:
                yield f"event: error\ndata: {json.dumps({'error': 'Model manager unavailable'})}\n\n"
                return

            if not supabase_client:
                yield f"event: error\ndata: {json.dumps({'error': 'Database unavailable'})}\n\n"
                return

            # Check for form greeting (empty message triggers greeting for new form submissions)
            is_form_greeting = False
            form_greeting_message = None

            if (not request.message or not request.message.strip()) and request.conversation_id:
                # Check if conversation has needs_form_greeting flag
                conv_result = (
                    supabase_client.table("conversation")
                    .select("metadata")
                    .eq("id", request.conversation_id)
                    .single()
                    .execute()
                )

                if conv_result.data:
                    metadata = conv_result.data.get("metadata") or {}
                    if metadata.get("needs_form_greeting"):
                        is_form_greeting = True
                        form_submission_id = metadata.get("form_submission_id")

                        if form_submission_id:
                            # Fetch form answers
                            submission_result = (
                                supabase_client.table("form_submissions")
                                .select("answers")
                                .eq("id", form_submission_id)
                                .single()
                                .execute()
                            )

                            if submission_result.data and submission_result.data.get("answers"):
                                form_text = format_form_answers(submission_result.data["answers"])
                                form_greeting_message = f"""Greet this user warmly based on their intake form. Show you understand their situation and invite questions.

{form_text}"""
                                logger.info(f"📋 Form greeting triggered for conversation {request.conversation_id}")

                        # Clear the flag (preserve other metadata)
                        updated_metadata = {**metadata, "needs_form_greeting": False}
                        supabase_client.table("conversation").update(
                            {"metadata": updated_metadata}
                        ).eq("id", request.conversation_id).execute()

            # Allow empty message if file attachments are present OR it's a form greeting
            has_attachments = bool(
                request.file_attachments or
                request.file_id or
                request.file_base64
            )
            logger.info(f"🔍 Validation check: message_empty={not request.message or not request.message.strip()}, "
                       f"has_attachments={has_attachments}, is_form_greeting={is_form_greeting}, "
                       f"will_reject={((not request.message or not request.message.strip()) and not has_attachments and not is_form_greeting)}")

            if (not request.message or not request.message.strip()) and not has_attachments and not is_form_greeting:
                yield f"event: error\ndata: {json.dumps({'error': 'Message or file attachment is required'})}\n\n"
                return

            # Use form greeting message if this is a form greeting, otherwise use request message
            effective_message = form_greeting_message if is_form_greeting else request.message

            if not request.bot_id:
                yield f"event: error\ndata: {json.dumps({'error': 'Bot ID is required'})}\n\n"
                return

            # Get bot configuration
            bot_result = (
                supabase_client.table("mentor_bot")
                .select("*")
                .eq("id", request.bot_id)
                .execute()
            )

            if not bot_result.data:
                yield f"event: error\ndata: {json.dumps({'error': 'Mentor bot not found'})}\n\n"
                return

            mentor_bot = bot_result.data[0]
            base_system_prompt = mentor_bot.get("system_prompt")
            if not base_system_prompt:
                raise ValueError("System prompt is required in the database")

            # Check if this bot has memory enabled
            bot_memory_enabled = mentor_bot.get("enable_memory", True)

            # Fetch user context from Supermemory (if enabled for both system and bot)
            user_context = ""
            if model_manager.supermemory_enabled and bot_memory_enabled and request.user_id:
                try:
                    org_id = mentor_bot.get("clerk_org_id", "unknown")
                    user_id_scoped = f"{org_id}-{request.user_id}"

                    # Search for relevant memories (query-filtered for relevance)
                    search_results = await asyncio.to_thread(
                        model_manager.supermemory_client.search.memories,
                        q=effective_message,  # Filter by current message
                        container_tag=user_id_scoped,
                        limit=5,
                    )

                    # Extract and format results
                    if search_results.results:
                        context_items = []
                        for result in search_results.results:
                            content = getattr(result, "content", None) or getattr(
                                result, "memory", ""
                            )
                            if content:
                                context_items.append(content)

                        if context_items:
                            user_context = "\n".join(context_items)
                            logger.info(
                                f"📝 Supermemory: Found {len(context_items)} context items for {user_id_scoped}"
                            )
                except Exception as e:
                    logger.error(f"❌ Supermemory context fetch failed: {e}")
                    # Don't fail the request - continue without context

            # Build system prompt with optional user context
            if user_context:
                system_prompt = f"""{base_system_prompt}

## User Context
The following information has been remembered from previous conversations with this user:
{user_context}
"""
            else:
                system_prompt = base_system_prompt

            # Build conversation history
            conversation_history = []
            if request.previous_messages:
                for msg in request.previous_messages:
                    content = msg.get("content", "")
                    # Skip messages with empty content to prevent Anthropic API errors
                    if content and content.strip():
                        conversation_history.append(
                            {
                                "role": msg.get("role", "user"),
                                "content": content,
                            }
                        )

            # Get model settings
            model_name = mentor_bot.get("model_name")
            temperature = mentor_bot.get("temperature")
            max_tokens = mentor_bot.get("max_tokens")

            if not max_tokens:
                raise ValueError("max_tokens is required")
            if not model_name:
                raise ValueError("Model name is required")
            if not temperature:
                raise ValueError("Temperature is required")

            # Prepare tools
            tools = ["search_knowledge_base"]

            # Build messages
            messages = []
            if conversation_history:
                messages.extend(conversation_history)

            # Build user message content (support multiple file attachments)
            # Only add text block if message is not empty
            user_content = []
            if effective_message and effective_message.strip():
                user_content.append({"type": "text", "text": effective_message})

            has_documents = False

            # NEW: Support multiple file attachments via file_attachments array
            if request.file_attachments:
                for attachment in request.file_attachments:
                    attachment_type = attachment.get("type")

                    if attachment_type == "image":
                        user_content.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": attachment.get("media_type", "image/png"),
                                "data": attachment["base64"],
                            },
                        })
                        logger.info(f"📎 Added image attachment (base64)")
                    elif attachment_type == "document":
                        user_content.append({
                            "type": "document",
                            "source": {"type": "file", "file_id": attachment["file_id"]},
                        })
                        has_documents = True
                        logger.info(f"📎 Added document attachment: {attachment['file_id']}")

                messages.append({"role": "user", "content": user_content})
                logger.info(f"📎 Message includes {len(request.file_attachments)} attachment(s)")

            # LEGACY: Support single file for backward compatibility
            elif request.file_base64:
                user_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": request.file_type or "image/png",
                        "data": request.file_base64,
                    },
                })
                messages.append({"role": "user", "content": user_content})
                logger.info(f"📎 Message includes image attachment (base64, legacy)")
            elif request.file_id:
                user_content.append({
                    "type": "document",
                    "source": {"type": "file", "file_id": request.file_id},
                })
                has_documents = True
                messages.append({"role": "user", "content": user_content})
                logger.info(f"📎 Message includes document attachment (legacy): {request.file_id}")
            else:
                # Text-only message - validate it's not empty
                if not effective_message or not effective_message.strip():
                    yield f"event: error\ndata: {json.dumps({'error': 'Message cannot be empty'})}\n\n"
                    return
                messages.append({"role": "user", "content": effective_message})

            # Prepare API parameters
            api_params = {
                "model": model_name,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            if system_prompt:
                api_params["system"] = system_prompt

            # Add extended thinking for supported models
            if model_name in THINKING_CAPABLE_MODELS:
                thinking_budget = min(10000, int(max_tokens * 0.5))
                if thinking_budget >= 1024:
                    api_params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": thinking_budget,
                    }
                    api_params["temperature"] = 1.0  # Required for extended thinking

            # Add tools
            if tools:
                tool_defs = model_manager.tool_registry.get_tools(tools)
                if tool_defs:
                    api_params["tools"] = tool_defs
                    api_params["tool_choice"] = {"type": "auto"}

            # Use appropriate client based on whether we have file attachments
            # Files API requires beta header, but it must be set on the client, not the request
            if has_documents or request.file_id:
                # Create client with Files API beta header
                # Temporarily swap the client on ModelManager
                original_client = model_manager.anthropic_client
                model_manager.anthropic_client = AsyncAnthropic(
                    api_key=original_client.api_key,
                    default_headers={
                        "anthropic-beta": "files-api-2025-04-14"  # Files API support
                    },
                )

            # Initialize current_text before streaming to avoid UnboundLocalError if streaming fails
            current_text = ""

            try:
                # Stream the response using ModelManager
                async for event in model_manager.generate_stream(
                    messages=messages,
                    model_name=model_name,
                    system=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    org_id=mentor_bot["clerk_org_id"],
                    user_id=request.user_id,
                    bot_id=request.bot_id,
                    tools=tools,
                    event_mode="minimal",
                    conversation_id=request.conversation_id,
                ):
                    # Convert event dict to SSE format
                    event_type = event["type"]
                    event_data = event["data"]

                    yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"

                    # Capture final content for Supermemory
                    if event_type == "done":
                        current_text = event_data.get("content", "")
            finally:
                # Restore original client if we swapped it
                if has_documents or request.file_id:
                    model_manager.anthropic_client = original_client

            # Store conversation turn in Supermemory (after streaming completes)
            # Only store if: supermemory enabled globally AND bot has memory enabled AND user_id present
            # Skip for form greetings - the form answers are already stored separately
            if model_manager.supermemory_enabled and bot_memory_enabled and request.user_id and current_text and not is_form_greeting:
                try:
                    org_id = mentor_bot.get("clerk_org_id", "unknown")
                    user_id_scoped = f"{org_id}-{request.user_id}"

                    # Format conversation turn
                    conversation_content = (
                        f"User: {request.message}\nAssistant: {current_text}"
                    )

                    # Store with scoped container tag + metadata
                    await asyncio.to_thread(
                        model_manager.supermemory_client.memories.add,
                        content=conversation_content,
                        container_tags=[user_id_scoped],
                        metadata={
                            "org_id": org_id,
                            "user_id": request.user_id,
                            "bot_id": request.bot_id,
                            "conversation_id": request.conversation_id,
                        },
                    )
                    logger.info(
                        f"💾 Supermemory: Stored conversation for {user_id_scoped}"
                    )
                except Exception as e:
                    logger.error(f"❌ Supermemory storage failed: {e}")

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Chat stream error: {str(e)}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Agent Console Endpoint
@router.post("/internal/agent-console/stream")
async def agent_console_stream_endpoint(request: AgentConsoleRequest):
    """
    Agent console streaming endpoint for real-time tool/thinking/response events.
    Powers the internal agent console UI with full transparency for debugging.
    Returns SSE (Server-Sent Events) stream.
    """

    async def event_generator():
        """Generate SSE events for streaming debug data"""
        start_time = time.time()

        try:
            # Get bot configuration
            bot_result = (
                supabase_client.table("mentor_bot")
                .select("*")
                .eq("id", request.bot_id)
                .execute()
            )
            if not bot_result.data:
                yield f"event: error\ndata: {json.dumps({'error': 'Mentor bot not found'})}\n\n"
                return

            mentor_bot = bot_result.data[0]

            # Get system prompt from database or use override
            system_prompt = (
                request.override_system_prompt
                if request.override_system_prompt
                else mentor_bot.get("system_prompt", "You are a helpful assistant.")
            )

            # Build conversation history
            conversation_history = []
            if request.previous_messages:
                for msg in request.previous_messages:
                    conversation_history.append(
                        {
                            "role": "user" if msg.get("isUser") else "assistant",
                            "content": msg.get("content", ""),
                        }
                    )

            # Get model configuration (use override if provided)
            model_name = (
                request.override_model
                if request.override_model
                else mentor_bot.get("model_name", "claude-3-haiku-20240307")
            )
            temperature = mentor_bot.get("temperature")
            if not temperature:
                raise ValueError("temperature is required")
            max_tokens = mentor_bot.get("max_tokens")
            if not max_tokens:
                raise ValueError("max_tokens is required")

            # Prepare tools
            tools = ["search_knowledge_base"]

            # Build messages
            messages = []
            if conversation_history:
                messages.extend(conversation_history)
            messages.append({"role": "user", "content": request.message})

            # Stream the response using ModelManager with verbose events
            async for event in model_manager.generate_stream(
                messages=messages,
                model_name=model_name,
                system=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                org_id=mentor_bot["clerk_org_id"],
                user_id=None,  # No user tracking for agent console
                bot_id=mentor_bot["id"],
                tools=tools,
                event_mode="verbose",
                conversation_id=None,  # Agent console doesn't use conversations
            ):
                # Convert event dict to SSE format
                event_type = event["type"]
                event_data = event["data"]

                # Add response_time_ms to complete event
                if event_type == "complete":
                    event_data["response_time_ms"] = int(
                        (time.time() - start_time) * 1000
                    )

                yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"

        except Exception as e:
            logger.error(f"Agent console streaming error: {str(e)}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
