-- Migration: Set up pg_cron job for webhook queue processing
-- Purpose: Schedule the process-webhook-queue Edge Function to run every minute
-- Issue: mentorfy-4wc.5

-- Enable pg_net extension for HTTP requests from cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Note: pg_cron is already enabled in this Supabase project

-- Create the cron job to process webhook queue every minute
-- The Edge Function requires the CRON_SECRET header for authentication
SELECT cron.schedule(
  'process-webhook-queue',  -- job name
  '* * * * *',              -- every minute
  $$
  SELECT net.http_post(
    url := 'https://qnkaisqmmgboexzxtybh.supabase.co/functions/v1/process-webhook-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verification: List all cron jobs
-- SELECT * FROM cron.job;
