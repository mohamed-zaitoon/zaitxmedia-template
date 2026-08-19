import { createHmac } from "crypto";

export interface BinancePayOrderPayload {
  merchantTradeNo: string;
  orderAmount: number;
  currency: "USD";
  goods: {
    goodsType: "01" | "02";
    goodsCategory: string;
    referenceGoodsId: string;
    goodsName: string;
  };
}

export interface BinancePayWebhookPayload {
  bizType: string;
  bizId: string;
  bizStatus: string;
  merchantTradeNo: string;
  productType: string;
  productName: string;
  transactTime: number;
  totalFee: number;
  currency: string;
  openUserId?: string;
}

/**
 * Convert USD amount to integer cents (prevent floating point inaccuracies)
 */
export function usdToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * Strict amount matching in integer cents
 */
export function amountsMatchUsd(expectedAmount: number, receivedAmount: number): boolean {
  return usdToCents(expectedAmount) === usdToCents(receivedAmount);
}

/**
 * Generate 32-character random alphanumeric nonce for Binance Pay API
 */
export function generateNonce(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate Binance Pay API Signature using HMAC-SHA512 in uppercase hex
 * Payload format: timestamp + "\n" + nonce + "\n" + body + "\n"
 */
export async function calculateBinanceSignature(
  secret: string,
  timestamp: string | number,
  nonce: string,
  rawBody: string
): Promise<string> {
  const payload = `${timestamp}\n${nonce}\n${rawBody}\n`;
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    return createHmac("sha512", secret).update(payload).digest("hex").toUpperCase();
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Verify incoming Binance Pay Webhook Signature using HMAC-SHA512
 */
export async function verifyBinanceWebhookSignature(
  secret: string,
  timestamp: string | number | null,
  nonce: string | null,
  rawBody: string,
  receivedSignature: string | null
): Promise<boolean> {
  if (!secret || !timestamp || !nonce || !receivedSignature) return false;
  try {
    const expectedSignature = await calculateBinanceSignature(secret, timestamp, nonce, rawBody);
    return expectedSignature.toUpperCase() === receivedSignature.trim().toUpperCase();
  } catch (error) {
    console.error("Binance webhook signature verification failed:", error);
    return false;
  }
}

/**
 * Map Binance Pay official status to internal deposit status
 */
export function mapBinanceStatusToInternal(binanceStatus: string): "pending" | "confirmed" | "failed" | "expired" | "manual_review" {
  const status = String(binanceStatus || "").toUpperCase().trim();
  switch (status) {
    case "PAID":
    case "SUCCESS":
      return "confirmed";
    case "INITIAL":
    case "PENDING":
    case "PROCESSING":
      return "pending";
    case "EXPIRED":
      return "expired";
    case "CANCELED":
    case "ERROR":
    case "FAILED":
    case "REFUNDED":
      return "failed";
    default:
      return "manual_review";
  }
}

export interface ParsedBinanceSms {
  merchantTradeNo: string | null;
  amountUsd: number | null;
  currency: string;
}

/**
 * Parse incoming SMS text from Binance Pay via SMS Forwarder app
 */
export function parseBinanceSms(text: string): ParsedBinanceSms {
  if (!text) return { merchantTradeNo: null, amountUsd: null, currency: "USD" };

  // 1. Extract merchantTradeNo / Order ID (e.g. 288655487944237057 or BP_123456789_abcdef)
  const tradeNoMatch = text.match(/(BP_[\w]+|order\s*id[\s:\n]*([\w]+)|transaction\s*id[\s:\n]*([\w]+)|طلب[\s:\n]*([\w]+))/i);
  let merchantTradeNo: string | null = null;
  if (tradeNoMatch) {
    if (tradeNoMatch[1].startsWith("BP_")) {
      merchantTradeNo = tradeNoMatch[1];
    } else {
      merchantTradeNo = tradeNoMatch[2] || tradeNoMatch[3] || tradeNoMatch[4] || null;
    }
  }

  // 2. Extract Amount (e.g. +3 USDT, 3.00 USD, $10.00, or Amount\n+3\nUSDT)
  const usdMatch = text.match(/(?:amount[\s:\n]*)?\+?\s*(\d+(?:\.\d{1,2})?)\s*(?:USD|USDT|\$)?/i);
  let amountUsd: number | null = null;
  if (usdMatch) {
    const val = parseFloat(usdMatch[1]);
    if (Number.isFinite(val) && val > 0) amountUsd = val;
  }

  return {
    merchantTradeNo,
    amountUsd,
    currency: "USD",
  };
}
