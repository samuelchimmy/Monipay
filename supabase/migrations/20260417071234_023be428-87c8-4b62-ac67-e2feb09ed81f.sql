UPDATE public.activation_fundings
SET status='funded',
    tx_hash='0xeba965dc0c2777133cfb7aed0a5a44ecaa808a5376b2307be8231e0d8b8053b0',
    funded_at=now()
WHERE wallet_address ILIKE '0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3'
  AND chain='ink'
  AND status='pending';