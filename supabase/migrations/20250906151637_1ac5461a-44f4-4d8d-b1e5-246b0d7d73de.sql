-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily leave automation check at 6:00 AM UTC
-- This will run every day and check if annual leave reset is needed
SELECT cron.schedule(
  'daily-leave-automation-check',
  '0 6 * * *', -- Every day at 6:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://vfzyodedgtefvxcrqdtc.supabase.co/functions/v1/leave-automation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmenlvZGVkZ3RlZnZ4Y3JxZHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2ODM3MjcsImV4cCI6MjA2MzI1OTcyN30.pj0n5Sv_I24lgjdh7bq7565lBfks3tQE-NKnxmTn9Yg"}'::jsonb,
        body:=concat('{"triggered_by": "cron", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a function to check current cron jobs related to leave automation
CREATE OR REPLACE FUNCTION get_leave_automation_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  active boolean,
  last_run timestamp with time zone,
  next_run timestamp with time zone
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    jobname::text as job_name,
    schedule::text,
    active,
    last_run,
    next_run
  FROM cron.job 
  WHERE jobname LIKE '%leave%' OR command LIKE '%leave-automation%';
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_leave_automation_status() TO authenticated;