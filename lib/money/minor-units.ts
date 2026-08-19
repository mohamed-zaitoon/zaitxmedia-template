// Money utility - minor unit conversions (piasters, halalas)
// No floats for financial amounts

export type Currency = "EGP" | "SAR";

/**
 * Parse a money string/number to minor units (piasters or halalas)
 * EGP: 1502.25 → 150225 piasters
 * SAR: 1502.25 → 150225 halalas
 */
export function parseAmountToMinorUnits(input: string | number, currency: Currency): number {
  const str = normalizeNumericInput(String(input));
  const num = Number(str);
  
  if (isNaN(num) || num < 0) {
    throw new Error(`Invalid amount: ${input}`);
  }
  
  // Check decimal places
  const parts = str.split(".");
  if (parts.length > 1 && parts[1].length > 2) {
    throw new Error(`Amount has more than 2 decimal places: ${input}`);
  }
  
  return Math.round(num * 100);
}

/**
 * Format minor units back to display string
 * 150225 → "1,502.25"
 */
export function formatMinorUnits(amountMinor: number, currency: Currency): string {
  const pounds = amountMinor / 100;
  const symbol = currency === "EGP" ? "£" : "﷼";
  const numStr = pounds.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `\u2066${numStr} ${symbol}\u2069`;
}

/**
 * Get minor units as unformatted number
 */
export function minorToMajor(amountMinor: number): number {
  return amountMinor / 100;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  return currency === "EGP" ? "£" : "﷼";
}

/**
 * Normalize Arabic numerals and remove commas/spaces
 */
export function normalizeNumericInput(input: string): string {
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let result = input.replace(/[٠-٩]/g, (d) => String(arabicNumerals.indexOf(d)));
  // Remove commas, spaces, currency symbols
  result = result.replace(/[,،\s]|ج\.م|ر\.س|EGP|SAR|جنيه|ريال/gi, "");
  return result.trim();
}

/**
 * Validate money input
 */
export function validateMoneyInput(input: string, currency: Currency): { valid: boolean; amountMinor?: number; error?: string } {
  try {
    const amountMinor = parseAmountToMinorUnits(input, currency);
    if (amountMinor <= 0) {
      return { valid: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }
    if (currency === "EGP" && amountMinor > 100000000) {
      return { valid: false, error: "المبلغ كبير جداً" };
    }
    if (currency === "SAR" && amountMinor > 100000000) {
      return { valid: false, error: "المبلغ كبير جداً" };
    }
    return { valid: true, amountMinor };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

/**
 * Compare two money amounts
 */
export function compareMoney(a: number, b: number): number {
  return a - b;
}

/**
 * Round to nearest minor unit
 */
export function roundToMinor(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Safe division for financial calculations
 */
export function safeDivideMinor(amountMinor: number, divisor: number): number {
  if (divisor === 0) throw new Error("Division by zero");
  return Math.round(amountMinor / divisor);
}
