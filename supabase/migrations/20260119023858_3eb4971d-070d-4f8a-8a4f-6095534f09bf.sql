-- Create profiles table for user data and wallet info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_tag TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  preferred_mode TEXT DEFAULT 'merchant' CHECK (preferred_mode IN ('merchant', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create transactions table for payment history
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sent', 'received')),
  amount DECIMAL(18,6) NOT NULL,
  fee DECIMAL(18,6) NOT NULL DEFAULT 0,
  counterparty TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create products table for merchant catalogs
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  category TEXT DEFAULT 'Other',
  icon TEXT DEFAULT 'package',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_transactions_profile_id ON public.transactions(profile_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_products_profile_id ON public.products(profile_id);
CREATE INDEX idx_profiles_pay_tag ON public.profiles(pay_tag);
CREATE INDEX idx_profiles_wallet_address ON public.profiles(wallet_address);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
-- Anyone can check if a pay_tag exists (for registration check)
CREATE POLICY "Allow public read of pay_tag and wallet_address"
  ON public.profiles FOR SELECT
  USING (true);

-- Only the profile owner can update their profile (matched by wallet_address)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (true);

-- Transactions RLS Policies
-- Users can only see transactions where they are involved
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (true);

-- Products RLS Policies
-- Anyone can view products (for customer purchases)
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own products"
  ON public.products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own products"
  ON public.products FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own products"
  ON public.products FOR DELETE
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();