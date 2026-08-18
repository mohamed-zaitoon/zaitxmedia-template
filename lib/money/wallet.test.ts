import assert from "node:assert/strict";
import test from "node:test";
import { calculateDepositCredit, grossDepositRequiredForNet } from "./wallet";

test("wallet deposit keeps USD as the base and charges 0.57% for wallets", () => {
  const result = calculateDepositCredit({
    amount: 1000,
    currency: "EGP",
    method: "vodafone",
    usdEgpRate: 50,
    sarEgpRate: 13,
  });
  assert.equal(result.feeEgp, 5.7);
  assert.equal(result.creditUsd, 19.886);
});

test("InstaPay deposit charges 0.57%", () => {
  const result = calculateDepositCredit({
    amount: 1000,
    currency: "EGP",
    method: "instapay",
    usdEgpRate: 50,
    sarEgpRate: 13,
  });
  assert.equal(result.feeEgp, 5.7);
  assert.equal(result.creditUsd, 19.886);
});

test("Barq converts SAR using the adjusted SAR/EGP rate then charges 0.57%", () => {
  const result = calculateDepositCredit({
    amount: 100,
    currency: "SAR",
    method: "barq",
    usdEgpRate: 50,
    sarEgpRate: 13,
  });
  assert.equal(result.grossEgp, 1300);
  assert.equal(Math.round(result.feeEgp * 100) / 100, 7.41);
  assert.equal(Math.round(result.creditUsd * 10000) / 10000, 25.8518);
});

test("grosses up a wallet deposit so fees leave enough net balance", () => {
  const gross = grossDepositRequiredForNet(535, 0.75);
  assert.equal(gross, 540);
  assert.ok(gross * (1 - 0.75 / 100) >= 535);
});
