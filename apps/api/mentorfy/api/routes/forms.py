"""
Forms Routes

Handles form completion flow:
- Creates conversation after SMS verification
- Stores form data in Supermemory for user context
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import Client

from mentorfy.models.manager import ModelManager


logger = logging.getLogger(__name__)

router = APIRouter(tags=["forms"])

# Global services (set by main app)
supabase_client: Optional[Client] = None
model_manager: Optional[ModelManager] = None


def set_services(supabase: Client, manager: ModelManager):
    """Set the global services for this router"""
    global supabase_client, model_manager
    supabase_client = supabase
    model_manager = manager


class FormCompleteRequest(BaseModel):
    submission_id: str
    clerk_user_id: str
    org_id: str


class FormCompleteResponse(BaseModel):
    conversation_id: str


def format_form_answers(answers: list) -> str:
    """
    Convert form answers to readable text for AI context.

    Args:
        answers: List of answer dicts with questionText and value

    Returns:
        Formatted string like:
        Q: What's your biggest challenge?
        A: Time management

        Q: How stressed are you?
        A: 7 out of 10

    Raises:
        KeyError: If answer is missing required fields
    """
    lines = []
    for answer in answers:
        question = answer["questionText"]
        value = answer["value"]

        # Handle array values (multi-select questions)
        if isinstance(value, list):
            value = ", ".join(str(x) for x in value)

        lines.append(f"Q: {question}\nA: {value}")

    return "\n\n".join(lines)


@router.post("/api/forms/complete", response_model=FormCompleteResponse)
async def complete_form_submission(request: FormCompleteRequest):
    """
    Complete a form submission after SMS verification.

    1. Fetches the submission and linked form
    2. Stores form answers in Supermemory (async, non-blocking)
    3. Creates a conversation with needs_form_greeting flag
    4. Returns conversation ID for redirect
    """

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database unavailable")

    # Fetch submission with form data
    result = (
        supabase_client.table("form_submissions")
        .select("*, forms!inner(bot_id, name)")
        .eq("id", request.submission_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission = result.data
    bot_id = submission["forms"]["bot_id"]
    form_name = submission["forms"]["name"]
    answers = submission.get("answers")

    if not answers:
        raise HTTPException(status_code=400, detail="Submission has no answers")

    # Store form in Supermemory async (non-blocking)
    if model_manager and model_manager.supermemory_enabled:
        form_text = format_form_answers(answers)

        async def store_form_memory():
            try:
                await asyncio.to_thread(
                    model_manager.supermemory_client.memories.add,
                    content=f"Intake Form ({form_name}):\n{form_text}",
                    container_tags=[f"{request.org_id}-{request.clerk_user_id}"],
                    metadata={
                        "type": "intake_form",
                        "form_submission_id": request.submission_id,
                        "org_id": request.org_id,
                        "user_id": request.clerk_user_id,
                    },
                )
                logger.info(f"💾 Stored form answers in Supermemory for {request.clerk_user_id}")
            except Exception as e:
                logger.error(f"❌ Failed to store form in Supermemory: {e}")

        # Fire and forget - don't block the response
        asyncio.create_task(store_form_memory())

    # Create conversation with greeting flag
    conv_result = (
        supabase_client.table("conversation")
        .insert({
            "clerk_user_id": request.clerk_user_id,
            "clerk_org_id": request.org_id,
            "mentor_bot_id": bot_id,
            "title": "Welcome",
            "metadata": {
                "needs_form_greeting": True,
                "form_submission_id": request.submission_id,
            },
        })
        .execute()
    )

    if not conv_result.data:
        raise HTTPException(status_code=500, detail="Failed to create conversation")

    conversation_id = conv_result.data[0]["id"]
    logger.info(f"✅ Created conversation {conversation_id} with form greeting flag")

    return FormCompleteResponse(conversation_id=conversation_id)
