// Webhook HMAC verification utility
// Constant-time comparison for timing attack prevention
// Supports raw body + timestamp signing

/**
 * Constant-time comparison of two Uint8Arrays
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to lowercase hex
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify HMAC-SHA256 signature
 *
 * Signature format: sha256=<lowercase-hex>
 * Signed payload: <timestamp>.<raw-body-bytes>
 */
export async function verifyHmacSignature(
  rawBody: ArrayBuffer,
  timestamp: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Parse signature
  const parts = signature.split("=");
  if (parts.length !== 2) return false;
  if (parts[0] !== "sha256") return false;

  const expectedHex = parts[1].toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHex)) return false;

  // Build signed payload: timestamp + "." + raw body
  const enc = new TextEncoder();
  const tsBytes = enc.encode(timestamp);
  const dotBytes = enc.encode(".");
  const bodyBytes = new Uint8Array(rawBody);

  const signedPayload = new Uint8Array(tsBytes.length + 1 + bodyBytes.length);
  signedPayload.set(tsBytes, 0);
  signedPayload.set(dotBytes, tsBytes.length);
  signedPayload.set(bodyBytes, tsBytes.length + 1);

  // Compute HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const computedSig = await crypto.subtle.sign("HMAC", key, signedPayload);
  const computedHex = bytesToHex(new Uint8Array(computedSig));

  // Constant-time comparison
  return timingSafeEqual(
    new Uint8Array(hexToBytes(computedHex)),
    new Uint8Array(hexToBytes(expectedHex))
  );
}

/**
 * Validate webhook timestamp (within 5 minutes of server time)
 */
export function validateTimestamp(timestamp: number, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= windowMs;
}

/**
 * Generate event ID
 */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Hash a message body for deduplication
 */
export async function hashMessage(message: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(message));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Build webhook signature (for client-side/sender)
 */
export async function buildSignature(
  body: string,
  timestamp: number,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const tsBytes = enc.encode(String(timestamp));
  const dotBytes = enc.encode(".");
  const bodyBytes = enc.encode(body);

  const payload = new Uint8Array(tsBytes.length + 1 + bodyBytes.length);
  payload.set(tsBytes, 0);
  payload.set(dotBytes, tsBytes.length);
  payload.set(bodyBytes, tsBytes.length + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, payload);
  return `sha256=${bytesToHex(new Uint8Array(sig))}`;
}
