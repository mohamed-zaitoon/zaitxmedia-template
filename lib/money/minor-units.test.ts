// Money utility tests
// Run: npx tsx lib/money/minor-units.test.ts

import { parseAmountToMinorUnits, formatMinorUnits, normalizeNumericInput, validateMoneyInput } from "./minor-units";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

console.log("=== Parse EGP to Piasters ===");
assert(parseAmountToMinorUnits("1502", "EGP") === 150200, "1502 → 150200");
assert(parseAmountToMinorUnits("1502.25", "EGP") === 150225, "1502.25 → 150225");
assert(parseAmountToMinorUnits("1502.2", "EGP") === 150220, "1502.2 → 150220");
assert(parseAmountToMinorUnits("1,502.25", "EGP") === 150225, "1,502.25 → 150225");

console.log("\n=== Parse SAR to Halalas ===");
assert(parseAmountToMinorUnits("1502.25", "SAR") === 150225, "1502.25 SAR → 150225");

console.log("\n=== Arabic numerals ===");
assert(parseAmountToMinorUnits("١٥٠٢.٢٥", "EGP") === 150225, "Arabic ١٥٠٢.٢٥ → 150225");

console.log("\n=== Validation ===");
let r = validateMoneyInput("1502.25", "EGP");
assert(r.valid && r.amountMinor === 150225, "Valid 1502.25 EGP");

r = validateMoneyInput("1502.255", "EGP");
assert(!r.valid, "Rejects 3 decimal places");

r = validateMoneyInput("-100", "EGP");
assert(!r.valid, "Rejects negative");

r = validateMoneyInput("abc", "EGP");
assert(!r.valid, "Rejects non-numeric");

console.log("\n=== Format ===");
assert(formatMinorUnits(150225, "EGP") === "1,502.25 £", "150225 → 1,502.25 £");
assert(formatMinorUnits(150225, "SAR") === "1,502.25 ﷼", "150225 → 1,502.25 ﷼");

console.log("\n=== Normalize input ===");
assert(normalizeNumericInput("1,502.25 ج.م") === "1502.25", "Strip ج.م and comma");
assert(normalizeNumericInput("١٥٠٢.٢٥") === "1502.25", "Arabic digits");

console.log("\n=== All tests complete ===");
