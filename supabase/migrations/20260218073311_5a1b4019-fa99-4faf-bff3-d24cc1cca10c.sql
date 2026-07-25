
-- Add Discord and Telegram identity columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord_id text,
ADD COLUMN IF NOT EXISTS discord_username text,
ADD COLUMN IF NOT EXISTS telegram_id text,
ADD COLUMN IF NOT EXISTS telegram_username text;

-- Indexes for fast lookup by platform ID
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id ON public.profiles(discord_id) WHERE discord_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id) WHERE telegram_id IS NOT NULL;

-- Platform commands table - tracks commands from all platforms (Discord, Telegram, Twitter)
-- This allows deduplication across platforms and unified logging
CREATE TABLE IF NOT EXISTS public.platform_commands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL, -- 'discord', 'telegram', 'twitter'
  platform_message_id text NOT NULL, -- Discord message ID, Telegram message ID, Tweet ID
  platform_user_id text NOT NULL, -- Discord user ID, Telegram user ID, Twitter author ID
  platform_channel_id text, -- Discord channel ID, Telegram chat ID
  platform_server_id text, -- Discord guild ID, Telegram group ID
  command_type text NOT NULL, -- 'p2p', 'grant', 'giveaway', 'balance', 'help'
  command_text text NOT NULL,
  parsed_amount numeric,
  parsed_recipients text[], -- Array of recipient MoniTags
  chain text NOT NULL DEFAULT 'base',
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  result_tx_hash text,
  error_reason text,
  profile_id uuid REFERENCES public.profiles(id), -- Sender's MoniPay profile
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  replied_at timestamptz
);

-- Enable RLS
ALTER TABLE public.platform_commands ENABLE ROW LEVEL SECURITY;

-- Service role only access (bots use service key)
CREATE POLICY "No direct client access to platform_commands"
  ON public.platform_commands
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Prevent duplicate command processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_commands_unique 
  ON public.platform_commands(platform, platform_message_id);

-- Fast lookup for pending commands
CREATE INDEX IF NOT EXISTS idx_platform_commands_status 
  ON public.platform_commands(status, platform) WHERE status = 'pending';

-- Discord servers table - tracks which servers MoniBot is in
CREATE TABLE IF NOT EXISTS public.discord_servers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id text NOT NULL UNIQUE,
  guild_name text,
  owner_id text,
  member_count integer DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.discord_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to discord_servers"
  ON public.discord_servers
  FOR ALL
  USING (false)
  WITH CHECK (false);
