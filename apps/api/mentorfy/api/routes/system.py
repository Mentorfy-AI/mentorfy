"""
System Routes

This module contains system-level API endpoints:
- Root endpoint
- Health check
- Bot configuration updates
- System metrics
- Tool registry

These routes handle general system operations, monitoring,
and administrative functions.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from supabase import Client

from mentorfy.api.schemas import (
    HealthResponse,
    SystemPromptUpdate,
)
from mentorfy.core.queues import get_redis_connection
from mentorfy.core.metrics import collect_metrics
from mentorfy.models.manager import ModelManager


# Set up logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(tags=["system"])

# Global services (set by main app)
supabase_client: Optional[Client] = None
model_manager: Optional[ModelManager] = None


def set_services(supabase: Client, manager: ModelManager):
    """Set the global services for this router"""
    global supabase_client, model_manager
    supabase_client = supabase
    model_manager = manager


@router.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Mentorfy Document Processing API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
    }


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Comprehensive health check for all services"""
    services = {
        "supabase": supabase_client is not None,
        "model_manager": model_manager is not None,
    }

    # Test Redis connectivity
    try:
        redis_conn = get_redis_connection()
        redis_conn.ping()
        services["redis"] = True
    except:
        services["redis"] = False

    # Test Graphiti connectivity (imported dynamically to avoid circular deps)
    try:
        from mentorfy.db.neo4j import get_graphiti_client

        graphiti_client = get_graphiti_client()
        if graphiti_client:
            await graphiti_client.search("test", num_results=1)
            services["graphiti_connectivity"] = True
    except:
        services["graphiti_connectivity"] = False

    all_healthy = all(services.values())

    return HealthResponse(
        status="healthy" if all_healthy else "degraded",
        services=services,
        timestamp=datetime.now(timezone.utc),
    )


@router.patch("/api/mentor-bots/{bot_id}/system-prompt")
async def update_system_prompt(bot_id: str, update: SystemPromptUpdate):
    """Update the system prompt for a specific mentor bot"""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Validate system prompt
        if not update.system_prompt or not update.system_prompt.strip():
            raise HTTPException(status_code=400, detail="System prompt cannot be empty")

        if len(update.system_prompt) > 50000:
            raise HTTPException(
                status_code=400,
                detail=f"System prompt exceeds maximum length of 50,000 characters (current: {len(update.system_prompt)})",
            )

        # Check if bot exists
        bot_result = (
            supabase_client.table("mentor_bot")
            .select("id, name")
            .eq("id", bot_id)
            .execute()
        )

        if not bot_result.data:
            raise HTTPException(status_code=404, detail="Mentor bot not found")

        # Update the system prompt
        update_result = (
            supabase_client.table("mentor_bot")
            .update(
                {
                    "system_prompt": update.system_prompt,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", bot_id)
            .execute()
        )

        if not update_result.data:
            raise HTTPException(
                status_code=500, detail="Failed to update system prompt"
            )

        logger.info(
            f"✅ Updated system prompt for bot {bot_id} ({bot_result.data[0]['name']})"
        )

        return update_result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating system prompt for bot {bot_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update system prompt: {str(e)}"
        )


@router.get("/api/metrics")
async def get_metrics_endpoint():
    """Get comprehensive system metrics for monitoring"""
    try:
        return collect_metrics()
    except Exception as e:
        logger.error(f"❌ Error collecting metrics: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to collect metrics: {str(e)}"
        )


@router.get("/api/tools")
async def get_available_tools():
    """Get available tool definitions from the model manager"""
    try:
        if not model_manager:
            raise HTTPException(status_code=503, detail="Model manager unavailable")

        # Return tool definitions from the registry
        return list(model_manager.tool_registry.tools.values())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting tools: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get tools: {str(e)}")


