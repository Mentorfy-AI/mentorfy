#!/bin/sh
set -e
echo "Starting Mentorfy FastAPI server with workers..."

# Skip Redis/Neo4j health checks for Railway deployment
# Railway services will be available via environment variables
echo "Skipping service health checks for Railway deployment..."

# Start FastAPI server
echo "Starting FastAPI server..."
cd /app
uvicorn mentorfy.api.app:app --host 0.0.0.0 --port 8000 &
FAST_PID=$!

# Wait for FastAPI to be ready
echo "Waiting for FastAPI..."
until curl -f http://localhost:8000/health > /dev/null 2>&1; do
  sleep 1
done
echo "FastAPI ready!"

# Start RQ scheduler (moves scheduled jobs to queue)
echo "Starting RQ scheduler..."
python run_scheduler.py &
SCHEDULER_PID=$!

# Validate required environment variables
if [ -z "$REDIS_URL" ]; then
  echo "ERROR: REDIS_URL environment variable is required"
  exit 1
fi

if [ -z "$EXTRACTION_WORKERS" ]; then
  echo "ERROR: EXTRACTION_WORKERS environment variable is required"
  exit 1
fi

if [ -z "$INGEST_EXTRACT_WORKERS" ]; then
  echo "ERROR: INGEST_EXTRACT_WORKERS environment variable is required"
  exit 1
fi

if [ -z "$CHUNKING_WORKERS" ]; then
  echo "ERROR: CHUNKING_WORKERS environment variable is required"
  exit 1
fi

if [ -z "$KG_INGEST_WORKERS" ]; then
  echo "ERROR: KG_INGEST_WORKERS environment variable is required"
  exit 1
fi

# Start phased pipeline workers
echo "Starting phased pipeline workers..."

# Extraction workers (manual uploads)
echo "Starting $EXTRACTION_WORKERS extraction workers..."
for i in $(seq 1 $EXTRACTION_WORKERS); do
  rq worker extraction --url "$REDIS_URL" &
done

# Ingest+Extract workers (external sources)
echo "Starting $INGEST_EXTRACT_WORKERS ingest+extract workers..."
for i in $(seq 1 $INGEST_EXTRACT_WORKERS); do
  rq worker ingest_extract --url "$REDIS_URL" &
done

# Chunking workers (all sources converge)
echo "Starting $CHUNKING_WORKERS chunking workers..."
for i in $(seq 1 $CHUNKING_WORKERS); do
  rq worker chunking --url "$REDIS_URL" &
done

# KG Ingest workers (final phase)
echo "Starting $KG_INGEST_WORKERS kg_ingest workers..."
for i in $(seq 1 $KG_INGEST_WORKERS); do
  rq worker kg_ingest --url "$REDIS_URL" &
done

echo "All services started!"

# Handle shutdown
shutdown() {
  echo "Shutting down..."
  kill -TERM $FAST_PID 2>/dev/null || true
  jobs -p | xargs kill -TERM 2>/dev/null || true

  # Wait up to 15 seconds for graceful shutdown
  timeout 15 wait || {
    echo "Graceful shutdown timed out, force killing..."
    jobs -p | xargs kill -KILL 2>/dev/null || true
  }
}

trap shutdown TERM INT
wait