-- Normalize existing wallet addresses to lowercase
UPDATE profiles SET wallet_address = LOWER(wallet_address);
UPDATE activation_fundings SET wallet_address = LOWER(wallet_address);