"""
Minimal Slack Bot Handler - Stateless Mentor Bot with Robust Error Handling

This module provides a simplified, stateless Slack bot that:
1. Handles /ask commands from authorized Slack workspaces
2. Searches mentor knowledge in Graphiti
3. Generates responses using configured system prompt from database
4. Tracks token usage for billing
5. Maintains org-scoped security without user state

NO user creation, NO sessions, NO memory, NO Zep integration
"""

import hmac
import hashlib
import logging
from datetime import datetime, timezone
from fastapi import Request, HTTPException
from typing import Dict, Any, Optional
import json
from urllib.parse import parse_qs

logger = logging.getLogger(__name__)


class SlackBotError(Exception):
    """Base exception for Slack bot errors"""

    pass


class GraphitiTimeoutError(SlackBotError):
    """Graphiti search timeout or failure"""

    pass


class ClaudeRateLimitError(SlackBotError):
    """Claude API rate limit exceeded"""

    pass


class SlackBot:
    """Minimal Slack bot handler for stateless mentor interactions"""

    def __init__(self, supabase, model_manager, graphiti_client):
        """
        Initialize Slack bot handler

        Args:
            supabase: Supabase client for database operations
            model_manager: Unified model API manager
            graphiti_client: Graphiti client for knowledge search
        """
        self.supabase = supabase
        self.model_manager = model_manager
        self.graphiti = graphiti_client

    async def handle_webhook(self, bot_id: str, request: Request) -> Dict[str, Any]:
        """
        Main webhook handler for Slack /ask commands

        Args:
            bot_id: Mentor bot identifier from URL path
            request: FastAPI request object

        Returns:
            Slack-formatted response dictionary
        """
        try:
            # 1. Parse Slack webhook
            data = await self._parse_slack_request(request)

            # 2. Validate bot + workspace access + verify signature
            bot_config = await self._validate_access_and_signature(
                bot_id, data["team_id"], request
            )

            # 3. Process /ask command
            if data.get("command") == "/ask" and data.get("text"):
                # Extract Slack user info for conversation tracking
                slack_user_id = data.get("user_id")
                slack_channel_id = data.get("channel_id")
                slack_user_name = data.get(
                    "user_name"
                )  # Slack provides this in some webhooks

                # Respond immediately to avoid Slack timeout
                response_url = data.get("response_url")
                if response_url:
                    # Start async processing and respond via webhook
                    import asyncio

                    asyncio.create_task(
                        self._handle_ask_async(
                            data["text"],
                            bot_config,
                            response_url,
                            slack_user_id,
                            slack_channel_id,
                            slack_user_name,
                        )
                    )
                    return {
                        "text": "🤔 Let me think about that...",
                        "response_type": "in_channel",
                    }
                else:
                    # Fallback to direct response (might timeout)
                    response = await self._handle_ask(
                        data["text"],
                        bot_config,
                        slack_user_id,
                        slack_channel_id,
                        slack_user_name,
                    )
                    return {"text": response}
            elif data.get("command") == "/ask":
                return {
                    "text": "Please provide a question after /ask\n\nExample: `/ask How do I improve my leadership skills?`"
                }

            return {"text": "Use `/ask [question]` to query the mentor"}

        except SlackBotError as e:
            logger.error(f"Slack bot error: {str(e)}")
            return {"text": str(e)}
        except Exception as e:
            logger.error(f"Unexpected error in Slack webhook: {str(e)}", exc_info=True)
            return {
                "text": "I'm experiencing technical difficulties. Please try again in a moment."
            }

    async def _parse_slack_request(self, request: Request) -> Dict[str, Any]:
        """
        Parse Slack slash command webhook

        Args:
            request: FastAPI request object

        Returns:
            Parsed webhook data dictionary

        Raises:
            SlackBotError: If request format is invalid
        """
        try:
            body = await request.body()
            content_type = request.headers.get("content-type", "")

            if "application/x-www-form-urlencoded" in content_type:
                # Slack slash command format
                data = parse_qs(body.decode("utf-8"))
                return {
                    "command": data.get("command", [""])[0],
                    "text": data.get("text", [""])[0].strip(),
                    "team_id": data.get("team_id", [""])[0],
                    "user_id": data.get("user_id", [""])[0],
                    "user_name": data.get("user_name", [""])[0],
                    "channel_id": data.get("channel_id", [""])[0],
                    "response_url": data.get("response_url", [""])[0],
                }
            else:
                raise SlackBotError("Invalid Slack request format - expected form data")

        except Exception as e:
            raise SlackBotError(f"Failed to parse Slack request: {str(e)}")

    async def _verify_slack_signature(
        self, request: Request, signing_secret: str, body: bytes
    ) -> bool:
        """
        Verify Slack request signature for security

        Args:
            request: FastAPI request object
            signing_secret: Slack signing secret for this workspace
            body: Raw request body bytes

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            if not signing_secret:
                logger.warning(
                    "No Slack signing secret configured - skipping verification"
                )
                return True  # Allow for initial setup/testing

            # Get signature headers
            timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
            signature = request.headers.get("X-Slack-Signature", "")

            if not timestamp or not signature:
                logger.warning("Missing Slack signature headers")
                return False

            # Check timestamp is recent (within 5 minutes)
            try:
                current_time = datetime.now(timezone.utc).timestamp()
                if abs(current_time - int(timestamp)) > 300:  # 5 minutes
                    logger.warning("Slack request timestamp too old")
                    return False
            except ValueError:
                logger.warning("Invalid Slack timestamp format")
                return False

            # Create signature base string
            sig_basestring = f"v0:{timestamp}:{body.decode('utf-8')}"

            # Calculate expected signature
            expected_sig = (
                "v0="
                + hmac.new(
                    signing_secret.encode(), sig_basestring.encode(), hashlib.sha256
                ).hexdigest()
            )

            # Compare signatures securely
            is_valid = hmac.compare_digest(expected_sig, signature)
            if not is_valid:
                logger.warning("Slack signature verification failed")

            return is_valid

        except Exception as e:
            logger.error(f"Signature verification error: {str(e)}")
            return False

    async def _handle_ask_async(
        self,
        question: str,
        bot_config: Dict[str, Any],
        response_url: str,
        slack_user_id: str = None,
        slack_channel_id: str = None,
        slack_user_name: str = None,
    ):
        """
        Handle ask command asynchronously and send response via webhook

        Args:
            question: User's question
            bot_config: Bot and workspace configuration
            response_url: Slack response URL for delayed response
            slack_user_id: Slack user ID for conversation tracking
            slack_channel_id: Slack channel ID for thread tracking
            slack_user_name: Slack user display name
        """
        try:
            # Generate the response
            response_text = await self._handle_ask(
                question, bot_config, slack_user_id, slack_channel_id, slack_user_name
            )

            # Send response back to Slack via webhook
            import httpx

            async with httpx.AsyncClient() as client:
                await client.post(
                    response_url,
                    json={"text": response_text, "response_type": "in_channel"},
                )

            logger.info("Successfully sent async response to Slack")

        except Exception as e:
            logger.error(f"Failed to send async response: {str(e)}")
            # Send error message to Slack
            try:
                import httpx

                async with httpx.AsyncClient() as client:
                    await client.post(
                        response_url,
                        json={
                            "text": "I encountered an error processing your question. Please try again.",
                            "response_type": "ephemeral",
                        },
                    )
            except:
                pass  # Don't fail if we can't send error either

    async def _validate_access_and_signature(
        self, bot_id: str, slack_workspace_id: str, request: Request
    ) -> Dict[str, Any]:
        """
        Validate workspace has access to bot + verify signature

        Args:
            bot_id: Mentor bot identifier
            slack_workspace_id: Slack team_id from webhook
            request: FastAPI request object

        Returns:
            Bot configuration dictionary

        Raises:
            SlackBotError: If access denied or signature invalid
        """
        try:
            # Query bot configuration and workspace access
            result = (
                self.supabase.table("slack_installation")
                .select(
                    """
                *,
                mentor_bot (
                    id,
                    clerk_org_id,
                    name,
                    system_prompt,
                    max_tokens,
                    temperature,
                    model_name,
                    model_provider
                ),
                slack_app (
                    slack_signing_secret
                )
            """
                )
                .eq("mentor_bot_id", bot_id)
                .eq("slack_workspace_id", slack_workspace_id)
                .eq("is_active", True)
                .execute()
            )

            if not result.data:
                raise SlackBotError(
                    "❌ Bot not authorized for this workspace. Please contact your administrator."
                )

            workspace_config = result.data[0]

            # Verify Slack signature
            body = await request.body()
            signing_secret = workspace_config.get("slack_app", {}).get("slack_signing_secret")
            if not await self._verify_slack_signature(request, signing_secret, body):
                raise SlackBotError("❌ Invalid request signature")

            return workspace_config

        except Exception as e:
            if isinstance(e, SlackBotError):
                raise
            logger.error(f"Access validation failed: {str(e)}")
            raise SlackBotError("❌ Access validation failed. Please try again.")

    async def _get_or_create_conversation(
        self,
        bot_config: Dict[str, Any],
        slack_user_id: str,
        slack_channel_id: str,
        slack_user_name: str = None,
    ) -> str:
        """
        Get existing conversation or create new one for Slack thread

        Args:
            bot_config: Bot and workspace configuration
            slack_user_id: Slack user ID (e.g., U12345)
            slack_channel_id: Slack channel ID (used as thread identifier)
            slack_user_name: Slack user display name (optional)

        Returns:
            Conversation ID (UUID)
        """
        try:
            mentor_bot = bot_config["mentor_bot"]
            clerk_org_id = mentor_bot["clerk_org_id"]
            bot_id = mentor_bot["id"]

            # Try to find existing conversation for this Slack thread
            result = (
                self.supabase.table("conversation")
                .select("id")
                .eq("platform", "slack")
                .eq("platform_thread_id", slack_channel_id)
                .eq("platform_user_id", slack_user_id)
                .eq("mentor_bot_id", bot_id)
                .execute()
            )

            if result.data and len(result.data) > 0:
                logger.info(
                    f"Found existing Slack conversation: {result.data[0]['id']}"
                )
                return result.data[0]["id"]

            # Create new conversation
            conversation_data = {
                "clerk_org_id": clerk_org_id,
                "mentor_bot_id": bot_id,
                "platform": "slack",
                "platform_thread_id": slack_channel_id,
                "platform_user_id": slack_user_id,
                "platform_user_name": slack_user_name
                or f"Slack User {slack_user_id[:8]}",
                "clerk_user_id": None,  # Slack users are not Clerk users
                "title": f"Slack conversation with {slack_user_name or slack_user_id[:8]}",
                "message_count": 0,
            }

            result = (
                self.supabase.table("conversation").insert(conversation_data).execute()
            )

            if not result.data or len(result.data) == 0:
                raise SlackBotError("Failed to create conversation")

            conversation_id = result.data[0]["id"]
            logger.info(f"Created new Slack conversation: {conversation_id}")
            return conversation_id

        except Exception as e:
            logger.error(f"Failed to get/create conversation: {str(e)}")
            raise SlackBotError("Failed to initialize conversation")

    async def _save_message(
        self, conversation_id: str, role: str, content: str
    ) -> None:
        """
        Save a message to the database

        Args:
            conversation_id: Conversation UUID
            role: Message role ('user' or 'assistant')
            content: Message content
        """
        try:
            message_data = {
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "metadata": {},
            }

            self.supabase.table("message").insert(message_data).execute()
            logger.info(f"Saved {role} message to conversation {conversation_id}")

        except Exception as e:
            logger.error(f"Failed to save message: {str(e)}")
            # Don't raise - message saving failure shouldn't block the response

    async def _handle_ask(
        self,
        question: str,
        bot_config: Dict[str, Any],
        slack_user_id: str = None,
        slack_channel_id: str = None,
        slack_user_name: str = None,
    ) -> str:
        """
        Process ask command with comprehensive error handling

        Args:
            question: User's question
            bot_config: Bot and workspace configuration
            slack_user_id: Slack user ID for conversation tracking
            slack_channel_id: Slack channel ID for thread tracking
            slack_user_name: Slack user display name

        Returns:
            Generated response text

        Raises:
            SlackBotError: For handled error conditions
        """
        if not question.strip():
            return "Please provide a question to ask the mentor.\n\nExample: `/ask How do I improve my leadership skills?`"

        # Limit question length
        if len(question) > 10000:
            return "Your question is too long. Please keep it under 10,000 characters."

        try:
            mentor_bot = bot_config["mentor_bot"]
            clerk_org_id = mentor_bot["clerk_org_id"]

            # Get or create conversation for this Slack thread
            conversation_id = None
            if slack_user_id and slack_channel_id:
                try:
                    conversation_id = await self._get_or_create_conversation(
                        bot_config, slack_user_id, slack_channel_id, slack_user_name
                    )
                except Exception as e:
                    logger.error(
                        f"Conversation creation failed, continuing without persistence: {str(e)}"
                    )
                    # Continue without conversation tracking if it fails

            # Save user message if we have a conversation
            if conversation_id:
                await self._save_message(conversation_id, "user", question)

            # Get system prompt from database - REQUIRED, no fallbacks
            system_prompt = mentor_bot.get("system_prompt")
            if not system_prompt or not system_prompt.strip():
                raise SlackBotError(
                    "❌ Bot configuration error: system_prompt is missing from database"
                )

            # Get model configuration and parameters from database - REQUIRED, no fallbacks
            model_name = mentor_bot.get("model_name")
            if not model_name:
                raise SlackBotError(
                    "❌ Bot configuration error: model_name is missing from database"
                )

            max_tokens = mentor_bot.get("max_tokens")
            if max_tokens is None:
                raise SlackBotError(
                    "❌ Bot configuration error: max_tokens is missing from database"
                )

            temperature = mentor_bot.get("temperature")
            if temperature is None:
                raise SlackBotError(
                    "❌ Bot configuration error: temperature is missing from database"
                )

            temperature = float(temperature)
            logger.info(f"Using bot config: model={model_name}, max_tokens={max_tokens}, temp={temperature}")

            # Call Model API with rate limit handling
            try:
                logger.info(
                    f"_handle_ask: Calling Model API with model: {model_name} and bot_id: {mentor_bot['id']}"
                )
                response = await self.model_manager.generate(
                    messages=[{"role": "user", "content": question}],
                    model_name=model_name,
                    system=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    org_id=clerk_org_id,
                    user_id=None,  # No user tracking for stateless bot
                    bot_id=mentor_bot["id"],
                    tools=["search_knowledge_base"],
                    conversation_id=conversation_id,
                )

                response_text = (
                    response["content"][0]["text"]
                    if response.get("content")
                    else "I couldn't generate a response."
                )

                # Save assistant message if we have a conversation
                if conversation_id:
                    await self._save_message(
                        conversation_id, "assistant", response_text
                    )

                # Token usage is tracked automatically by ModelManager
                logger.info(
                    f"Successfully generated response ({len(response_text)} chars)"
                )
                return response_text

            except Exception as e:
                error_msg = str(e).lower()
                if "rate limit" in error_msg or "too many requests" in error_msg:
                    raise ClaudeRateLimitError(
                        "⏰ Too many requests. Please wait a moment and try again."
                    )
                elif "timeout" in error_msg:
                    raise SlackBotError(
                        "⏰ Request timed out. Please try a shorter question."
                    )
                else:
                    logger.error(f"Model API error: {str(e)}")
                    raise SlackBotError(
                        "🤖 I'm having trouble generating a response. Please try again."
                    )

        except SlackBotError:
            raise  # Re-raise known errors
        except Exception as e:
            logger.error(f"Unexpected error in _handle_ask: {str(e)}", exc_info=True)
            raise SlackBotError(
                "❌ I encountered an unexpected error. Please try again."
            )

    def _format_knowledge_results(self, results) -> str:
        """
        Format Graphiti search results for Claude

        Args:
            results: List of search results from Graphiti

        Returns:
            Formatted knowledge string
        """
        if not results:
            return "No relevant knowledge found in the mentor's knowledge base."

        formatted = []
        for result in results[:5]:  # Limit to top 5 results
            try:
                if hasattr(result, "fact"):
                    formatted.append(f"• {result.fact}")
                elif hasattr(result, "content"):
                    formatted.append(f"• {result.content}")
                elif isinstance(result, str):
                    formatted.append(f"• {result}")
            except Exception as e:
                logger.warning(f"Error formatting knowledge result: {e}")
                continue

        return "\n".join(formatted) if formatted else "No relevant knowledge found."
