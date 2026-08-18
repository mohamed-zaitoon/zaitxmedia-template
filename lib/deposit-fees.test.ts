import assert from "node:assert/strict";
import test from "node:test";
import { calculateDepositFee } from "./deposit-fees";

test("Deposit fee calculation with standard settings: feePercent=0.1, minFee=0.50, maxFee=20", () => {
  const p = 0.1;
  const minF = 0.50;
  const maxF = 20;

  // Amount 1 EGP: fee capped by amount = 0.50 EGP, net = 0.50 EGP
  const res1 = calculateDepositFee(1, p, minF, maxF);
  assert.equal(res1.depositFee, 0.50);
  assert.equal(res1.netAmount, 0.50);

  // Amount 50 EGP: 0.1% = 0.05 EGP -> min fee = 0.50 EGP
  const res50 = calculateDepositFee(50, p, minF, maxF);
  assert.equal(res50.depositFee, 0.50);
  assert.equal(res50.netAmount, 49.50);

  // Amount 100 EGP: 0.1% = 0.10 EGP -> min fee = 0.50 EGP
  const res100 = calculateDepositFee(100, p, minF, maxF);
  assert.equal(res100.depositFee, 0.50);
  assert.equal(res100.netAmount, 99.50);

  // Amount 499 EGP: 0.1% = 0.499 EGP -> min fee = 0.50 EGP
  const res499 = calculateDepositFee(499, p, minF, maxF);
  assert.equal(res499.depositFee, 0.50);
  assert.equal(res499.netAmount, 498.50);

  // Amount 500 EGP: 0.1% = 0.50 EGP -> min fee = 0.50 EGP
  const res500 = calculateDepositFee(500, p, minF, maxF);
  assert.equal(res500.depositFee, 0.50);
  assert.equal(res500.netAmount, 499.50);

  // Amount 501 EGP: 0.1% = 0.501 EGP -> fee = 0.51 EGP
  const res501 = calculateDepositFee(501, p, minF, maxF);
  assert.equal(res501.depositFee, 0.51);
  assert.equal(res501.netAmount, 500.49);

  // Amount 1000 EGP: 0.1% = 1.00 EGP -> fee = 1.00 EGP
  const res1000 = calculateDepositFee(1000, p, minF, maxF);
  assert.equal(res1000.depositFee, 1.00);
  assert.equal(res1000.netAmount, 999.00);

  // Amount 5000 EGP: 0.1% = 5.00 EGP -> fee = 5.00 EGP
  const res5000 = calculateDepositFee(5000, p, minF, maxF);
  assert.equal(res5000.depositFee, 5.00);
  assert.equal(res5000.netAmount, 4995.00);

  // Amount 19999 EGP: 0.1% = 19.999 EGP -> fee = 20.00 EGP
  const res19999 = calculateDepositFee(19999, p, minF, maxF);
  assert.equal(res19999.depositFee, 20.00);
  assert.equal(res19999.netAmount, 19979.00);

  // Amount 20000 EGP: 0.1% = 20.00 EGP -> fee = 20.00 EGP
  const res20000 = calculateDepositFee(20000, p, minF, maxF);
  assert.equal(res20000.depositFee, 20.00);
  assert.equal(res20000.netAmount, 19980.00);

  // Amount 20001 EGP: 0.1% = 20.001 EGP -> max fee = 20.00 EGP
  const res20001 = calculateDepositFee(20001, p, minF, maxF);
  assert.equal(res20001.depositFee, 20.00);
  assert.equal(res20001.netAmount, 19981.00);

  // Amount 30000 EGP: 0.1% = 30.00 EGP -> max fee = 20.00 EGP
  const res30000 = calculateDepositFee(30000, p, minF, maxF);
  assert.equal(res30000.depositFee, 20.00);
  assert.equal(res30000.netAmount, 29980.00);

  // Amount 100000 EGP: 0.1% = 100.00 EGP -> max fee = 20.00 EGP
  const res100000 = calculateDepositFee(100000, p, minF, maxF);
  assert.equal(res100000.depositFee, 20.00);
  assert.equal(res100000.netAmount, 99980.00);
});

test("Zero fee test: feePercent=0, minFee=0, maxFee=0", () => {
  const res = calculateDepositFee(500, 0, 0, 0);
  assert.equal(res.depositFee, 0);
  assert.equal(res.netAmount, 500);
});

test("No max fee limit test: feePercent=0.1, minFee=0.5, maxFee=0", () => {
  const res = calculateDepositFee(30000, 0.1, 0.5, 0);
  assert.equal(res.depositFee, 30.00);
  assert.equal(res.netAmount, 29970.00);
});

test("Dynamic admin configuration test: feePercent=0.25, minFee=1, maxFee=30", () => {
  const res100 = calculateDepositFee(100, 0.25, 1, 30);
  assert.equal(res100.depositFee, 1.00); // 0.25% of 100 = 0.25 -> min fee 1.00

  const res10000 = calculateDepositFee(10000, 0.25, 1, 30);
  assert.equal(res10000.depositFee, 25.00); // 0.25% of 10000 = 25.00

  const res30000 = calculateDepositFee(30000, 0.25, 1, 30);
  assert.equal(res30000.depositFee, 30.00); // 0.25% of 30000 = 75.00 -> max fee 30.00
});
