import { parseBarqMessage } from "./barq/parser";
import { parseInstaPayMessage, normalizeInstaPayReference } from "./instapay/parser";
import { normalizeEnglishPersonName } from "./barq/parser";
import { normalizePhone, parseSms as parseVodafoneSms, normalizeNumerals } from "./vodafone-cash/parser";

export type SmsProvider = "vodafone" | "instapay" | "barq" | "bank";

export interface ParsedPaymentSms {
  provider: SmsProvider;
  amountMinor: number | null;
  payerPhone: string | null;
  payerName: string | null;
  reference: string | null;
  confidence: number;
}

export function normalizeForwarderTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).trim());
  let timestamp = Number.isFinite(numeric)
    ? numeric
    : Date.parse(String(value));
  if (!Number.isFinite(timestamp)) return null;
  if (timestamp > 0 && timestamp < 100_000_000_000) timestamp *= 1000;
  const earliestAccepted = Date.UTC(2000, 0, 1);
  const latestAccepted = Date.now() + 24 * 60 * 60 * 1000;
  return timestamp >= earliestAccepted && timestamp <= latestAccepted
    ? Math.trunc(timestamp)
    : null;
}

export function paymentSmsIsNewer(
  candidate: Record<string, unknown>,
  current: Record<string, unknown>,
): boolean {
  const candidateSourceTime = normalizeForwarderTimestamp(candidate.sourceReceivedAtMillis);
  const currentSourceTime = normalizeForwarderTimestamp(current.sourceReceivedAtMillis);
  if (candidateSourceTime !== null && currentSourceTime !== null) {
    if (candidateSourceTime !== currentSourceTime) {
      return candidateSourceTime > currentSourceTime;
    }
  } else if (candidateSourceTime !== null) {
    return true;
  } else if (currentSourceTime !== null) {
    return false;
  }

  const candidateStoredTime = normalizeForwarderTimestamp(candidate.storedAtMillis);
  const currentStoredTime = normalizeForwarderTimestamp(current.storedAtMillis);
  return candidateStoredTime !== null &&
    (currentStoredTime === null || candidateStoredTime > currentStoredTime);
}

function normalizedSender(sender: unknown): string {
  return String(sender ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parsePaymentSms(sender: unknown, message: unknown): ParsedPaymentSms | null {
  const cleanSender = normalizedSender(sender);
  let text = String(message ?? "").normalize("NFKC").trim();
  if (!text) return null;
  text = normalizeNumerals(text);

  const isInstaPay = /insta\s*pay|انستا\s*باي|instapay|ipn|mashreq/.test(`${cleanSender} ${text}`.toLowerCase());
  const isBarq = /(?:^|\s)barq(?:\s|$)|برق|stc\s*pay/.test(`${cleanSender} ${text}`.toLowerCase()) ||
                 (cleanSender.includes("vf") && (text.includes("من ؛") || text.includes("من ;") || !/(?:من|من\s+رقم)\s*\d+/i.test(text)));

  if (isInstaPay) {
    const parsed = parseInstaPayMessage(text);
    return {
      provider: "instapay",
      amountMinor: parsed.amountPiasters,
      payerPhone: null,
      payerName: null,
      reference: parsed.transactionReferenceNormalized,
      confidence: parsed.confidence,
    };
  }

  if (isBarq) {
    const parsed = parseBarqMessage(text);
    return {
      provider: "barq",
      amountMinor: parsed.amountPiasters,
      payerPhone: null,
      payerName: normalizeEnglishPersonName(parsed.senderNameEnglish),
      reference: parsed.transactionId,
      confidence: parsed.confidence,
    };
  }

  // Wallet-forwarder apps use several sender labels (VF-CASH, Vodafone Cash,
  // vCash). Treat any remaining received wallet message as Vodafone Cash.
  const parsed = parseVodafoneSms(text);
  return {
    provider: "vodafone",
    amountMinor: parsed.amountPiasters,
    payerPhone: normalizePhone(parsed.senderPhone),
    payerName: null,
    reference: parsed.transactionId,
    confidence: parsed.confidence,
  };
}

export function normalizeSubmittedReference(provider: SmsProvider, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (provider === "vodafone") return normalizePhone(trimmed) || trimmed;
  if (provider === "instapay") return normalizeInstaPayReference(trimmed) || trimmed;
  if (provider === "bank") return trimmed;
  return normalizeEnglishPersonName(trimmed) || trimmed;
}

export function paymentSmsMatchesOrder(
  sms: ParsedPaymentSms,
  order: Record<string, unknown>,
): boolean {
  if (order.paymentStatus !== "verifying") return false;
  if (Number(order.expectedPaymentAmountMinor) !== sms.amountMinor) return false;
  if (order.paymentMethodKey !== sms.provider) return false;

  if (sms.provider === "vodafone") {
    return Boolean(sms.payerPhone) && normalizePhone(String(order.payerPhoneNormalized ?? "")) === sms.payerPhone;
  }
  if (sms.provider === "instapay") {
    return Boolean(sms.reference) &&
      normalizeInstaPayReference(String(order.originalReference ?? "")) === sms.reference;
  }
  return Boolean(sms.payerName) &&
    normalizeEnglishPersonName(String(order.payerNameNormalized ?? "")) === sms.payerName;
}
