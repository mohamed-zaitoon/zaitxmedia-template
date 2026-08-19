export type DepositMethod = "vodafone" | "instapay" | "barq" | "bank" | "wallet";
export type DepositCurrency = "EGP" | "SAR";
export const MAX_WALLET_BALANCE_USD = 20_000;
export const MAX_WALLET_BALANCE_EGP = 20_000 * 50;

export function getMaxWalletBalanceUsd(pricingConfig?: any): number {
  if (!pricingConfig) return 20_000;
  const val = Number(pricingConfig.max_wallet_balance_usd ?? pricingConfig.maxWalletBalanceUsd);
  if (Number.isFinite(val) && val > 0) return val;
  return 20_000;
}

export function getMethodFeePercent(method: string, pricingConfig?: any): number {
  if (!pricingConfig) return 0.57;
  const m = String(method || "").toLowerCase();

  if (m === "vodafone" || m === "wallet" || m === "fazer") {
    const val = Number(pricingConfig.wallet_fee_percent ?? pricingConfig.walletFeePercent ?? pricingConfig.vodafone_fee_percent ?? pricingConfig.vodafoneFeePercent);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  if (m === "instapay") {
    const val = Number(pricingConfig.instapay_fee_percent ?? pricingConfig.instapayFeePercent);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  if (m === "bank") {
    const val = Number(pricingConfig.bank_fee_percent ?? pricingConfig.bankFeePercent);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  if (m === "barq") {
    const val = Number(pricingConfig.barq_fee_percent ?? pricingConfig.barqFeePercent);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  if (m === "binance_pay" || m === "binance") {
    const val = Number(pricingConfig.binance_pay_fee_percent ?? pricingConfig.binancePayFeePercent);
    if (Number.isFinite(val) && val >= 0) return val;
    return 0;
  }

  const globalVal = Number(pricingConfig.deposit_fee_percent ?? pricingConfig.depositFeePercent ?? pricingConfig.feePercent);
  if (Number.isFinite(globalVal) && globalVal >= 0) return globalVal;

  return 0.57;
}

export function depositFeePercent(method: DepositMethod, pricingConfig?: any): number {
  return getMethodFeePercent(method, pricingConfig);
}

export function grossDepositRequiredForNet(
  requiredNet: number,
  feePercent: number,
  decimalPlaces = 0,
): number {
  if (
    !Number.isFinite(requiredNet)
    || requiredNet <= 0
    || !Number.isFinite(feePercent)
    || feePercent < 0
    || feePercent >= 100
  ) {
    return 0;
  }
  const factor = 10 ** decimalPlaces;
  return Math.ceil((requiredNet / (1 - feePercent / 100)) * factor) / factor;
}

export function calculateDepositCredit(input: {
  amount: number;
  currency: DepositCurrency;
  method: DepositMethod;
  usdEgpRate: number;
  sarEgpRate: number;
  feePercent?: number;
}) {
  const grossEgp =
    input.currency === "SAR" ? input.amount * input.sarEgpRate : input.amount;
  const feePercent = Number.isFinite(input.feePercent ?? NaN)
    ? input.feePercent!
    : depositFeePercent(input.method);
  const feeEgp = grossEgp * feePercent / 100;
  const netEgp = grossEgp - feeEgp;
  const creditUsd = netEgp / input.usdEgpRate;
  return { grossEgp, feePercent, feeEgp, netEgp, creditUsd };
}
