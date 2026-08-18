import { ceilTo2Decimals } from "@/lib/pricing/tiktokCoins";

export interface DepositFeeConfig {
  feePercent: number; // e.g. 0.1 (%)
  minEgp: number;     // e.g. 0.5 (EGP)
  maxEgp: number;     // e.g. 20 (EGP), where 0 means no maximum fee limit
}

/**
 * Single Source of Truth Deposit Fee Calculator
 * Calculates deposit fees dynamically based on Admin Settings:
 * - feePercent (%)
 * - minimumFee (EGP / local currency)
 * - maximumFee (EGP / local currency, 0 means unlimited max fee)
 */
export function calculateDepositFee(
  amount: number,
  feePercent = 0.1,
  minimumFee = 0.5,
  maximumFee = 20
): {
  calculatedFee: number;
  depositFee: number;
  netAmount: number;
} {
  const numAmount = Math.max(0, Number(amount) || 0);
  const percent = Math.max(0, Number(feePercent) || 0);
  const minFee = Math.max(0, Number(minimumFee) || 0);
  const maxFee = Math.max(0, Number(maximumFee) || 0);

  const calculatedFee = numAmount * (percent / 100);

  let fee = 0;
  if (percent > 0) {
    fee = Math.max(calculatedFee, minFee);
    if (maxFee > 0) {
      fee = Math.min(fee, maxFee);
    }
  }

  // Ensure deposit fee never exceeds gross deposit amount
  fee = Math.min(numAmount, fee);

  const depositFee = ceilTo2Decimals(fee);
  const netAmount = ceilTo2Decimals(Math.max(0, numAmount - depositFee));

  return {
    calculatedFee,
    depositFee,
    netAmount,
  };
}

/**
 * Backward-compatible wrapper function
 */
export function calculateBoundedDepositFee(
  grossEgp: number,
  config: Partial<DepositFeeConfig>
): { rawFeeEgp: number; boundedFeeEgp: number; netEgp: number } {
  const feePercent = Number(config.feePercent ?? 0.1);
  const minEgp = Number(config.minEgp ?? 0.5);
  const maxEgp = Number(config.maxEgp ?? 20);

  const result = calculateDepositFee(grossEgp, feePercent, minEgp, maxEgp);

  return {
    rawFeeEgp: result.calculatedFee,
    boundedFeeEgp: result.depositFee,
    netEgp: result.netAmount,
  };
}
