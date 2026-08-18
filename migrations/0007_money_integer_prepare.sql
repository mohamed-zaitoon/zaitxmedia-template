-- PREPARATION ONLY. Do not apply to remote D1 without explicit approval.
-- This migration is additive and keeps every legacy REAL column for rollback.

ALTER TABLE users ADD COLUMN balance_piasters INTEGER;

ALTER TABLE services ADD COLUMN price_piasters INTEGER;
ALTER TABLE services ADD COLUMN cost_piasters INTEGER;
ALTER TABLE services ADD COLUMN profit_piasters INTEGER;
ALTER TABLE services ADD COLUMN discount_piasters INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN fees_piasters INTEGER NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN price_piasters INTEGER;
ALTER TABLE orders ADD COLUMN cost_piasters INTEGER;
ALTER TABLE orders ADD COLUMN profit_piasters INTEGER;
ALTER TABLE orders ADD COLUMN discount_piasters INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN fees_piasters INTEGER NOT NULL DEFAULT 0;

ALTER TABLE price_tiers ADD COLUMN price_per_1000_piasters INTEGER;
ALTER TABLE payment_methods ADD COLUMN min_amount_piasters INTEGER;
ALTER TABLE payment_methods ADD COLUMN max_amount_piasters INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN amount_piasters INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN balance_before_piasters INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN balance_after_piasters INTEGER;
ALTER TABLE sms_webhook_events ADD COLUMN amount_piasters INTEGER;

-- Safe automatic backfill is limited to columns whose current unit is confirmed EGP.
UPDATE services
SET price_piasters = ROUND(price_egp * 100)
WHERE price_egp IS NOT NULL AND price_piasters IS NULL;

UPDATE orders
SET price_piasters = ROUND(price * 100)
WHERE currency = 'EGP' AND price_piasters IS NULL;

UPDATE price_tiers
SET price_per_1000_piasters = ROUND(price_per_1000 * 100)
WHERE price_per_1000_piasters IS NULL;

-- USD/SAR/mixed-currency fields intentionally remain NULL until a currency
-- normalization decision and exchange-rate snapshot are approved.
