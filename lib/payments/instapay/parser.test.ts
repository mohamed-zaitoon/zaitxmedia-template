// InstaPay Parser Tests
// Run: npx tsx lib/payments/instapay/parser.test.ts

import { normalizeInstaPayReference, validateReference, parseInstaPayMessage } from "./parser";
import { normalizeNumerals } from "../vodafone-cash/parser";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

console.log("=== Normalize Reference ===");
assert(normalizeInstaPayReference("Ref# 02025987") === "02025987", "Ref# 02025987 → 02025987");
assert(normalizeInstaPayReference("Ref #02025987") === "02025987", "Ref #02025987 → 02025987");
assert(normalizeInstaPayReference("Ref: 02025987") === "02025987", "Ref: 02025987 → 02025987");
assert(normalizeInstaPayReference("REF# AB205987") === "AB205987", "REF# AB205987 → AB205987 (uppercase)");
assert(normalizeInstaPayReference("Ref# AB-02025987") === "AB-02025987", "Ref# AB-02025987");
assert(normalizeInstaPayReference("Reference # X9K2/205987") === "X9K2/205987", "Reference # X9K2/205987");
assert(normalizeInstaPayReference("  ref : ab-02025987  ") === "AB-02025987", "Spaces + lowercase → normalized");

console.log("\n=== Validate Reference ===");
let r = validateReference("Ref# 02025987");
assert(r.valid && r.normalized === "02025987", "Valid ref 02025987");
r = validateReference("AB-205987");
assert(r.valid && r.normalized === "AB-205987", "Valid AB-205987");
r = validateReference("");
assert(!r.valid, "Rejects empty");
r = validateReference("AB");
assert(!r.valid, "Rejects too short");

console.log("\n=== Parse Messages ===");
const msg1 = "InstaPay: تم استلام 500.00 ج.م Ref# 02025987";
const p1 = parseInstaPayMessage(msg1);
assert(p1.transactionReferenceNormalized === "02025987", "Extracted ref 02025987");
assert(p1.amountPiasters === 50000, "Amount 50000 piasters");

const msg2 = "انستاباي: تم تحويل 1000.50 جنيه - Reference # AB-205987";
const p2 = parseInstaPayMessage(msg2);
assert(p2.transactionReferenceNormalized === "AB-205987", "Extracted AB-205987");
assert(p2.amountPiasters === 100050, "Amount 100050 piasters");

const msg3 = "تم استلام مبلغ من InstaPay";
const p3 = parseInstaPayMessage(msg3);
assert(p3.transactionReferenceNormalized === null, "No ref without Ref#");

console.log("\n=== All tests complete ===");
