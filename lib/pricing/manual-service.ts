import { isGlobalUsdDiscountActive, calculateGlobalUsdDiscount, GlobalUsdDiscountConfig } from "./pricing-discount";

/**
 * Returns the USD source price for a manually priced service.
 *
 * Older game packages were saved with only an EGP price.  Their
 * `locked_usd_rate` lets us recover the original USD price so they can start
 * following the current site USD rate without having to edit each package.
 */
export function getManualServicePriceUsd(
  service: Record<string, unknown>,
  fallbackUsdRate = 50,
): number {
  const explicitUsd = Number(service.priceUsd ?? service.price_usd);
  if (Number.isFinite(explicitUsd) && explicitUsd > 0) return explicitUsd;

  const legacyEgp = Number(service.price ?? service.price_egp);
  const rate = Number(service.locked_usd_rate ?? service.lockedUsdRate ?? fallbackUsdRate);
  if (
    Number.isFinite(legacyEgp)
    && legacyEgp > 0
    && Number.isFinite(rate)
    && rate > 0
  ) {
    return legacyEgp / rate;
  }

  return 0;
}

export function calculateManualServiceOriginalPriceEgp(
  service: Record<string, unknown>,
  usdRate: number,
): number {
  const priceUsd = getManualServicePriceUsd(service, usdRate);
  if (Number.isFinite(priceUsd) && priceUsd > 0 && Number.isFinite(usdRate) && usdRate > 0) {
    return Math.ceil(((priceUsd * usdRate) - 1e-9) * 100) / 100;
  }
  return Math.ceil(((Number(service.price ?? service.price_egp) || 0) - 1e-9) * 100) / 100;
}

export function calculateManualServicePriceEgp(
  service: Record<string, unknown>,
  usdRate: number,
  globalUsdDiscountConfig?: Partial<GlobalUsdDiscountConfig> | null,
): number {
  const priceUsd = getManualServicePriceUsd(service, usdRate);
  const rawItemDiscount = Number(service.discountPercent ?? service.discount_percent ?? 0);
  const itemDiscountPercent = Math.min(100, Math.max(0, rawItemDiscount));

  const effectivePriceUsd = priceUsd > 0 ? priceUsd : ((Number(service.price ?? service.price_egp) || 0) / (usdRate || 50));
  let finalPriceUsd = effectivePriceUsd;

  if (itemDiscountPercent > 0) {
    finalPriceUsd = effectivePriceUsd * (1 - itemDiscountPercent / 100);
  }

  if (isGlobalUsdDiscountActive(globalUsdDiscountConfig)) {
    const globalRes = calculateGlobalUsdDiscount(effectivePriceUsd, globalUsdDiscountConfig, 10);
    if (globalRes.hasDiscount && globalRes.finalPrice < finalPriceUsd) {
      finalPriceUsd = globalRes.finalPrice;
    }
  }

  return Math.ceil(((finalPriceUsd * (usdRate || 50)) - 1e-9) * 100) / 100;
}
