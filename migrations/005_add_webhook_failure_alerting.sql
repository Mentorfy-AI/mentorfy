-- Migration: Add webhook failure alerting function
-- Purpose: Create a function to count failures in rolling hour for alerting
-- Issue: mentorfy-4wc.6

-- Function to count webhook failures in the last hour
CREATE OR REPLACE FUNCTION count_webhook_failures_last_hour()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM webhook_queue
  WHERE status = 'failed'
    AND created_at > NOW() - INTERVAL '1 hour';
$$ LANGUAGE SQL STABLE;

-- Create an index to speed up failure counting
CREATE INDEX IF NOT EXISTS idx_webhook_queue_failed_created
  ON webhook_queue(created_at)
  WHERE status = 'failed';

COMMENT ON FUNCTION count_webhook_failures_last_hour() IS 'Returns count of failed webhooks in the last hour for alerting';
