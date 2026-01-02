# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Mentorfy API - a FastAPI-based backend service for document processing and knowledge graph management. The system processes documents from Google Drive and stores knowledge relationships using Graphiti (Neo4j graph database).

## Architecture

### Package Structure
The codebase is organized as a proper Python package under `mentorfy/`:

```
mentorfy/
├── api/                   # FastAPI application
│   └── app.py            # Main HTTP API server with CORS, health, and document endpoints
├── core/                  # Infrastructure utilities
│   ├── queues.py         # Redis-based job queuing
│   ├── rate_limiter.py   # API rate limiting
│   ├── retry.py          # Retry logic for failed operations
│   └── metrics.py        # System metrics collection
├── db/                    # Database clients
│   └── neo4j.py          # Graphiti/Neo4j knowledge graph client
├── integrations/          # External service integrations
│   └── slack.py          # Slack bot integration
├── models/                # AI model management
│   ├── manager.py        # Model orchestration and tool handling
│   └── token_counter.py  # Token usage tracking
├── services/              # Business logic
│   └── document_processor.py  # Document ingestion and text extraction
├── utils/                 # Utility functions
│   ├── text_extraction.py     # Text parsing from PDFs, DOCX, etc.
│   ├── metadata.py            # Document metadata management
│   ├── memory.py              # Conversation memory formatting
│   └── deletion.py            # Knowledge graph cleanup
└── workers/               # Background job processing
    └── document_worker.py # RQ-based task workers
```

### Core Components
- **FastAPI Server** (`mentorfy/api/app.py`): Main HTTP API server
- **Background Workers** (`mentorfy/workers/document_worker.py`): RQ-based async processing
- **Queue System** (`mentorfy/core/queues.py`): Redis job queuing
- **Graphiti Integration** (`mentorfy/db/neo4j.py`): Knowledge graph client with rate limiting
- **Document Processing** (`mentorfy/services/document_processor.py`): Document ingestion
- **Database**: Supabase (PostgreSQL) for metadata, Neo4j for knowledge graph via Graphiti

## Development Commands

### Environment Setup
```bash
# Create and activate virtual environment (uses uv)
uv sync

# Install dependencies
uv pip install -r requirements.txt
```

### Running the Server
```bash
# Development server with auto-reload and validation
python start_server.py

# Production server (used in Docker)
./start.sh

# Direct uvicorn (with new package structure)
uvicorn mentorfy.api.app:app --host 0.0.0.0 --port 8000 --reload
```

### Background Workers
```bash
# Start workers manually
python -m mentorfy.workers.document_worker

# Workers are automatically started via start.sh in production
```

### Testing
```bash
# Run tests (pytest framework detected)
pytest
pytest-asyncio  # for async tests
```

## Environment Variables

### Required
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `NEO4J_PASSWORD`: Neo4j database password

### Optional (with defaults)
- `NEO4J_URI`: Neo4j connection URI
- `NEO4J_USER`: Neo4j username  
- `FASTAPI_HOST`: Server host (default: 0.0.0.0)
- `FASTAPI_PORT`: Server port (default: 8000)
- `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)

### Service Configuration
Environment configuration is validated in `start_server.py` with helpful error messages and status indicators.

## Deployment

### Docker
- Uses Alpine Linux base image (`Dockerfile`)
- Configured for Railway deployment (`railway.toml`)
- Multi-process startup via `start.sh` (FastAPI + workers)

### Railway
- Build command: Uses Dockerfile
- Start command: `/bin/sh start.sh`
- Auto-scales workers and handles service health checks

## Key Integrations

- **Supabase**: Document metadata and user management
- **Neo4j + Graphiti**: Knowledge graph storage and relationship management  
- **Redis + RQ**: Asynchronous job processing
- **Google Drive API**: Document source integration
- **LangChain + Unstructured**: Document parsing and text extraction

## Rate Limiting & Retry Logic
- Graphiti operations are rate-limited via `mentorfy/core/rate_limiter.py`
- Failed jobs have automatic retry logic via `mentorfy/core/retry.py`
- Comprehensive metrics collection in `mentorfy/core/metrics.py`

## Code Organization Best Practices
- All application code lives in the `mentorfy/` package
- Use absolute imports: `from mentorfy.core.queues import ...`
- Entry points (`start_server.py`, `run_scheduler.py`) remain at root
- Always use `uv add` over `pip install` or `uv pip install`