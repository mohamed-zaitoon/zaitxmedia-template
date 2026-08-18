export type SupplierPricingBasis = "per_1000" | "per_unit";

export function calculateSupplierCostUsd(
  supplierPriceUsd: number,
  quantity: number,
  basis: SupplierPricingBasis,
): number {
  if (
    !Number.isFinite(supplierPriceUsd)
    || supplierPriceUsd < 0
    || !Number.isFinite(quantity)
    || quantity <= 0
  ) {
    throw new Error("INVALID_SUPPLIER_PRICE");
  }
  const cost =
    basis === "per_1000"
      ? (quantity * supplierPriceUsd) / 1000
      : quantity * supplierPriceUsd;
  return Number(cost.toFixed(6));
}

export function calculateOrderProfit(input: {
  saleAmountUsd: number;
  supplierPriceUsd: number;
  quantity: number;
  basis: SupplierPricingBasis;
  lockedExchangeRateEgp: number;
}) {
  const supplierCostUsd = calculateSupplierCostUsd(
    input.supplierPriceUsd,
    input.quantity,
    input.basis,
  );
  const profitUsd = Number((input.saleAmountUsd - supplierCostUsd).toFixed(6));
  return {
    supplierCostUsd,
    profitUsd,
    supplierCostLocal: Number((supplierCostUsd * input.lockedExchangeRateEgp).toFixed(2)),
    profitLocal: Number((profitUsd * input.lockedExchangeRateEgp).toFixed(2)),
  };
}
