-- Migration: Enable RLS on webhook_queue
-- Purpose: Secure the webhook_queue table - only accessible by service role
-- Issue: mentorfy-4wc.7

-- Enable RLS on webhook_queue
ALTER TABLE webhook_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (service role bypasses RLS by default, but this is explicit)
CREATE POLICY "Service role full access" ON webhook_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
