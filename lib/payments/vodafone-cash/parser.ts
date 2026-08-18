// Vodafone Cash SMS Parser
// Handles Arabic and English message formats
// Supports variations in wording, numbers, and spacing

export interface ParsedSms {
  provider: "vodafone_cash";
  amountPiasters: number | null;
  senderPhone: string | null;
  recipientWallet: string | null;
  transactionId: string | null;
  balancePiasters: number | null;
  occurredAt: string | null;
  confidence: number; // 0-100
  matchedPattern: string | null;
  warnings: string[];
}

/**
 * Normalize Arabic numerals (٠-٩) to English (0-9)
 */
export function normalizeNumerals(text: string): string {
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return text.replace(/[٠-٩]/g, (d) => String(arabicNumerals.indexOf(d)));
}

/**
 * Normalize Egyptian phone numbers to a standard format
 * Accepts: 01XXXXXXXXX, +201XXXXXXXXX, 201XXXXXXXXX
 * Returns: 01XXXXXXXXX
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, "");
  cleaned = cleaned.replace(/^\+20/, "");
  cleaned = cleaned.replace(/^20/, "");
  cleaned = cleaned.replace(/^0/, "");
  // Must be 10 digits starting with 1
  if (/^1[0125]\d{8}$/.test(cleaned)) return "0" + cleaned;
  return null;
}

/**
 * Extract amount in piasters (Egyptian pounds × 100)
 */
function extractPiasters(text: string): number | null {
  // Match: 500.00 ج.م, ١٠٠٠.٠٠ جنيه, 500 EGP, or standalone amount near currency words
  const match = text.match(/(\d{1,6}(?:\.\d{1,2})?)\s*(?:ج\.م|جنيه|EGP|LE|جنيهات|جنيهًا|جنيها)?/i);
  if (match) {
    const pounds = parseFloat(match[1]);
    if (!isNaN(pounds) && pounds > 0 && pounds < 1000000) {
      return Math.round(pounds * 100);
    }
  }
  // Also try: جنيه 500.00 (currency before amount)
  const match2 = text.match(/(?:ج\.م|جنيه|EGP|LE)\s*(\d{1,6}(?:\.\d{1,2})?)/i);
  if (match2) {
    const pounds = parseFloat(match2[1]);
    if (!isNaN(pounds) && pounds > 0 && pounds < 1000000) {
      return Math.round(pounds * 100);
    }
  }
  return null;
}

/**
 * Extract Egyptian phone number from text
 */
function extractPhone(text: string): string | null {
  // Match Egyptian mobile: 01XXXXXXXXX, +201XXXXXXXXX, or 201XXXXXXXXX
  const match = text.match(/(?:\+?20|0)?1[0125]\d{8}/);
  return match ? normalizePhone(match[0]) : null;
}

/**
 * Extract transaction/reference ID
 */
function extractTransactionId(text: string): string | null {
  const patterns = [
    /رقم العملية[:\s]*(\d+)/i,
    /رقم المعاملة[:\s]*(\d+)/i,
    /transaction\s*(?:id|ref|no)?[:\s]*(\d+)/i,
    /reference[:\s]*(\d+)/i,
    /رقم المرجع[:\s]*(\d+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Parse Vodafone Cash SMS message
 */
export function parseSms(rawMessage: string): ParsedSms {
  const result: ParsedSms = {
    provider: "vodafone_cash",
    amountPiasters: null,
    senderPhone: null,
    recipientWallet: null,
    transactionId: null,
    balancePiasters: null,
    occurredAt: null,
    confidence: 0,
    matchedPattern: null,
    warnings: [],
  };

  // Normalize text
  let text = normalizeNumerals(rawMessage);
  text = text.replace(/\s+/g, " ").trim();

  // Check if it's actually a Vodafone Cash / wallet transaction message
  const isWalletTransaction =
    /vodafone cash|فودافون كاش|محفظة فودافون|vodafone wallet|محفظة|حساب فودافون/i.test(text);

  // Check if it's a received/credit message
  const isReceived =
    /تم استلام|تم استقبال|استلمت|تلقيت|تم تحويل|تم إيداع|حول إليك|received|credited|transfer/i.test(text);

  if (!isReceived) {
    result.warnings.push("Not a received/credit transaction");
    result.confidence = 0;
    return result;
  }

  // Boost confidence if brand name found
  if (isWalletTransaction) {
    result.confidence += 10;
  }

  // Extract amount
  const amount = extractPiasters(text);
  if (amount) {
    result.amountPiasters = amount;
    result.confidence += 40;
  } else {
    result.warnings.push("Could not extract amount");
  }

  // Extract sender phone
  const phone = extractPhone(text);
  if (phone) {
    result.senderPhone = phone;
    result.confidence += 25;
  }

  // Extract transaction ID
  const txId = extractTransactionId(text);
  if (txId) {
    result.transactionId = txId;
    result.confidence += 20;
  }

  // Extract balance (new balance after transaction)
  const balanceMatch = text.match(/رصيدك الحالي[:\s]*([\d.]+)/i);
  if (balanceMatch) {
    const bal = parseFloat(balanceMatch[1]);
    if (!isNaN(bal)) result.balancePiasters = Math.round(bal * 100);
  }

  // Set timestamp
  result.occurredAt = new Date().toISOString();

  // Pattern detection
  if (amount && phone) result.matchedPattern = "amount_phone";
  else if (amount) result.matchedPattern = "amount_only";
  else result.matchedPattern = "partial";

  // Adjust confidence
  if (result.warnings.length === 0 && result.amountPiasters && result.transactionId) {
    result.confidence = Math.min(100, result.confidence + 15);
  }

  return result;
}

/**
 * Create a test suite of known Vodafone Cash SMS formats
 */
export const TEST_MESSAGES = [
  {
    raw: "تم استلام مبلغ 500.00 ج.م من 01012345678 عبر فودافون كاش. رقم العملية: 123456789. رصيدك الحالي: 750.50",
    expectedAmount: 50000,
    expectedPhone: "01012345678",
    expectedTxId: "123456789",
  },
  {
    raw: "استلمت ١٠٠٠.٠٠ جنيه من ٠١٢٥٥٥٥٥٥٥٥. رقم العملية ٩٨٧٦٥٤٣٢١. شكرا لاستخدامك فودافون كاش",
    expectedAmount: 100000,
    expectedPhone: "01255555555",
    expectedTxId: "987654321",
  },
  {
    raw: "Vodafone Cash: You received 250.00 EGP from 01098765432. Transaction ID: 555888. Your balance is 1200.00",
    expectedAmount: 25000,
    expectedPhone: "01098765432",
    expectedTxId: "555888",
  },
  {
    raw: "تم تحويل 75.50 جنيه إلى محفظتك من 01112222333",
    expectedAmount: 7550,
    expectedPhone: "01112222333",
    expectedTxId: null,
  },
];
