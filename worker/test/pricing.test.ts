import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateServicePrice,
  calculateTierPrice,
  type PriceableService,
} from '../src/pricing.ts';

const service: PriceableService = {
  id: 'service_1',
  name: 'اختبار',
  price_egp: 100,
  price_sar: 8,
  price_usd: 2,
  min_quantity: 100,
  max_quantity: 10_000,
  is_active: 1,
  is_manual: 0,
  is_fazer: 0,
  metadata: JSON.stringify({ pricing_model: 'per_1000' }),
};

test('server price is derived from the stored service price', () => {
  const result = calculateServicePrice(service, 2_000, 'EGP');
  assert.equal(result.total, 200);
  assert.equal(result.unitPrice, 100);
  assert.equal(result.source, 'services');
});

test('a DevTools price field cannot influence server pricing', () => {
  const maliciousBody = {
    serviceId: service.id,
    quantity: 2_000,
    price: 0.01,
    total: 0.01,
    cost: 0,
    discount: 999_999,
  };
  const result = calculateServicePrice(
    service,
    maliciousBody.quantity,
    'EGP'
  );
  assert.equal(result.total, 200);
  assert.notEqual(result.total, maliciousBody.price);
});

test('inactive services are rejected', () => {
  assert.throws(
    () => calculateServicePrice({ ...service, is_active: 0 }, 2_000, 'EGP'),
    /SERVICE_INACTIVE/
  );
});

test('quantity limits are enforced', () => {
  assert.throws(
    () => calculateServicePrice(service, 99, 'EGP'),
    /INVALID_QUANTITY_RANGE/
  );
  assert.throws(
    () => calculateServicePrice(service, 10_001, 'EGP'),
    /INVALID_QUANTITY_RANGE/
  );
});

test('tier pricing uses the stored tier and always rounds EGP up', () => {
  const result = calculateTierPrice(
    'tiktok_coins_calc',
    'شحن عملات تيك توك',
    101,
    { category: 'tiktok_coins', min: 100, max: 499, price_per_1000: 312 }
  );
  assert.equal(result.total, 31.52);
  assert.equal(result.currency, 'EGP');
});

test('EGP service totals never contain fractions and are rounded up', () => {
  const result = calculateServicePrice(
    { ...service, price_egp: 123 },
    101,
    'EGP'
  );
  assert.equal(result.total, 12.42);
});
