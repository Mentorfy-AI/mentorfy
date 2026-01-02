# syntax=docker/dockerfile:1.4
# Multi-stage build with BuildKit cache mounts for Railway
# Cache mounts persist between builds, dramatically speeding up deployments

FROM python:3.11.9-slim-bookworm as builder

# Set environment variables for Python and tools
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Install system dependencies with persistent apt cache
RUN --mount=type=cache,id=s/54fa6f50-e3a8-4a61-9a84-575c1682ce49-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=s/54fa6f50-e3a8-4a61-9a84-575c1682ce49-apt-lib,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Copy only dependency files first (for better Docker layer caching)
COPY pyproject.toml uv.lock ./

# Install dependencies using uv with persistent cache mount
RUN --mount=type=cache,id=s/54fa6f50-e3a8-4a61-9a84-575c1682ce49-uv-cache,target=/root/.cache/uv \
    uv sync --frozen

# Final stage - minimal runtime image
FROM python:3.11.9-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install only runtime dependencies with persistent apt cache
RUN --mount=type=cache,id=s/54fa6f50-e3a8-4a61-9a84-575c1682ce49-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=s/54fa6f50-e3a8-4a61-9a84-575c1682ce49-apt-lib,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the startup script
CMD ["/bin/sh", "start.sh"]
