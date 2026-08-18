import { test } from "node:test";
import assert from "node:assert/strict";
import { getReceiptAutoDeleteTimestamp } from "./receipt-retention";

test("getReceiptAutoDeleteTimestamp calculates 15-minute future ISO string", () => {
  const before = Date.now();
  const isoStr = getReceiptAutoDeleteTimestamp(15 * 60 * 1000);
  const after = Date.now();

  const scheduledTime = new Date(isoStr).getTime();
  const minExpected = before + 15 * 60 * 1000 - 100;
  const maxExpected = after + 15 * 60 * 1000 + 100;

  assert.ok(scheduledTime >= minExpected, "Scheduled time should be at least 15 min from start");
  assert.ok(scheduledTime <= maxExpected, "Scheduled time should be at most 15 min from finish");
});
