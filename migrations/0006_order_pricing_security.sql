-- Local preparation only. Do not apply to remote D1 without approval.
ALTER TABLE orders ADD COLUMN price_snapshot TEXT NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency
  ON orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
