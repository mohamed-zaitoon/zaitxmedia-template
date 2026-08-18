export * from "./tiktokCoins";
import { isGlobalUsdDiscountActive, calculateGlobalUsdDiscount, GlobalUsdDiscountConfig } from "./pricing-discount";
import {
  calculateTikTokCoinPriceUSD,
  calculateTikTokCoinsFromPriceUSD,
  ceilTo2Decimals,
} from "./tiktokCoins";

export type TikTokPricingTier = {
  min: number;
  max: number;
  price_per_1000?: number;
  price_per_1000_usd?: number;
  locked_usd_rate?: number;
};

/**
 * Helper displaying rate per 1000 coins for a tier.
 * If price_per_1000_usd is defined, it converts via currentUsdRate.
 * Otherwise uses price_per_1000 stored in EGP.
 */
export function getTierEgpPer1000(
  tier: TikTokPricingTier,
  currentUsdRate = 54.25,
): number {
  const usdPrice = Number(tier.price_per_1000_usd);
  const rate = Number(currentUsdRate) || 54.25;
  if (Number.isFinite(usdPrice) && usdPrice > 0 && rate > 0) {
    return usdPrice * rate;
  }
  const storedEgp = Number(tier.price_per_1000);
  if (Number.isFinite(storedEgp) && storedEgp > 0) {
    return storedEgp;
  }
  return 645;
}

export function getTikTokPricePer1000(
  coins: number,
  tiers?: TikTokPricingTier[],
  currentUsdRate = 54.25,
  fallback = 645,
): number {
  if (coins <= 0) return fallback;
  if (tiers && tiers.length > 0) {
    const tier = tiers.find(
      (item) => coins >= Number(item.min) && coins <= Number(item.max),
    );
    if (tier) {
      return getTierEgpPer1000(tier, currentUsdRate) || fallback;
    }
  }
  const totalPriceEgp = calculateTikTokPriceEgp(coins, undefined, currentUsdRate);
  return (totalPriceEgp * 1000) / coins;
}

export function calculateTikTokOriginalPriceEgp(
  coins: number,
  tiers?: TikTokPricingTier[],
  currentUsdRate = 54.25,
): number {
  return calculateTikTokPriceEgp(coins, tiers, currentUsdRate, null);
}

/**
 * Calculate total final selling price in EGP for a given quantity of TikTok coins.
 * When matching tiers are provided (from admin settings), totalPrice = (coins * pricePer1000) / 1000.
 */
export function calculateTikTokPriceEgp(
  coins: number,
  tiers?: TikTokPricingTier[],
  currentUsdRate = 54.25,
  globalUsdDiscountConfig?: Partial<GlobalUsdDiscountConfig> | null,
): number {
  const c = Math.max(0, Number(coins) || 0);
  if (c <= 0) return 0;

  let baseEgp = 0;

  if (tiers && tiers.length > 0) {
    const sortedTiers = [...tiers].sort((a, b) => Number(a.min) - Number(b.min));
    const tier = sortedTiers.find(
      (item) => c >= Number(item.min) && c <= Number(item.max),
    );
    if (tier) {
      const pricePer1000 = getTierEgpPer1000(tier, currentUsdRate);
      let raw = (c * pricePer1000) / 1000;

      for (const higherTier of sortedTiers) {
        if (Number(higherTier.min) > c) {
          const higherTierMinCoins = Number(higherTier.min);
          const higherTierRate = getTierEgpPer1000(higherTier, currentUsdRate);
          const higherTierPrice = (higherTierMinCoins * higherTierRate) / 1000;
          if (higherTierPrice < raw) {
            raw = higherTierPrice;
          }
        }
      }

      baseEgp = ceilTo2Decimals(raw);
    }
  }

  if (baseEgp <= 0) {
    // Fallback: dynamic smooth pricing engine
    const finalUSD = calculateTikTokCoinPriceUSD(c);
    const rateVal = Number(currentUsdRate) || 54.25;
    baseEgp = ceilTo2Decimals(finalUSD * rateVal);
  }

  const rate = Number(currentUsdRate) || 54.25;
  const baseUsd = baseEgp / rate;

  if (isGlobalUsdDiscountActive(globalUsdDiscountConfig) && baseUsd >= (10 - 1e-4)) {
    const res = calculateGlobalUsdDiscount(baseUsd, globalUsdDiscountConfig, 10);
    if (res.hasDiscount) {
      return ceilTo2Decimals(res.finalPrice * rate);
    }
  }

  return baseEgp;
}

/**
 * Reverse calculation: Calculate quantity of TikTok coins for a given EGP budget.
 */
export function calculateTikTokCoinsFromEgp(
  priceEgp: number,
  tiers?: TikTokPricingTier[],
  currentUsdRate = 54.25,
  fallbackPer1000 = 645,
  globalUsdDiscountConfig?: Partial<GlobalUsdDiscountConfig> | null,
  maxCoins = 2500000,
): number {
  const p = Number(priceEgp);
  if (!Number.isFinite(p) || p <= 0) return 0;

  const rate = Number(currentUsdRate) || 54.25;
  const budgetUsd = p / rate;

  let effectiveBudgetEgp = p;
  if (isGlobalUsdDiscountActive(globalUsdDiscountConfig) && budgetUsd >= (10 - 1e-4)) {
    const rawPercent = Number(globalUsdDiscountConfig?.discountPercent ?? globalUsdDiscountConfig?.discount_percent ?? 0);
    const maxCap = Number(globalUsdDiscountConfig?.maxDiscountUsd ?? globalUsdDiscountConfig?.max_discount_usd ?? 0);

    let origUsd = budgetUsd;
    if (rawPercent > 0) {
      if (maxCap > 0 && (budgetUsd + maxCap) * (rawPercent / 100) >= maxCap) {
        origUsd = budgetUsd + maxCap;
      } else {
        origUsd = budgetUsd / (1 - rawPercent / 100);
      }
    }
    effectiveBudgetEgp = origUsd * rate;
  }

  if (tiers && tiers.length > 0) {
    const sortedTiers = [...tiers].sort((a, b) => Number(b.min) - Number(a.min));
    for (const tier of sortedTiers) {
      const pricePer1000 = getTierEgpPer1000(tier, currentUsdRate);
      if (pricePer1000 <= 0) continue;
      const c = (effectiveBudgetEgp * 1000) / pricePer1000;
      if (c >= Number(tier.min) - 1e-4 && c <= Number(tier.max) + 0.9999) {
        return Math.floor(c);
      }
    }
  }

  const priceUSD = effectiveBudgetEgp / rate;
  return calculateTikTokCoinsFromPriceUSD(priceUSD, maxCoins);
}
