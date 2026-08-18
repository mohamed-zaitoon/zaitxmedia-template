/**
 * TikTok Coins Dynamic Pricing Engine
 * Single Source of Truth for TikTok Coins Pricing Logic.
 */

export interface ExchangeRates {
  usd: number; // USD to EGP rate (e.g. 54.25 EGP)
  sar: number; // SAR to EGP rate (Google SAR rate in EGP - 0.75)
}

/**
 * 1. Base Cost (USD)
 * 1000 coins base cost = 10.30 USD
 */
export function calculateBaseCostUSD(quantity: number, maxLimit = 2500000): number {
  const q = Math.max(100, Math.min(maxLimit, quantity));
  return (q / 1000) * 10.30;
}

/**
 * 2. Actual Gateway Card Fee (USD)
 * 100-249: 1% + 0.30 USD
 * 250-499: 1% + 0.20 USD
 * 500-999: 1% + 0.10 USD
 * 1000+:   1% + 0.00 USD
 */
export function calculateActualCardFeeUSD(quantity: number, maxLimit = 2500000): number {
  const q = Math.max(100, Math.min(maxLimit, quantity));
  const baseCost = calculateBaseCostUSD(q, maxLimit);
  const percentageFee = baseCost * 0.01;
  const fixedFee = q < 250 ? 0.30 : q < 500 ? 0.20 : q < 1000 ? 0.10 : 0.00;
  return percentageFee + fixedFee;
}

/**
 * Actual total cost in USD (base cost + actual gateway fee)
 */
export function calculateActualCostUSD(quantity: number, maxLimit = 2500000): number {
  const q = Math.max(100, Math.min(maxLimit, quantity));
  return calculateBaseCostUSD(q, maxLimit) + calculateActualCardFeeUSD(q, maxLimit);
}

/**
 * 3. Smooth Fixed Fee (USD)
 * Interpolates fixed fee linearly between tier boundaries to avoid price jumps.
 */
export function calculateSmoothFixedFeeUSD(quantity: number, maxLimit = 2500000): number {
  const q = Math.max(100, Math.min(maxLimit, quantity));
  if (q <= 249) return 0.30;
  if (q <= 499) {
    return 0.30 - ((q - 250) / (499 - 250)) * 0.10;
  }
  if (q <= 999) {
    return 0.20 - ((q - 500) / (999 - 500)) * 0.10;
  }
  return 0.00;
}

/**
 * 4. Smooth Profit Margin
 * 40% at 100 coins down to 10% at 1000 coins (clamped between 10% and 40%).
 */
export function calculateProfitRate(quantity: number): number {
  const q = Math.max(100, Math.min(1000000, quantity));
  if (q <= 100) return 0.40;
  if (q >= 1000) return 0.10;
  return 0.40 - ((q - 100) / 900) * 0.30;
}

/**
 * Internal raw unfloored final USD calculation
 */
function rawFinalUSD(q: number): number {
  const baseCost = (q / 1000) * 10.30;
  const percentageFee = baseCost * 0.01;
  const smoothFee = calculateSmoothFixedFeeUSD(q);
  const pricingCost = baseCost + percentageFee + smoothFee;
  const profitRate = calculateProfitRate(q);
  return pricingCost * (1 + profitRate);
}

/**
 * 5 & 6. Final Price in USD with Monotonic Guarantee
 * Guarantees price(q + 1) >= price(q) for all q in [100, 1000000].
 */
export function calculateTikTokCoinPriceUSD(quantity: number): number {
  const q = Math.max(100, Math.min(1000000, quantity));
  const raw = rawFinalUSD(q);

  // Monotonic floor protection:
  // Around tier 1000 where smoothFixedFee reaches 0, ensure price never dips below 999 coins.
  if (q >= 1000 && q < 1015) {
    const floorPrice = rawFinalUSD(999);
    return Math.max(raw, floorPrice);
  }
  return raw;
}

/**
 * 8. Rounding helper: Ceil to 2 decimal places with floating point safety.
 */
export function ceilTo2Decimals(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  const normalized = Math.round(val * 1e8) / 1e8;
  return Math.ceil(normalized * 100 - 1e-9) / 100;
}

/**
 * 7 & 13. Convert USD price to requested display currency.
 */
export function convertPriceFromUSD(
  priceUSD: number,
  currency: "USD" | "EGP" | "SAR",
  rates?: { usd?: number; sar?: number },
): { amount: number; symbol: string; formatted: string } {
  const pUsd = Number(priceUSD) || 0;
  const usdRate = Number(rates?.usd) || 54.25;
  const sarRate = Number(rates?.sar) || 13.50; // 1 SAR in EGP (Google SAR - 0.75)

  if (currency === "USD") {
    const amt = ceilTo2Decimals(pUsd);
    return { amount: amt, symbol: "$", formatted: `$${amt}` };
  }

  if (currency === "SAR") {
    const priceSAR = (pUsd * usdRate) / sarRate;
    const amt = ceilTo2Decimals(priceSAR);
    return { amount: amt, symbol: "ر.س", formatted: `${amt} ر.س` };
  }

  // Default EGP
  const priceEGP = pUsd * usdRate;
  const amt = ceilTo2Decimals(priceEGP);
  return { amount: amt, symbol: "ج.م", formatted: `${amt} ج.م` };
}

/**
 * 9. Calculate Actual Profit USD and Profit Percentage
 */
export function calculateActualProfit(quantity: number): {
  actualCostUSD: number;
  pricingCostUSD: number;
  finalUSD: number;
  actualProfitUSD: number;
  actualProfitPercent: number;
} {
  const q = Math.max(100, Math.min(1000000, quantity));
  const baseCost = calculateBaseCostUSD(q);
  const actualCardFee = calculateActualCardFeeUSD(q);
  const actualCostUSD = baseCost + actualCardFee;

  const percentageFee = baseCost * 0.01;
  const smoothFee = calculateSmoothFixedFeeUSD(q);
  const pricingCostUSD = baseCost + percentageFee + smoothFee;

  const finalUSD = calculateTikTokCoinPriceUSD(q);
  const actualProfitUSD = finalUSD - actualCostUSD;
  const actualProfitPercent = (actualProfitUSD / actualCostUSD) * 100;

  return {
    actualCostUSD,
    pricingCostUSD,
    finalUSD,
    actualProfitUSD,
    actualProfitPercent,
  };
}

/**
 * Reverse lookup: Calculate coin quantity from USD price.
 * Uses binary search over [100, 1000000] for 100% accurate, monotonic reverse matching.
 */
export function calculateTikTokCoinsFromPriceUSD(priceUSD: number, maxLimit = 2500000): number {
  const p = Number(priceUSD);
  if (!Number.isFinite(p) || p <= 0) return 100;

  let low = 100;
  let high = maxLimit;
  let ans = 100;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const costMid = calculateTikTokCoinPriceUSD(mid);

    if (costMid <= p + 1e-6) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(100, Math.min(maxLimit, ans));
}
