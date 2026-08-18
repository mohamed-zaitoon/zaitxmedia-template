-- Migration: Direct Payment System
-- Tables: payment_methods, payment_destinations, payment_intents

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  country_code TEXT NOT NULL CHECK(country_code IN ('EG', 'SA')),
  currency TEXT NOT NULL CHECK(currency IN ('EGP', 'SAR')),
  type TEXT NOT NULL DEFAULT 'manual',
  enabled INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  instructions_ar TEXT,
  instructions_en TEXT,
  verification_mode TEXT NOT NULL CHECK(verification_mode IN ('sender_phone', 'sender_name', 'manual', 'sms_match')) DEFAULT 'manual',
  auto_verification_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_country ON payment_methods(country_code, enabled);

-- Seed payment methods
INSERT OR IGNORE INTO payment_methods (id, code, name_ar, name_en, country_code, currency, type, verification_mode, display_order) VALUES
  ('pm_vodafone', 'vodafone_cash', 'فودافون كاش', 'Vodafone Cash', 'EG', 'EGP', 'wallet', 'sms_match', 1),
  ('pm_instapay', 'instapay', 'انستاباي', 'InstaPay', 'EG', 'EGP', 'bank_transfer', 'sender_phone', 2),
  ('pm_barq', 'barq', 'برق', 'Barq', 'SA', 'SAR', 'wallet', 'sender_name', 1);

CREATE TABLE IF NOT EXISTS payment_destinations (
  id TEXT PRIMARY KEY NOT NULL,
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
  country_code TEXT NOT NULL CHECK(country_code IN ('EG', 'SA')),
  currency TEXT NOT NULL CHECK(currency IN ('EGP', 'SAR')),
  label TEXT NOT NULL,
  destination_type TEXT NOT NULL CHECK(destination_type IN ('phone', 'wallet_number', 'instapay_handle', 'barq_account')),
  destination_value_encrypted TEXT NOT NULL DEFAULT '',
  destination_last4 TEXT,
  account_holder_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  min_amount_minor INTEGER,
  max_amount_minor INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_dest_method ON payment_destinations(payment_method_id, enabled);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
  payment_destination_id TEXT NOT NULL REFERENCES payment_destinations(id),
  country_code TEXT NOT NULL CHECK(country_code IN ('EG', 'SA')),
  currency TEXT NOT NULL CHECK(currency IN ('EGP', 'SAR')),
  required_amount_minor INTEGER NOT NULL,
  submitted_amount_minor INTEGER,
  submitted_sender_phone TEXT,
  submitted_sender_name TEXT,
  submitted_reference TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'created', 'awaiting_transfer', 'proof_submitted', 'verifying',
    'matched', 'verified', 'under_review', 'expired', 'rejected', 'cancelled'
  )) DEFAULT 'created',
  verification_deadline TEXT NOT NULL,
  matched_sms_event_id TEXT,
  verified_at TEXT,
  verified_by TEXT,
  verification_method TEXT,
  manual_review_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_deadline ON payment_intents(verification_deadline);
CREATE INDEX IF NOT EXISTS idx_payment_intents_sms ON payment_intents(matched_sms_event_id);

CREATE TABLE IF NOT EXISTS payment_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO payment_settings (key, value) VALUES
  ('usd_to_egp_rate', '50'),
  ('usd_to_sar_rate', '3.75'),
  ('default_profit_margin', '0.15'),
  ('payment_verification_timeout_seconds', '600'),
  ('tiktok_admin_delay_seconds', '5'),
  ('tiktok_authorization_timeout_seconds', '30');
