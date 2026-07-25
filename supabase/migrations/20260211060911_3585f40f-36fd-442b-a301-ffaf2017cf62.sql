-- Add network column to campaigns table for multi-chain routing
ALTER TABLE public.campaigns ADD COLUMN network TEXT NOT NULL DEFAULT 'base';

-- Add index for efficient filtering by network + status
CREATE INDEX idx_campaigns_network_status ON public.campaigns(network, status);

-- Update any existing campaigns to 'base' (they were all Base campaigns)
UPDATE public.campaigns SET network = 'base' WHERE network IS NULL OR network = 'base';