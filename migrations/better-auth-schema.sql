-- Better Auth Schema for SQLite (Cloudflare D1 compatible)
-- Generated from better-auth v1.6.24
-- Isolated tables with ba_ prefix
-- basePath: /v3 | baseURL: https://auth.zaitxmedia.com

-- ba_users: user accounts
CREATE TABLE IF NOT EXISTS ba_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  image TEXT,
  role TEXT CHECK(role IN ('user', 'admin')) NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  banReason TEXT,
  banExpires TEXT,
  firebase_uid TEXT UNIQUE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ba_users_email ON ba_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ba_users_firebase_uid ON ba_users(firebase_uid) WHERE firebase_uid IS NOT NULL;

-- ba_sessions: user sessions
CREATE TABLE IF NOT EXISTS ba_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ba_sessions_userId ON ba_sessions(userId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ba_sessions_token ON ba_sessions(token);
CREATE INDEX IF NOT EXISTS idx_ba_sessions_expiresAt ON ba_sessions(expiresAt);

-- ba_accounts: OAuth provider accounts (Google, etc.)
CREATE TABLE IF NOT EXISTS ba_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
  providerId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ba_accounts_provider ON ba_accounts(providerId, accountId);
CREATE INDEX IF NOT EXISTS idx_ba_accounts_userId ON ba_accounts(userId);

-- ba_verifications: email verification + password reset tokens
CREATE TABLE IF NOT EXISTS ba_verifications (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ba_verifications_identifier ON ba_verifications(identifier);
