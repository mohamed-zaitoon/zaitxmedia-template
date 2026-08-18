-- Migration 0003: Google Sign-In Support
-- Adds auth_accounts table and modifies users table for passwordless Google users

-- Allow password_hash to be NULL for Google-only users
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  salt TEXT,
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
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new SELECT
  id, email, email_verified, password_hash, salt, full_name, username,
  whatsapp, country, preferred_currency, role, banned, balance_usd,
  name_last_changed_at, username_last_changed_at, country_last_changed_at,
  NULL, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- Auth accounts table for OAuth providers
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('google')),
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  provider_email_verified INTEGER NOT NULL DEFAULT 0,
  provider_name TEXT,
  provider_avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_provider ON auth_accounts(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_provider_email ON auth_accounts(provider, provider_email);
