-- Migration: Vodafone Cash SMS Payment Verification
-- Tables: sms_gateway_devices, payment_sms_events

CREATE TABLE IF NOT EXISTS sms_gateway_devices (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  phone_label TEXT,
  sim_slot INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  last_ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_devices_device_id ON sms_gateway_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_sms_devices_enabled ON sms_gateway_devices(enabled);

CREATE TABLE IF NOT EXISTS payment_sms_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  sender TEXT,
  message_hash TEXT NOT NULL UNIQUE,
  raw_message_encrypted TEXT,
  raw_message_iv TEXT,
  received_at TEXT NOT NULL,
  server_received_at TEXT NOT NULL DEFAULT (datetime('now')),
  sim_slot INTEGER,
  network TEXT,
  parsed_amount_piasters INTEGER,
  parsed_sender_phone TEXT,
  parsed_transaction_id TEXT,
  parsed_recipient_wallet TEXT,
  parsed_balance_piasters INTEGER,
  parse_confidence INTEGER NOT NULL DEFAULT 0,
  parse_warnings TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'received', 'signature_valid', 'queued', 'parsed', 'matched',
    'confirmed', 'under_review', 'duplicate', 'rejected', 'parse_failed'
  )) DEFAULT 'received',
  rejection_reason TEXT,
  matched_payment_id TEXT,
  matched_order_id TEXT,
  processed_at TEXT,
  admin_notes TEXT,
  confirmed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_sms_event_id ON payment_sms_events(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_sms_message_hash ON payment_sms_events(message_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_sms_transaction_id ON payment_sms_events(parsed_transaction_id) WHERE parsed_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_sms_status ON payment_sms_events(status);
CREATE INDEX IF NOT EXISTS idx_payment_sms_device_id ON payment_sms_events(device_id);
CREATE INDEX IF NOT EXISTS idx_payment_sms_received_at ON payment_sms_events(received_at);
CREATE INDEX IF NOT EXISTS idx_payment_sms_phone ON payment_sms_events(parsed_sender_phone);
