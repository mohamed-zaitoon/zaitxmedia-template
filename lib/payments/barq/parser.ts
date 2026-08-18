// Barq SMS/Payment Parser
// BARQ transfers arrive in EGP (Egyptian pounds), NOT SAR
// User only submits senderNameEnglish - amount is server-calculated

import { normalizeNumerals } from "../vodafone-cash/parser";
import { parseAmountToMinorUnits } from "../../money/minor-units";

export interface BarqResult {
  provider: "barq";
  amountPiasters: number | null;
  currency: "EGP";
  senderNameEnglish: string | null;
  transactionId: string | null;
  recipient: string | null;
  occurredAt: string | null;
  confidence: number;
  warnings: string[];
}

/**
 * Normalize English person name for comparison
 * Only: trim, collapse spaces, lowercase, Unicode NFC, clean hyphens/dots
 * No translation, no reordering, no fuzzy match
 */
export function normalizeEnglishPersonName(name: string | null | undefined): string | null {
  if (!name) return null;
  let normalized = name.trim();
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.replace(/\s*([\-.])\s*/g, "$1");
  normalized = normalized.normalize("NFC");
  return normalized.toLowerCase();
}

/**
 * Compare two English names
 * Returns exact match only - no fuzzy matching for auto-verification
 */
export function compareEnglishNames(
  submitted: string | null | undefined,
  extracted: string | null | undefined
): { match: boolean; similarity: number } {
  if (!submitted || !extracted) return { match: false, similarity: 0 };
  
  const normSubmitted = normalizeEnglishPersonName(submitted);
  const normExtracted = normalizeEnglishPersonName(extracted);
  
  if (!normSubmitted || !normExtracted) return { match: false, similarity: 0 };
  
  if (normSubmitted === normExtracted) {
    return { match: true, similarity: 100 };
  }
  
  // Similarity for admin display only - NOT used for auto-verification
  const distance = levenshtein(normSubmitted, normExtracted);
  const maxLen = Math.max(normSubmitted.length, normExtracted.length);
  const similarity = Math.round((1 - distance / maxLen) * 100);
  
  return { match: false, similarity };
}

function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= a.length; i++) { m[i] = [i]; }
  for (let j = 0; j <= b.length; j++) { m[0][j] = j; }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i-1][j] + 1, m[i][j-1] + 1,
        m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
      );
    }
  }
  return m[a.length][b.length];
}

/**
 * Parse Barq transfer notification
 * Amounts are in EGP (Egyptian pounds) → converted to piasters
 */
export function parseBarqMessage(rawMessage: string): BarqResult {
  const result: BarqResult = {
    provider: "barq",
    amountPiasters: null,
    currency: "EGP",
    senderNameEnglish: null,
    transactionId: null,
    recipient: null,
    occurredAt: null,
    confidence: 0,
    warnings: [],
  };

  let text = normalizeNumerals(rawMessage);
  text = text.replace(/\s+/g, " ").trim();

  const isBarq = /barq|برق|stc pay/i.test(text);
  const isReceived = /received|credited|استلام|استقبال|استقبل|تم استلام|حول|transfer/i.test(text);
  
  if (!isReceived) {
    result.warnings.push("Not a received transfer");
    return result;
  }

  // Extract amount in EGP (prioritize matching currency suffix to avoid matching random account numbers/digits)
  let amountMatch = text.match(/(\d{1,6}(?:\.\d{1,2})?)\s*(?:ج\.م|جم|جنيه|EGP|LE)/i);
  if (!amountMatch) {
    amountMatch = text.match(/(\d{1,6}(?:\.\d{1,2})?)/);
  }
  if (amountMatch) {
    try {
      result.amountPiasters = parseAmountToMinorUnits(amountMatch[1], "EGP");
      result.confidence += 40;
    } catch {
      result.warnings.push("Could not parse amount");
    }
  } else {
    result.warnings.push("No amount found");
  }

  // Extract English sender name
  const namePatterns = [
    /from\s+([A-Za-z\s\-'.]+?)(?:\s+(?:to|with|via|on|at|\.|,|\n|$))/i,
    /من\s+([A-Za-z\s\-'.]+?)(?:\s+(?:إلى|بـ|عبر|في|\.|,|\n|$))/i,
    /([A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){1,4})/,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (/^[A-Za-z\s\-'.]{2,40}$/.test(name) && name.split(/\s+/).length >= 2) {
        result.senderNameEnglish = name;
        result.confidence += 30;
        break;
      }
    }
  }
  
  if (!result.senderNameEnglish) {
    result.warnings.push("Could not extract sender name");
  }

  // Transaction ID
  const txMatch = text.match(
    /(?:transaction|reference|ref|رقم العملية|رقم المعاملة)[:\s#]*(\w+)/i
  );
  if (txMatch) {
    result.transactionId = txMatch[1];
    result.confidence += 15;
  }

  result.occurredAt = new Date().toISOString();
  if (isBarq) result.confidence += 10;
  if (result.amountPiasters && result.senderNameEnglish) {
    result.confidence = Math.min(100, result.confidence + 5);
  }

  return result;
}

/**
 * Match Barq notification to payment intent
 * Auto-verify only if ALL conditions met
 */
export function matchBarqPayment(
  parsed: BarqResult,
  intent: {
    required_amount_piasters: number;
    submitted_sender_name_normalized: string;
    status: string;
  }
): {
  matched: boolean;
  reason?: string;
  needsReview: boolean;
} {
  if (intent.status === "verified") {
    return { matched: false, reason: "Already verified", needsReview: false };
  }
  if (intent.status === "rejected") {
    return { matched: false, reason: "Already rejected", needsReview: false };
  }

  // Amount must match
  if (!parsed.amountPiasters || parsed.amountPiasters !== intent.required_amount_piasters) {
    return {
      matched: false,
      reason: `Amount mismatch: expected ${intent.required_amount_piasters}, got ${parsed.amountPiasters}`,
      needsReview: true,
    };
  }

  // Name must match exactly after normalization
  if (!parsed.senderNameEnglish) {
    return {
      matched: false,
      reason: "No sender name in message",
      needsReview: true,
    };
  }

  const normalizedExtracted = normalizeEnglishPersonName(parsed.senderNameEnglish);
  if (normalizedExtracted !== intent.submitted_sender_name_normalized) {
    return {
      matched: false,
      reason: `Name mismatch: submitted "${intent.submitted_sender_name_normalized}", extracted "${normalizedExtracted}"`,
      needsReview: true,
    };
  }

  // All conditions met - auto-verify
  return { matched: true, needsReview: false };
}
