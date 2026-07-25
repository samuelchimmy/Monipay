-- Add richer metadata columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payer_pay_tag text;

-- Add index for faster invoice lookups
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);