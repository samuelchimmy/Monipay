-- Add items column to transactions table to store purchased products
ALTER TABLE public.transactions
ADD COLUMN items jsonb DEFAULT NULL;

-- Add a comment to describe the column
COMMENT ON COLUMN public.transactions.items IS 'JSON array of purchased items: [{name, quantity, price}]';