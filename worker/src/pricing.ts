export type SupportedCurrency = 'EGP' | 'SAR' | 'USD';

export interface PriceableService {
  id: string;
  name: string;
  price_egp: number | null;
  price_sar: number | null;
  price_usd: number | null;
  min_quantity: number;
  max_quantity: number;
  is_active: number;
  is_manual: number;
  is_fazer: number;
  metadata?: string | null;
}

export interface PriceTier {
  category: string;
  min: number;
  max: number;
  price_per_1000: number;
}

export interface PriceSnapshot {
  serviceId: string;
  serviceName: string;
  quantity: number;
  currency: SupportedCurrency;
  unitPrice: number;
  pricingModel: 'per_unit' | 'per_1000';
  total: number;
  source: 'services' | 'price_tiers';
  tier?: {
    category: string;
    min: number;
    max: number;
    pricePer1000: number;
  };
}

function finitePositive(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ceilTo2Decimals(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  const normalized = Math.round(val * 1e8) / 1e8;
  return Math.ceil(normalized * 100 - 1e-9) / 100;
}

function parseMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function calculateServicePrice(
  service: PriceableService,
  quantityInput: number,
  currency: SupportedCurrency
): PriceSnapshot {
  if (service.is_active !== 1) throw new Error('SERVICE_INACTIVE');

  const quantity = finitePositive(quantityInput, 'quantity');
  if (!Number.isInteger(quantity)) throw new Error('INVALID_QUANTITY');
  if (quantity < service.min_quantity || quantity > service.max_quantity) {
    throw new Error('INVALID_QUANTITY_RANGE');
  }

  const priceField =
    currency === 'EGP'
      ? service.price_egp
      : currency === 'SAR'
        ? service.price_sar
        : service.price_usd;
  const unitPrice = finitePositive(priceField, 'service_price');
  const metadata = parseMetadata(service.metadata);
  const configuredModel = metadata.pricing_model;
  const pricingModel =
    configuredModel === 'per_unit' || configuredModel === 'per_1000'
      ? configuredModel
      : service.is_manual === 1 || service.is_fazer === 1
        ? 'per_unit'
        : 'per_1000';
  const total =
    pricingModel === 'per_unit'
      ? roundMoney(quantity * unitPrice)
      : roundMoney((quantity * unitPrice) / 1000);

  return {
    serviceId: service.id,
    serviceName: service.name,
    quantity,
    currency,
    unitPrice,
    pricingModel,
    total: ceilTo2Decimals(total),
    source: 'services',
  };
}

export function calculateTierPrice(
  serviceId: string,
  serviceName: string,
  quantityInput: number,
  tier: PriceTier
): PriceSnapshot {
  const quantity = finitePositive(quantityInput, 'quantity');
  if (!Number.isInteger(quantity)) throw new Error('INVALID_QUANTITY');
  if (quantity < tier.min || quantity > tier.max) {
    throw new Error('INVALID_QUANTITY_RANGE');
  }

  const unitPrice = finitePositive(tier.price_per_1000, 'tier_price');
  return {
    serviceId,
    serviceName,
    quantity,
    currency: 'EGP',
    unitPrice,
    pricingModel: 'per_1000',
    total: ceilTo2Decimals((quantity * unitPrice) / 1000),
    source: 'price_tiers',
    tier: {
      category: tier.category,
      min: tier.min,
      max: tier.max,
      pricePer1000: unitPrice,
    },
  };
}

export async function getServerPrice(
  db: D1Database,
  serviceId: string,
  quantity: number,
  requestedCurrency: SupportedCurrency
): Promise<PriceSnapshot> {
  if (serviceId === 'tiktok_coins' || serviceId === 'tiktok_coins_calc') {
    const tier = await db
      .prepare(
        `SELECT category, min, max, price_per_1000
         FROM price_tiers
         WHERE category = 'tiktok_coins' AND ? BETWEEN min AND max
         ORDER BY min ASC
         LIMIT 1`
      )
      .bind(quantity)
      .first<PriceTier>();
    if (!tier) throw new Error('PRICE_TIER_NOT_FOUND');
    return calculateTierPrice(
      'tiktok_coins_calc',
      'شحن عملات تيك توك',
      quantity,
      tier
    );
  }

  const service = await db
    .prepare(
      `SELECT id, name, price_egp, price_sar, price_usd, min_quantity,
              max_quantity, is_active, is_manual, is_fazer, metadata
       FROM services
       WHERE id = ?
       LIMIT 1`
    )
    .bind(serviceId)
    .first<PriceableService>();

  if (!service) throw new Error('SERVICE_NOT_FOUND');
  return calculateServicePrice(service, quantity, requestedCurrency);
}
