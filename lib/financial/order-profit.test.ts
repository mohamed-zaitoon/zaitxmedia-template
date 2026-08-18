import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrderProfit,
  calculateSupplierCostUsd,
} from "./order-profit";

test("supplier price per 1000 is locked into the actual order cost", () => {
  assert.equal(calculateSupplierCostUsd(10.3, 250, "per_1000"), 2.575);
});

test("package supplier price is calculated per unit", () => {
  assert.equal(calculateSupplierCostUsd(4.25, 2, "per_unit"), 8.5);
});

test("historical local cost and profit use the locked exchange rate", () => {
  assert.deepEqual(
    calculateOrderProfit({
      saleAmountUsd: 4,
      supplierPriceUsd: 10,
      quantity: 250,
      basis: "per_1000",
      lockedExchangeRateEgp: 55,
    }),
    {
      supplierCostUsd: 2.5,
      profitUsd: 1.5,
      supplierCostLocal: 137.5,
      profitLocal: 82.5,
    },
  );
});
