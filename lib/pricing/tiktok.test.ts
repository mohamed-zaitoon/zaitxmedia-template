import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBaseCostUSD,
  calculateActualCardFeeUSD,
  calculateActualCostUSD,
  calculateSmoothFixedFeeUSD,
  calculateProfitRate,
  calculateTikTokCoinPriceUSD,
  calculateTikTokPriceEgp,
  calculateTikTokCoinsFromEgp,
  calculateTikTokCoinsFromPriceUSD,
  convertPriceFromUSD,
  calculateActualProfit,
  ceilTo2Decimals,
} from "./tiktok";

test("Tier selling price per 1000 is used directly without duplicate profit/fees", () => {
  const sampleTiers = [
    { min: 100, max: 249, price_per_1000: 782.29 },
    { min: 250, max: 499, price_per_1000: 684.21 },
    { min: 500, max: 999, price_per_1000: 645.00 },
    { min: 1000, max: 1000000, price_per_1000: 616.20 },
  ];

  // 100 coins: 782.29 * 100 / 1000 = 78.229 -> 78.23 EGP
  assert.equal(calculateTikTokPriceEgp(100, sampleTiers, 54.25), 78.23);

  // 150 coins: 782.29 * 150 / 1000 = 117.3435 -> 117.35 EGP
  assert.equal(calculateTikTokPriceEgp(150, sampleTiers, 54.25), 117.35);

  // 200 coins: 782.29 * 200 / 1000 = 156.458 -> 156.46 EGP
  assert.equal(calculateTikTokPriceEgp(200, sampleTiers, 54.25), 156.46);

  // 249 coins is capped at 250 coins price (171.06 EGP) by monotonic ceiling protection
  assert.equal(calculateTikTokPriceEgp(249, sampleTiers, 54.25), 171.06);

  // 250 coins: 684.21 * 250 / 1000 = 171.0525 -> 171.06 EGP
  assert.equal(calculateTikTokPriceEgp(250, sampleTiers, 54.25), 171.06);
});

test("Quantities boundaries produce monotonic prices without drops", () => {
  const testQuantities = [
    100, 101, 248, 249, 250, 251, 498, 499, 500, 501, 998, 999, 1000, 1001,
    5000, 10000, 100000, 1000000,
  ];

  let prevPrice = 0;
  for (const q of testQuantities) {
    const priceUSD = calculateTikTokCoinPriceUSD(q);
    assert.ok(
      priceUSD >= prevPrice,
      `Price at quantity ${q} ($${priceUSD}) must be >= price at previous quantity ($${prevPrice})`
    );
    prevPrice = priceUSD;
  }
});

test("No negative price jumps at 249->250, 499->500, 999->1000", () => {
  assert.ok(calculateTikTokCoinPriceUSD(250) >= calculateTikTokCoinPriceUSD(249));
  assert.ok(calculateTikTokCoinPriceUSD(500) >= calculateTikTokCoinPriceUSD(499));
  assert.ok(calculateTikTokCoinPriceUSD(1000) >= calculateTikTokCoinPriceUSD(999));
});

test("Exhaustive loop test for all quantities from 100 to 5000: price(q+1) >= price(q)", () => {
  let prevPrice = calculateTikTokCoinPriceUSD(100);
  for (let q = 101; q <= 5000; q++) {
    const currentPrice = calculateTikTokCoinPriceUSD(q);
    assert.ok(
      currentPrice >= prevPrice,
      `Monotonic violation at quantity ${q}: current=${currentPrice}, prev=${prevPrice}`
    );
    prevPrice = currentPrice;
  }
});

test("Actual profit is never negative across all tier boundaries", () => {
  const testQuantities = [100, 249, 250, 499, 500, 999, 1000, 5000, 1000000];
  for (const q of testQuantities) {
    const profit = calculateActualProfit(q);
    assert.ok(
      profit.actualProfitUSD >= 0,
      `Actual profit at q=${q} must be >= 0, got ${profit.actualProfitUSD}`
    );
    assert.ok(
      profit.actualProfitPercent >= 0,
      `Actual profit % at q=${q} must be >= 0, got ${profit.actualProfitPercent}%`
    );
  }
});

test("EGP and SAR prices are derived strictly from finalUSD", () => {
  const q = 500;
  const finalUSD = calculateTikTokCoinPriceUSD(q);
  const rates = { usd: 54.25, sar: 13.50 };

  const resUSD = convertPriceFromUSD(finalUSD, "USD", rates);
  const resEGP = convertPriceFromUSD(finalUSD, "EGP", rates);
  const resSAR = convertPriceFromUSD(finalUSD, "SAR", rates);

  assert.equal(resUSD.amount, ceilTo2Decimals(finalUSD));
  assert.equal(resEGP.amount, ceilTo2Decimals(finalUSD * rates.usd));
  assert.equal(resSAR.amount, ceilTo2Decimals((finalUSD * rates.usd) / rates.sar));
});

test("Reverse lookup matches coins accurately with stored tiers", () => {
  const sampleTiers = [
    { min: 100, max: 249, price_per_1000: 782.29 },
    { min: 250, max: 499, price_per_1000: 684.21 },
  ];

  const coins100 = calculateTikTokCoinsFromEgp(78.23, sampleTiers, 54.25);
  assert.equal(coins100, 100);
});
