-- Migration: Create webhook_queue table for durable webhook delivery
-- Purpose: Queue-based webhook system with automatic retries via pg_cron
-- Issue: mentorfy-4wc.1

-- Step 1: Create enum for webhook status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_status') THEN
    CREATE TYPE webhook_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END$$;

-- Step 2: Create webhook_queue table
CREATE TABLE IF NOT EXISTS webhook_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'lead.contact-captured', etc.

  -- Webhook target
  webhook_url TEXT NOT NULL,

  -- Payload to deliver
  payload JSONB NOT NULL,

  -- Delivery status
  status webhook_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,

  -- Error tracking
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,

  -- Scheduling
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Step 3: Create indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_webhook_queue_pending
  ON webhook_queue(next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_queue_session
  ON webhook_queue(session_id);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_flow
  ON webhook_queue(flow_id);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_status
  ON webhook_queue(status);

-- Step 4: Create index for failure monitoring (rolling hour count)
CREATE INDEX IF NOT EXISTS idx_webhook_queue_failures
  ON webhook_queue(created_at)
  WHERE status = 'failed';

-- Step 5: Add comment for documentation
COMMENT ON TABLE webhook_queue IS 'Durable queue for webhook delivery with automatic retries';
COMMENT ON COLUMN webhook_queue.next_attempt_at IS 'When to next attempt delivery (exponential backoff)';
COMMENT ON COLUMN webhook_queue.event_type IS 'Event type: lead.contact-captured, etc.';

-- Verification query (run manually to check migration):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'webhook_queue';
