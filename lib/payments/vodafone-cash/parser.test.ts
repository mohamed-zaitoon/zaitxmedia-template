// Vodafone Cash SMS Parser Tests
// Run: npx tsx lib/payments/vodafone-cash/parser.test.ts

import { parseSms, normalizeNumerals, normalizePhone, TEST_MESSAGES } from "./parser";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✅ ${message}`);
}

function runTests() {
  console.log("=== Normalize Numerals ===");
  assert(normalizeNumerals("١٢٣٤٥٦٧٨٩٠") === "1234567890", "Arabic to English numerals");
  assert(normalizeNumerals("500.00") === "500.00", "English numerals unchanged");

  console.log("\n=== Normalize Phone ===");
  assert(normalizePhone("01012345678") === "01012345678", "Standard format");
  assert(normalizePhone("+201012345678") === "01012345678", "International format");
  assert(normalizePhone("201012345678") === "01012345678", "Without plus");
  assert(normalizePhone("invalid") === null, "Invalid phone returns null");

  console.log("\n=== Parse SMS Messages ===");
  for (const test of TEST_MESSAGES) {
    const result = parseSms(test.raw);
    console.log(`\n  Message: ${test.raw.substring(0, 50)}...`);
    
    if (test.expectedAmount !== undefined) {
      assert(
        result.amountPiasters === test.expectedAmount,
        `Amount: ${result.amountPiasters} piasters (expected ${test.expectedAmount})`
      );
    }
    if (test.expectedPhone !== undefined) {
      assert(
        result.senderPhone === test.expectedPhone,
        `Phone: ${result.senderPhone} (expected ${test.expectedPhone})`
      );
    }
    if (test.expectedTxId !== undefined) {
      assert(
        result.transactionId === test.expectedTxId,
        `Transaction ID: ${result.transactionId} (expected ${test.expectedTxId})`
      );
    }
    console.log(`  Confidence: ${result.confidence}%`);
    console.log(`  Warnings: ${result.warnings.join(", ") || "none"}`);
  }

  console.log("\n=== Edge Cases ===");

  // Non-Vodafone message
  const nonVF = parseSms("Hello, this is a regular message");
  assert(nonVF.confidence === 0, "Non-Vodafone message rejected");
  assert(nonVF.warnings.includes("Not a received/credit transaction"), "Warning: Not received/credit");

  // Debit message (sent money)
  const debit = parseSms("تم تحويل مبلغ 100 ج.م من محفظتك إلى 01012345678 عبر فودافون كاش");
  console.log(`  Debit message confidence: ${debit.confidence}%`);
  if (debit.amountPiasters) {
    console.log(`  ⚠️  Debit message extracted amount: ${debit.amountPiasters} (may be false positive)`);
  }

  // Multipart - combine parts before parsing
  const combined = parseSms("تم استلام مبلغ 500.00 ج.م من 01012345678 عبر فودافون كاش");
  assert(combined.confidence > 0, "Combined message detected");
  assert(combined.amountPiasters === 50000, "Combined amount correct");

  console.log("\n=== All tests complete ===");
}

runTests();
