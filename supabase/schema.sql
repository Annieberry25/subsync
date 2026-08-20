-- ==========================================
-- SUBSYNC SUBSCRIPTION MANAGER - DATABASE SCHEMA
-- ==========================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------
-- 2. SUBSCRIPTIONS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'weekly', 'quarterly', 'custom')),
  category TEXT NOT NULL CHECK (category IN ('Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled', 'trial')),
  start_date DATE DEFAULT CURRENT_DATE,
  next_billing_date DATE NOT NULL,
  payment_method TEXT,
  provider_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON public.subscriptions(category);

-- Enable RLS on Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Subscriptions (Strict User Isolation)
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------
-- 3. BILL PAYMENTS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  custom_category TEXT,
  provider_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  country TEXT DEFAULT 'Nigeria',
  region TEXT,
  city TEXT,
  payment_frequency TEXT CHECK (payment_frequency IN ('one_time', 'monthly', 'yearly', 'weekly', 'quarterly', 'custom')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  receipts JSONB,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt_scan', 'email_discovered')),
  provider_reference TEXT,
  official_provider_url TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON public.bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON public.bill_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_category ON public.bill_payments(category);
CREATE INDEX IF NOT EXISTS idx_bill_payments_status ON public.bill_payments(status);

-- Enable RLS on Bill Payments
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Bill Payments (Strict User Isolation)
CREATE POLICY "Users can view their own bill payments"
  ON public.bill_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bill payments"
  ON public.bill_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill payments"
  ON public.bill_payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill payments"
  ON public.bill_payments FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_bill_payments_updated_at
  BEFORE UPDATE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------
-- 4. VERIFIED BILL PROVIDERS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Global',
  region TEXT,
  official_website TEXT,
  official_payment_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'user_submitted', 'unverified')),
  supported_regions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Bill Providers (Public Read, Admin Write)
ALTER TABLE public.bill_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view verified bill providers"
  ON public.bill_providers FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

