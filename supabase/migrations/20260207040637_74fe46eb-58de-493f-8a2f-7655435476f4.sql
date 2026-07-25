-- Create scheduled_jobs table for temporal intelligence
CREATE TABLE public.scheduled_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'random_pick', 'campaign_post', 'reminder'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'ready', 'processing', 'completed', 'failed'
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Source tweet that triggered this job
  source_tweet_id TEXT,
  source_author_id TEXT,
  source_author_username TEXT,
  
  -- Job payload (flexible JSON for different job types)
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Result after execution
  result JSONB,
  error_message TEXT,
  
  -- Retry handling
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3
);

-- Index for efficient polling of due jobs
CREATE INDEX idx_scheduled_jobs_pending ON public.scheduled_jobs (status, scheduled_at) 
  WHERE status = 'pending';

-- Index for finding jobs by source tweet
CREATE INDEX idx_scheduled_jobs_source_tweet ON public.scheduled_jobs (source_tweet_id);

-- Enable RLS
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role can access (bot uses service key)
CREATE POLICY "No direct access - use service role"
ON public.scheduled_jobs
FOR ALL
USING (false)
WITH CHECK (false);

-- Add comment for documentation
COMMENT ON TABLE public.scheduled_jobs IS 'Job queue for MoniBot scheduled tasks (random picks, campaign posts, reminders)';