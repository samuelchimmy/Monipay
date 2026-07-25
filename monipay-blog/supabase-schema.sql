-- ============================================================
-- Monipay Blog — Dedicated Comments Schema
-- ============================================================
-- IMPORTANT: This is a SEPARATE table for Monipay blog.
-- Do NOT reuse any shared or personal blog table.
--
-- Run this in your Supabase SQL editor to set up the system.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- TABLE: monipay_comments
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monipay_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_slug text NOT NULL CHECK (char_length(post_slug) >= 1 AND char_length(post_slug) <= 300),
  name text CHECK (name IS NULL OR (char_length(name) >= 1 AND char_length(name) <= 100)),
  content text NOT NULL CHECK (char_length(content) >= 3 AND char_length(content) <= 2000),
  ip_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
-- Fast lookups by slug (used on every page load)
CREATE INDEX IF NOT EXISTS idx_monipay_comments_post_slug
  ON monipay_comments (post_slug, created_at DESC);

-- Rate limiting lookups by ip_hash
CREATE INDEX IF NOT EXISTS idx_monipay_comments_ip_hash
  ON monipay_comments (ip_hash, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
ALTER TABLE monipay_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access (anyone can view comments)
CREATE POLICY "monipay_comments_select" ON monipay_comments
  FOR SELECT
  USING (true);

-- Policy: Public insert (controlled by trigger rate limiting)
CREATE POLICY "monipay_comments_insert" ON monipay_comments
  FOR INSERT
  WITH CHECK (true);

-- Policy: Block ALL updates (comments are immutable)
CREATE POLICY "monipay_comments_no_update" ON monipay_comments
  FOR UPDATE
  USING (false);

-- Policy: Block ALL deletes (admin-only via service key)
CREATE POLICY "monipay_comments_no_delete" ON monipay_comments
  FOR DELETE
  USING (false);

-- ──────────────────────────────────────────────────────────────
-- RATE LIMITING FUNCTION
-- ──────────────────────────────────────────────────────────────
-- Enforces: max 1 comment per ip_hash per 60 seconds.
-- Also enforces: max 10 comments per ip_hash per hour.

CREATE OR REPLACE FUNCTION monipay_check_comment_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate content constraints at DB level
  IF NEW.content IS NULL OR char_length(trim(NEW.content)) < 3 THEN
    RAISE EXCEPTION 'Comment content must be at least 3 characters.'
      USING ERRCODE = '23514';
  END IF;

  -- Skip rate limit if ip_hash is empty or unknown
  IF NEW.ip_hash IS NULL OR NEW.ip_hash = '' OR NEW.ip_hash = 'unknown' THEN
    RETURN NEW;
  END IF;

  -- Check: 1 comment per 60 seconds per fingerprint
  IF EXISTS (
    SELECT 1 FROM monipay_comments
    WHERE ip_hash = NEW.ip_hash
      AND created_at > now() - interval '60 seconds'
  ) THEN
    RAISE EXCEPTION 'Rate limit: please wait 60 seconds between comments.'
      USING ERRCODE = '42501';
  END IF;

  -- Check: max 10 comments per hour per fingerprint
  IF (
    SELECT count(*) FROM monipay_comments
    WHERE ip_hash = NEW.ip_hash
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Rate limit: maximum 10 comments per hour reached.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- TRIGGER
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS enforce_monipay_comment_rate_limit ON monipay_comments;
CREATE TRIGGER enforce_monipay_comment_rate_limit
  BEFORE INSERT ON monipay_comments
  FOR EACH ROW
  EXECUTE FUNCTION monipay_check_comment_rate_limit();

-- ──────────────────────────────────────────────────────────────
-- MAINTENANCE (optional, run via pg_cron or manually)
-- ──────────────────────────────────────────────────────────────
-- DELETE FROM monipay_comments WHERE created_at < now() - interval '365 days';
