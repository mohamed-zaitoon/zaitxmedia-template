-- ============================================================
-- Supabase Tables Setup - Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/exsgooiyxriixiqrxkca/sql/new
-- ============================================================

-- 1. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_auth_access" ON public.system_settings FOR ALL USING (auth.role() = 'authenticated');

-- 2. Service Prices (Tiers)
CREATE TABLE IF NOT EXISTS public.service_prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  min INTEGER NOT NULL,
  max INTEGER NOT NULL,
  price_per_1000 NUMERIC(10,2) NOT NULL,
  category TEXT DEFAULT 'tiktok_coins',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_auth_access" ON public.service_prices FOR ALL USING (auth.role() = 'authenticated');

-- 3. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  service_id TEXT,
  service_name TEXT,
  is_game BOOLEAN DEFAULT false,
  quantity INTEGER DEFAULT 1,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'EGP',
  link TEXT,
  country TEXT,
  payment_method TEXT,
  proof_of_payment TEXT,
  user_whatsapp TEXT,
  full_name TEXT,
  username TEXT,
  user_email TEXT,
  status TEXT DEFAULT 'pending',
  type TEXT DEFAULT 'order',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_all" ON public.orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- 5. Services (manual services)
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price_egp NUMERIC(10,2),
  price_sar NUMERIC(10,2),
  is_manual BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  app_category TEXT,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER DEFAULT 999999,
  fulfillment_type TEXT DEFAULT 'standard',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_auth_access" ON public.services FOR ALL USING (auth.role() = 'authenticated');

-- 6. Payment Methods  
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  country_code TEXT CHECK (country_code IN ('EG','SA')),
  currency TEXT CHECK (currency IN ('EGP','SAR')),
  enabled BOOLEAN DEFAULT true,
  verification_mode TEXT DEFAULT 'manual',
  instructions_ar TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_auth_access" ON public.payment_methods FOR ALL USING (auth.role() = 'authenticated');

-- Seed default data
INSERT INTO system_settings (key, value) VALUES 
  ('pricing', '{"tiktok_cost_usd":10.3,"tiktok_usd_rate":55,"smm_usd_rate":82,"fazer_usd_rate":55,"balance_usd_rate":55,"tiktok_min_coins":30,"tiktok_max_coins":2500000}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value) VALUES 
  ('site', '{"whatsapp":"201060795179","wallets":[]}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO service_prices (min, max, price_per_1000) VALUES
  (1,99,645),(100,499,312),(500,999,170.81),(1000,4999,69.68),
  (5000,9999,34.54),(10000,24999,17.49),(25000,99999,8.79),
  (100000,499999,4.45),(500000,2500000,4.17);

INSERT INTO payment_methods (id, code, name_ar, country_code, currency, verification_mode) VALUES
  ('pm_vodafone','vodafone_cash','فودافون كاش','EG','EGP','sms_match'),
  ('pm_instapay','instapay','انستاباي','EG','EGP','sender_phone'),
  ('pm_barq','barq','برق','SA','EGP','sender_name');
