"""
Slack Integration Routes

This module contains Slack integration API endpoints:
- Slack webhook handler for bot commands
- Slack OAuth callback for workspace installation

These routes handle Slack workspace connections, bot installations,
and webhook processing for /ask commands.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from slack_sdk.web.async_client import AsyncWebClient
from supabase import Client

from mentorfy.integrations.slack import SlackBot


# Set up logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/slack", tags=["slack"])

# Global services (set by main app)
supabase_client: Optional[Client] = None
slack_bot_handler: Optional[SlackBot] = None


def set_services(supabase: Client, slack_handler: SlackBot):
    """Set the global services for this router"""
    global supabase_client, slack_bot_handler
    supabase_client = supabase
    slack_bot_handler = slack_handler


@router.post("/{bot_id}")
async def slack_webhook(bot_id: str, request: Request):
    """
    Simplified Slack webhook handler for stateless mentor bot

    This endpoint handles /ask commands from authorized Slack workspaces.
    No user state, memory, or session management - just pure Q&A.
    """
    if not slack_bot_handler:
        raise HTTPException(status_code=503, detail="Slack bot service unavailable")

    try:
        logger.info(f"Received Slack webhook for bot {bot_id}")
        response = await slack_bot_handler.handle_webhook(bot_id, request)
        return response
    except Exception as e:
        logger.error(f"Slack webhook error for bot {bot_id}: {str(e)}", exc_info=True)
        return {
            "text": "I'm experiencing technical difficulties. Please try again in a moment."
        }


@router.get("/oauth/callback")
async def slack_oauth_callback(code: str, state: Optional[str] = None):
    """
    Handle Slack OAuth callback after workspace installation.
    Stores installation with is_active=False for manual approval.

    Flow:
    1. Customer clicks "Add to Slack" button
    2. Slack redirects here with temporary code
    3. Exchange code for bot token using app credentials
    4. Store in slack_installation with is_active=False
    5. Admin approves by updating is_active=True and assigning mentor_bot_id
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        logger.info(
            f"Received Slack OAuth callback with code={code[:10]}... state={state}"
        )

        # Fetch the Slack app that initiated this OAuth flow
        # For now, we assume it's the first/only active app
        # In future, we can encode slack_app_id in the state parameter
        app_result = (
            supabase_client.table("slack_app")
            .select("*")
            .eq("is_active", True)
            .execute()
        )

        if not app_result.data:
            raise HTTPException(
                status_code=500,
                detail="No active Slack app found. Please contact support.",
            )

        # Use the first active app (later we can support multiple apps via state param)
        slack_app = app_result.data[0]

        # Exchange code for access token using Slack SDK
        client = AsyncWebClient()
        oauth_response = await client.oauth_v2_access(
            client_id=slack_app["slack_client_id"],
            client_secret=slack_app["slack_client_secret"],
            code=code,
        )

        if not oauth_response.get("ok"):
            error = oauth_response.get("error", "unknown_error")
            logger.error(f"Slack OAuth failed: {error}")
            raise HTTPException(status_code=400, detail=f"Slack OAuth failed: {error}")

        # Extract installation data
        team_id = oauth_response["team"]["id"]
        team_name = oauth_response["team"]["name"]
        bot_token = oauth_response["access_token"]
        bot_user_id = oauth_response.get("bot_user_id")

        logger.info(
            f"Successfully exchanged code for workspace: {team_name} (ID: {team_id})"
        )

        # Check if this specific app is already installed in this workspace
        # Note: mentor_bot_id may be NULL during initial OAuth - admin assigns it later
        existing = (
            supabase_client.table("slack_installation")
            .select("*")
            .eq("slack_workspace_id", team_id)
            .eq("slack_app_id", slack_app["id"])
            .execute()
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        if existing.data:
            # Re-installation of same app - update tokens
            supabase_client.table("slack_installation").update(
                {
                    "slack_bot_token": bot_token,
                    "slack_team_name": team_name,
                    "slack_bot_user_id": bot_user_id,
                    "updated_at": now_iso,
                }
            ).eq("id", existing.data[0]["id"]).execute()

            logger.info(f"✅ Updated existing installation for workspace {team_id}")
        else:
            # New installation - create pending approval record
            supabase_client.table("slack_installation").insert(
                {
                    "slack_app_id": slack_app["id"],
                    "slack_workspace_id": team_id,
                    "mentor_bot_id": None,  # ⚠️ Admin must assign via dashboard
                    "slack_team_name": team_name,
                    "slack_bot_user_id": bot_user_id,
                    "slack_bot_token": bot_token,
                    # Signing secret comes from slack_app table via foreign key - no duplication needed
                    "is_active": False,  # ⚠️ Admin must approve
                }
            ).execute()

            logger.info(f"✅ Created new pending installation for workspace {team_id}")

        # Return success page or redirect
        return {
            "success": True,
            "message": "Slack app installed successfully! Your Mentorfy contact will activate it shortly.",
            "workspace": team_name,
            "status": "pending_approval",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to complete Slack installation: {str(e)}"
        )
