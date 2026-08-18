// Unified incoming payment event handler
// Routes SMS/notifications to appropriate parser based on content

import { parseSms as parseVodafone } from "../vodafone-cash/parser";
import { parseBarqMessage as parseBarq } from "../barq/parser";
import { parseInstaPayMessage as parseInstaPay } from "../instapay/parser";

export type PaymentProvider = "vodafone_cash" | "instapay" | "barq" | "unknown";

export interface UnifiedParseResult {
  provider: PaymentProvider;
  amountPiasters: number | null;     // EGP in piasters (all providers use EGP)
  currency: "EGP";
  senderPhone: string | null;        // Vodafone Cash
  senderNameEnglish: string | null;  // Barq  
  transactionReference: string | null; // InstaPay
  transactionId: string | null;      // Generic transaction ID
  recipient: string | null;
  occurredAt: string | null;
  confidence: number;                // 0-100
  warnings: string[];
  rawResult: any;                    // Original parser result
}

/**
 * Detect payment provider from message content
 */
function detectProvider(message: string): PaymentProvider {
  const text = message.toLowerCase();
  if (/vodafone cash|فودافون كاش|محفظة فودافون|vodafone wallet/i.test(text)) {
    return "vodafone_cash";
  }
  if (/instapay|انستاباي|انستا باي|ipa/i.test(text)) {
    return "instapay";
  }
  if (/barq|برق|stc pay/i.test(text)) {
    return "barq";
  }
  // If message has sender phone, likely Vodafone Cash
  if (/(?:\+?20)?1[0125]\d{8}/.test(message)) {
    return "vodafone_cash";
  }
  return "unknown";
}

/**
 * Parse any incoming payment SMS/notification
 */
export function parseIncomingPayment(message: string): UnifiedParseResult {
  const provider = detectProvider(message);

  let result: UnifiedParseResult = {
    provider,
    amountPiasters: null,
    currency: "EGP",
    senderPhone: null,
    senderNameEnglish: null,
    transactionReference: null,
    transactionId: null,
    recipient: null,
    occurredAt: null,
    confidence: 0,
    warnings: [],
    rawResult: null,
  };

  switch (provider) {
    case "vodafone_cash": {
      const parsed = parseVodafone(message);
      result.rawResult = parsed;
      result.amountPiasters = parsed.amountPiasters;
      result.senderPhone = parsed.senderPhone;
      result.transactionId = parsed.transactionId;
      result.confidence = parsed.confidence;
      result.warnings = parsed.warnings;
      result.occurredAt = parsed.occurredAt;
      break;
    }
    case "instapay": {
      const parsed = parseInstaPay(message);
      result.rawResult = parsed;
      result.amountPiasters = parsed.amountPiasters;
      result.transactionReference = parsed.transactionReferenceNormalized;
      result.transactionId = parsed.transactionReferenceNormalized;
      result.confidence = parsed.confidence;
      result.warnings = parsed.warnings;
      result.occurredAt = parsed.occurredAt;
      break;
    }
    case "barq": {
      const parsed = parseBarq(message);
      result.rawResult = parsed;
      result.amountPiasters = parsed.amountPiasters;
      result.senderNameEnglish = parsed.senderNameEnglish;
      result.transactionId = parsed.transactionId;
      result.confidence = parsed.confidence;
      result.warnings = parsed.warnings;
      result.occurredAt = parsed.occurredAt;
      break;
    }
    default:
      result.warnings.push("Unknown provider");
  }

  return result;
}
