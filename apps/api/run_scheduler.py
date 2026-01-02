#!/usr/bin/env python
"""
Simple RQ scheduler runner
Moves scheduled jobs to the queue when their time comes
"""
import os
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
import redis
from rq.scheduler import RQScheduler

# Load environment
load_dotenv(Path(__file__).parent.parent / ".env.local")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Start the RQ scheduler"""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

    try:
        logger.info(f"Connecting to Redis at {redis_url}")
        redis_conn = redis.from_url(redis_url)
        redis_conn.ping()
        logger.info("✓ Redis connection successful")
    except Exception as e:
        logger.error(f"✗ Failed to connect to Redis: {e}")
        sys.exit(1)

    try:
        logger.info("Starting RQ scheduler...")
        from rq import Queue
        queues = [
            Queue("extraction", connection=redis_conn),
            Queue("ingest_extract", connection=redis_conn),
            Queue("chunking", connection=redis_conn),
            Queue("kg_ingest", connection=redis_conn),
        ]
        scheduler = RQScheduler(queues=queues, connection=redis_conn, interval=5)
        logger.info("✓ RQ scheduler started, checking for scheduled jobs every 5 seconds")
        scheduler.work()
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"✗ Scheduler error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
