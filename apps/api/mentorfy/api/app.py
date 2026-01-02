#!/usr/bin/env python3
"""
Mentorfy FastAPI Server

This FastAPI server replaces the subprocess-based Python script execution
with proper HTTP endpoints that can be called from the Next.js frontend.

Key features:
- Document processing endpoints for Google Drive integration
- Graphiti knowledge graph search endpoints
- Health monitoring and graceful shutdown
- Proper async/await patterns and connection management
- Comprehensive error handling and logging
"""

import asyncio
import logging
import os
import redis.asyncio as redis
import uvicorn

from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from rich.console import Console
from rich.logging import RichHandler
from supabase import create_client, Client
from typing import Optional

# Import mentorfy modules
from mentorfy.db.neo4j import get_graphiti_client
from mentorfy.models.manager import ModelManager
from mentorfy.integrations.slack import SlackBot

# Import routers
from mentorfy.api.routes import chat as chat_router
from mentorfy.api.routes import forms as forms_router
from mentorfy.api.routes import google_drive as google_drive_router
from mentorfy.api.routes import knowledge as knowledge_router
from mentorfy.api.routes import documents as documents_router
from mentorfy.api.routes import slack as slack_router
from mentorfy.api.routes import queue as queue_router
from mentorfy.api.routes import system as system_router


load_dotenv(Path(__file__).parent.parent.parent / ".env.local")

# Configure logging with Rich for beautiful colored output
console = Console(width=140)
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[
        RichHandler(
            console=console,
            show_path=False,
            log_time_format="[%X]",
            rich_tracebacks=True,
            markup=True,
        )
    ],
)
logger = logging.getLogger(__name__)

# Suppress Neo4j warnings about missing properties (common in fresh Graphiti instances)
logging.getLogger("neo4j.notifications").setLevel(logging.ERROR)

# Global services
supabase_client: Optional[Client] = None
graphiti_client = None
redis_client: Optional[redis.Redis] = None
model_manager: Optional[ModelManager] = None
slack_bot_handler: Optional[SlackBot] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown of global services"""
    logger.info("🚀 Starting FastAPI server...")

    # Initialize services
    await initialize_services()

    yield

    # Cleanup services
    logger.info("🛑 Shutting down FastAPI server...")
    await cleanup_services()


# Create FastAPI app with lifespan management
app = FastAPI(
    title="Mentorfy Document Processing API",
    description="FastAPI server for document processing and knowledge graph operations",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.vercel.app",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat_router.router)
app.include_router(forms_router.router)
app.include_router(google_drive_router.router)
app.include_router(knowledge_router.router)
app.include_router(documents_router.router)
app.include_router(slack_router.router)
app.include_router(queue_router.router)
app.include_router(system_router.router)


async def initialize_services():
    """Initialize all global services"""
    global supabase_client, graphiti_client, redis_client, model_manager, slack_bot_handler

    try:
        # Initialize Supabase client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise ValueError("Missing Supabase credentials in environment")
        supabase_client = create_client(url, key)
        logger.info("✅ Supabase client initialized")

        # Initialize Graphiti client
        neo4j_uri = os.getenv("NEO4J_URI")
        neo4j_user = os.getenv("NEO4J_USER")
        neo4j_password = os.getenv("NEO4J_PASSWORD")
        if not neo4j_uri or not neo4j_user or not neo4j_password:
            raise ValueError("Missing one or more Neo4j env vars")

        graphiti_client = get_graphiti_client()
        logger.info("✅ Graphiti client initialized")

        # Initialize Redis client (optional)
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            raise ValueError("Missing Redis URL")
        try:
            redis_client = redis.from_url(redis_url, decode_responses=True)
            await redis_client.ping()
            logger.info("✅ Redis client initialized")
        except Exception as e:
            logger.warning(
                f"⚠️ Redis not available: {e}. Rate limiting will use local cache."
            )
            redis_client = None

        # Initialize Model manager
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key and ModelManager:
            model_manager = ModelManager(
                anthropic_api_key=anthropic_key,
                supabase_client=supabase_client,
                redis_client=redis_client,
                graphiti_client=graphiti_client,
            )
            logger.info("✅ Model manager initialized")

            # Set services for routers
            chat_router.set_services(supabase_client, model_manager)
            forms_router.set_services(supabase_client, model_manager)
            google_drive_router.set_supabase_client(supabase_client)
            knowledge_router.set_graphiti_client(graphiti_client)
            documents_router.set_supabase_client(supabase_client)
            system_router.set_services(supabase_client, model_manager)
            logger.info("✅ Router services configured")
        else:
            logger.warning("⚠️ Anthropic API key not found or ModelManager not imported")

        # Initialize simplified Slack bot handler
        if model_manager and SlackBot:
            slack_bot_handler = SlackBot(
                supabase_client, model_manager, graphiti_client
            )
            slack_router.set_services(supabase_client, slack_bot_handler)
            logger.info("✅ Slack bot handler initialized")
        else:
            logger.warning("⚠️ Slack bot handler not initialized - missing dependencies")

    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        raise


async def cleanup_services():
    """Cleanup all global services"""
    global graphiti_client

    try:
        if (
            graphiti_client
            and hasattr(graphiti_client, "driver")
            and graphiti_client.driver
        ):
            if hasattr(graphiti_client.driver, "close"):
                close_method = graphiti_client.driver.close
                if asyncio.iscoroutinefunction(close_method):
                    await close_method()
                else:
                    close_method()
            logger.info("✅ Graphiti client closed")
    except Exception as e:
        logger.warning(f"⚠️  Error closing services: {e}")


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
