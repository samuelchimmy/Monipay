ALTER TABLE public.products            DROP CONSTRAINT IF EXISTS products_profile_id_fkey;
ALTER TABLE public.invoices            DROP CONSTRAINT IF EXISTS invoices_sender_profile_id_fkey;
ALTER TABLE public.invoices            DROP CONSTRAINT IF EXISTS invoices_recipient_profile_id_fkey;
ALTER TABLE public.api_keys            DROP CONSTRAINT IF EXISTS api_keys_profile_id_fkey;
ALTER TABLE public.payment_links       DROP CONSTRAINT IF EXISTS payment_links_profile_id_fkey;
ALTER TABLE public.orders              DROP CONSTRAINT IF EXISTS orders_merchant_profile_id_fkey;
ALTER TABLE public.orders              DROP CONSTRAINT IF EXISTS orders_payer_profile_id_fkey;
ALTER TABLE public.transactions        DROP CONSTRAINT IF EXISTS transactions_profile_id_fkey;

CREATE INDEX IF NOT EXISTS idx_products_profile_id          ON public.products(profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sender_profile_id   ON public.invoices(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_recipient_profile_id ON public.invoices(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_profile_id          ON public.api_keys(profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_profile_id     ON public.payment_links(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_profile_id   ON public.orders(merchant_profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_payer_profile_id      ON public.orders(payer_profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_profile_id      ON public.transactions(profile_id);