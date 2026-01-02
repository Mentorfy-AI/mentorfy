#!/bin/bash
cd /Users/elijah/code/mentorfy-api

# Load .env file and export all vars
set -a
source .env.local
set +a

# macOS fork safety
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

# Start worker
uv run rq worker documents --with-scheduler
