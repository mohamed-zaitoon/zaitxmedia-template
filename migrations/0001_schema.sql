-- Migration 0001: Core Schema
-- Tables: users, sessions, orders, notifications, services, settings, audit_logs, sms_webhooks, uploads, providers

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT,
  username TEXT,
  whatsapp TEXT,
  country TEXT CHECK(country IN ('EG', 'SA', 'OTHER') OR country IS NULL),
  preferred_currency TEXT CHECK(preferred_currency IN ('USD', 'EGP', 'SAR', 'auto')) DEFAULT 'auto',
  role TEXT CHECK(role IN ('user', 'admin', 'provider')) NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  balance_usd REAL NOT NULL DEFAULT 0,
  name_last_changed_at TEXT,
  username_last_changed_at TEXT,
  country_last_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_country ON users(country);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_evt_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_evt_token_hash ON email_verification_tokens(token_hash);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_prt_token_hash ON password_reset_tokens(token_hash);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  provider_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  service_ref TEXT,
  price_usd REAL,
  price_egp REAL,
  price_sar REAL,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  max_quantity INTEGER NOT NULL DEFAULT 999999,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_manual INTEGER NOT NULL DEFAULT 0,
  is_fazer INTEGER NOT NULL DEFAULT 0,
  app_category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_services_active ON services(is_active);
CREATE INDEX idx_services_app_category ON services(app_category);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  service_id TEXT,
  service_name TEXT NOT NULL,
  is_game INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  currency TEXT CHECK(currency IN ('EGP', 'SAR', 'USD')) NOT NULL DEFAULT 'EGP',
  name TEXT,
  link TEXT,
  country TEXT,
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  proof_of_payment TEXT,
  user_whatsapp TEXT,
  full_name TEXT,
  username TEXT,
  user_email TEXT,
  status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled', 'refunded')) NOT NULL DEFAULT 'pending',
  type TEXT CHECK(type IN ('order', 'recharge')) NOT NULL DEFAULT 'order',
  balance_category TEXT DEFAULT 'tiktok_coins',
  admin_notes TEXT,
  webhook_data TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(type);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  type TEXT DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS price_tiers (
  id TEXT PRIMARY KEY,
  category TEXT CHECK(category IN ('tiktok_coins', 'smm', 'fazer')) NOT NULL DEFAULT 'tiktok_coins',
  min INTEGER NOT NULL,
  max INTEGER NOT NULL,
  price_per_1000 REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_price_tiers_category ON price_tiers(category);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('wallet', 'instapay', 'barq', 'binance')) NOT NULL,
  label TEXT,
  number TEXT,
  name TEXT,
  link TEXT,
  min_amount REAL,
  max_amount REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  country TEXT CHECK(country IN ('EG', 'SA', 'OTHER')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payment_methods_type ON payment_methods(type);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  amount_usd REAL NOT NULL,
  type TEXT CHECK(type IN ('credit', 'debit', 'refund')) NOT NULL,
  description TEXT,
  balance_before REAL,
  balance_after REAL,
  performed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_wt_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wt_created_at ON wallet_transactions(created_at);

CREATE TABLE IF NOT EXISTS sms_webhook_events (
  id TEXT PRIMARY KEY,
  message_hash TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  amount REAL,
  transaction_id TEXT,
  raw_text TEXT,
  parsed_data TEXT DEFAULT '{}',
  status TEXT CHECK(status IN ('received', 'matched', 'rejected', 'processed')) NOT NULL DEFAULT 'received',
  order_id TEXT REFERENCES orders(id),
  user_id TEXT REFERENCES users(id),
  reason TEXT,
  webhook_source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sms_message_hash ON sms_webhook_events(message_hash);
CREATE INDEX idx_sms_phone_number ON sms_webhook_events(phone_number);
CREATE INDEX idx_sms_status ON sms_webhook_events(status);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  is_public INTEGER NOT NULL DEFAULT 0,
  related_type TEXT,
  related_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX idx_uploaded_files_related ON uploaded_files(related_type, related_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_values TEXT DEFAULT '{}',
  new_values TEXT DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  result TEXT CHECK(result IN ('success', 'failure')) DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_url TEXT,
  api_key_encrypted TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  webhook_secret_encrypted TEXT,
  config TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_providers_active ON providers(is_active);
