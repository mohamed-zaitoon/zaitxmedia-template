import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amountsMatchUsd,
  calculateBinanceSignature,
  generateNonce,
  mapBinanceStatusToInternal,
  usdToCents,
  verifyBinanceWebhookSignature,
} from "./binance-pay";

test("1. Convert USD amount to integer cents", () => {
  assert.equal(usdToCents(10), 1000);
  assert.equal(usdToCents(10.0), 1000);
  assert.equal(usdToCents(10.05), 1005);
  assert.equal(usdToCents(9.99), 999);
});

test("2. Exact USD amount matching", () => {
  assert.equal(amountsMatchUsd(10.0, 10.0), true);
  assert.equal(amountsMatchUsd(10.0, 10.00), true);
  assert.equal(amountsMatchUsd(10.0, 9.99), false);
  assert.equal(amountsMatchUsd(10.0, 10.01), false);
});

test("3. Generate 32-character random nonce", () => {
  const nonce1 = generateNonce();
  const nonce2 = generateNonce();
  assert.equal(nonce1.length, 32);
  assert.equal(nonce2.length, 32);
  assert.notEqual(nonce1, nonce2);
});

test("4. Calculate and verify Binance Pay HMAC-SHA512 signature", async () => {
  const secret = "EUMfltGGORHNPQ8IG0OhhYuwJps9gGZteVAUuikjIDftFNzlAjFWOpdIvhwJBICV";
  const timestamp = 1700000000000;
  const nonce = "abcdefghijklmnopqrstuvwxyz123456";
  const body = JSON.stringify({ merchantTradeNo: "BP_123", amount: 10.0, currency: "USD" });

  const signature = await calculateBinanceSignature(secret, timestamp, nonce, body);
  assert.ok(typeof signature === "string");
  assert.ok(signature.length > 32);

  const isValid = await verifyBinanceWebhookSignature(secret, timestamp, nonce, body, signature);
  assert.equal(isValid, true);

  const isWrongSig = await verifyBinanceWebhookSignature(secret, timestamp, nonce, body, "WRONG_SIGNATURE");
  assert.equal(isWrongSig, false);
});

test("5. Map Binance Pay official status to internal deposit status", () => {
  assert.equal(mapBinanceStatusToInternal("PAID"), "confirmed");
  assert.equal(mapBinanceStatusToInternal("SUCCESS"), "confirmed");
  assert.equal(mapBinanceStatusToInternal("INITIAL"), "pending");
  assert.equal(mapBinanceStatusToInternal("PENDING"), "pending");
  assert.equal(mapBinanceStatusToInternal("EXPIRED"), "expired");
  assert.equal(mapBinanceStatusToInternal("CANCELED"), "failed");
  assert.equal(mapBinanceStatusToInternal("FAILED"), "failed");
  assert.equal(mapBinanceStatusToInternal("UNKNOWN"), "manual_review");
});
