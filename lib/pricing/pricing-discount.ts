export interface GlobalUsdDiscountConfig {
  enabled: boolean;
  discountPercent: number;
  discount_percent?: number;
  maxDiscountUsd?: number | null;
  max_discount_usd?: number | null;
  expiresAt?: string | null;
  expires_at?: string | null;
}

export interface DualPriceResult {
  originalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  hasDiscount: boolean;
}

/**
 * Checks whether the Global USD Discount is currently enabled and not expired.
 */
export function isGlobalUsdDiscountActive(config?: Partial<GlobalUsdDiscountConfig> | null): boolean {
  if (!config || !config.enabled) return false;
  const percent = Number(config.discountPercent ?? config.discount_percent ?? 0);
  if (!Number.isFinite(percent) || percent <= 0) return false;

  const expireStr = config.expiresAt || config.expires_at;
  if (expireStr) {
    const expireTime = new Date(expireStr).getTime();
    if (Number.isFinite(expireTime) && Date.now() >= expireTime) {
      return false; // Discount has expired
    }
  }

  return true;
}

/**
 * Calculates Global USD Discount given an original USD price and discount settings.
 * Applies discount ONLY if the item price is >= $10 USD (or equivalent) and caps at maxDiscountUsd.
 */
export function calculateGlobalUsdDiscount(
  originalPriceUsd: number,
  config?: Partial<GlobalUsdDiscountConfig> | null,
  minUsdThreshold = 10,
): DualPriceResult {
  const price = Math.max(0, Number(originalPriceUsd) || 0);
  const active = isGlobalUsdDiscountActive(config);
  const rawPercent = Number(config?.discountPercent ?? config?.discount_percent ?? 0);
  const satisfiesThreshold = price >= (minUsdThreshold - 1e-4);
  const percent = active && satisfiesThreshold && Number.isFinite(rawPercent) && rawPercent > 0
    ? Math.min(100, Math.max(0, rawPercent))
    : 0;

  if (percent <= 0 || price <= 0) {
    return {
      originalPrice: price,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: price,
      hasDiscount: false,
    };
  }

  let discountAmount = Math.round((price * (percent / 100)) * 10000) / 10000;
  const maxCap = Number(config?.maxDiscountUsd ?? config?.max_discount_usd ?? 0);
  if (Number.isFinite(maxCap) && maxCap > 0 && discountAmount > maxCap) {
    discountAmount = maxCap;
  }

  const finalPrice = Math.max(0, Math.round((price - discountAmount) * 10000) / 10000);
  const effectivePercentage = price > 0 ? Math.round((discountAmount / price) * 100) : percent;

  return {
    originalPrice: price,
    discountPercentage: effectivePercentage,
    discountAmount,
    finalPrice,
    hasDiscount: discountAmount > 0,
  };
}

/**
 * Calculates dual prices in EGP from USD price, USD exchange rate, and Global USD Discount config.
 */
export function calculateDualPriceEgp(
  originalPriceUsd: number,
  usdRate: number,
  config?: Partial<GlobalUsdDiscountConfig> | null,
  itemDiscountPercent = 0,
): {
  originalPriceEgp: number;
  finalPriceEgp: number;
  discountPercentage: number;
  discountAmountEgp: number;
  hasDiscount: boolean;
} {
  const rate = Math.max(0, Number(usdRate) || 0);
  const globalRes = calculateGlobalUsdDiscount(originalPriceUsd, config);

  const originalEgp = Math.ceil(((originalPriceUsd * rate) - 1e-9) * 100) / 100;
  const finalEgp = Math.ceil(((globalRes.finalPrice * rate) - 1e-9) * 100) / 100;
  const discountAmountEgp = Math.max(0, originalEgp - finalEgp);

  return {
    originalPriceEgp: originalEgp,
    finalPriceEgp: finalEgp,
    discountPercentage: globalRes.discountPercentage,
    discountAmountEgp: discountAmountEgp,
    hasDiscount: globalRes.hasDiscount,
  };
}
