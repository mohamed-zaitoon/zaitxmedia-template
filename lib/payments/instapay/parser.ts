// InstaPay Parser
// Verification based on Ref# (transaction reference)
// User only submits reference - amount is server-calculated

import { normalizeNumerals } from "../vodafone-cash/parser";
import { parseAmountToMinorUnits } from "../../money/minor-units";

export interface InstaPayResult {
  provider: "instapay";
  amountPiasters: number | null;
  currency: "EGP";
  transactionReferenceRaw: string | null;
  transactionReferenceNormalized: string | null;
  senderName: string | null;
  recipient: string | null;
  occurredAt: string | null;
  confidence: number;
  warnings: string[];
}

/**
 * Normalize InstaPay reference for comparison
 * - NFKC Unicode normalization
 * - trim
 * - Arabic→English numerals
 * - Remove Ref/Reference prefix (#, :, -)
 * - Remove extra spaces
 * - Uppercase English letters
 */
export function normalizeInstaPayReference(value: string): string {
  let ref = value.normalize("NFKC");
  ref = normalizeNumerals(ref);
  ref = ref.trim();

  // Remove prefix: Ref#, Ref #, Ref:, Reference#, Reference #, etc.
  ref = ref.replace(/^(?:ref(?:erence)?)\s*[#:\-\s]*\s*/i, "");

  // Remove extra internal spaces
  ref = ref.replace(/\s+/g, "");

  // Uppercase
  ref = ref.toUpperCase();

  return ref;
}

/**
 * Validate reference format
 * Accepts: alphanumeric, hyphens, underscores, dots, forward slashes
 * Length: 4-64 characters
 */
export function validateReference(ref: string): { valid: boolean; normalized?: string; error?: string } {
  const normalized = normalizeInstaPayReference(ref);
  if (!normalized) return { valid: false, error: "المرجع فارغ" };
  if (normalized.length < 4) return { valid: false, error: "المرجع قصير جداً (أقل من 4 أحرف)" };
  if (normalized.length > 64) return { valid: false, error: "المرجع طويل جداً" };
  if (!/^[A-Z0-9\-_./@]+$/.test(normalized)) return { valid: false, error: "المرجع يحتوي رموزاً غير مسموحة" };
  return { valid: true, normalized };
}

/**
 * Extract transaction reference from message text
 */
function extractRef(message: string): string | null {
  const patterns = [
    /(?:ref(?:erence)?)\s*[#:\-\s]*\s*([A-Za-z0-9\-_./]{4,64})/i,
    /رقم المرجع\s*[#:\-\s]*\s*([A-Za-z0-9\-_./]{4,64})/i,
    /رقم العملية\s*[#:\-\s]*\s*([A-Za-z0-9\-_./]{4,64})/i,
    /(?:رقم المرجع|رقم المعاملة)\s*[#:\-\s]*\s*([A-Za-z0-9\-_./]{4,64})/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const ref = match[1].trim();
      if (ref.length >= 4 && ref.length <= 64) return ref;
    }
  }
  return null;
}

/**
 * Parse InstaPay transfer notification
 */
export function parseInstaPayMessage(rawMessage: string): InstaPayResult {
  const result: InstaPayResult = {
    provider: "instapay",
    amountPiasters: null,
    currency: "EGP",
    transactionReferenceRaw: null,
    transactionReferenceNormalized: null,
    senderName: null,
    recipient: null,
    occurredAt: null,
    confidence: 0,
    warnings: [],
  };

  let text = normalizeNumerals(rawMessage);
  text = text.replace(/\s+/g, " ").trim();

  const isInstaPay = /instapay|انستاباي|انستا باي|ipn|mashreq/i.test(text);
  const isReceived = /received|credited|استلام|استقبال|استقبل|تم استلام|تم تحويل|حول/i.test(text);

  if (!isReceived) {
    result.warnings.push("Not a received transfer");
    return result;
  }

  // Extract Ref#
  const ref = extractRef(text);
  if (ref) {
    result.transactionReferenceRaw = ref;
    result.transactionReferenceNormalized = normalizeInstaPayReference(ref);
    result.confidence += 40;
  } else {
    result.warnings.push("No reference number found");
  }

  // Extract amount in EGP (prioritize matching currency suffix to avoid matching random account numbers/digits)
  let amountMatch = text.match(/(\d{1,6}(?:\.\d{1,2})?)\s*(?:ج\.م|جم|جنيه|EGP|LE)/i);
  if (!amountMatch) {
    amountMatch = text.match(/(\d{1,6}(?:\.\d{1,2})?)/);
  }
  if (amountMatch) {
    try {
      result.amountPiasters = parseAmountToMinorUnits(amountMatch[1], "EGP");
      result.confidence += 35;
    } catch {
      result.warnings.push("Could not parse amount");
    }
  } else {
    result.warnings.push("No amount found");
  }

  result.occurredAt = new Date().toISOString();
  if (isInstaPay) result.confidence += 10;
  if (result.transactionReferenceNormalized && result.amountPiasters) {
    result.confidence = Math.min(100, result.confidence + 5);
  }

  return result;
}

/**
 * Match InstaPay notification to payment intent
 * Auto-verify only if ALL conditions met
 */
export function matchInstaPayPayment(
  parsed: InstaPayResult,
  intent: {
    required_amount_piasters: number;
    submitted_reference_normalized: string;
    status: string;
  }
): { matched: boolean; reason?: string; needsReview: boolean } {
  if (intent.status === "verified") {
    return { matched: false, reason: "Already verified", needsReview: false };
  }

  // Amount must match exactly
  if (!parsed.amountPiasters || parsed.amountPiasters !== intent.required_amount_piasters) {
    return {
      matched: false,
      reason: `Amount mismatch: expected ${intent.required_amount_piasters}, got ${parsed.amountPiasters}`,
      needsReview: true,
    };
  }

  // Reference must match exactly after normalization
  if (!parsed.transactionReferenceNormalized) {
    return {
      matched: false,
      reason: "No reference in message",
      needsReview: true,
    };
  }

  if (parsed.transactionReferenceNormalized !== intent.submitted_reference_normalized) {
    return {
      matched: false,
      reason: `Reference mismatch: submitted "${intent.submitted_reference_normalized}", extracted "${parsed.transactionReferenceNormalized}"`,
      needsReview: true,
    };
  }

  // All conditions met
  return { matched: true, needsReview: false };
}
