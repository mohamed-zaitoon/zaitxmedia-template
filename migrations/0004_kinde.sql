-- Migration 0004: Kinde Auth Integration
-- Adds kinde_user_id to users and simplifies schema for Kinde-managed auth

-- Add kinde_user_id column
ALTER TABLE users ADD COLUMN kinde_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kinde_id ON users(kinde_user_id);

-- Nullable columns that Kinde manages (no longer stored locally)
-- password_hash, salt already nullable from migration 0003
-- Google-related tables kept for backward compatibility, auth_accounts now managed by Kinde
