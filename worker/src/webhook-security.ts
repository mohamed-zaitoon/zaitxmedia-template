const encoder = new TextEncoder();
const DEFAULT_MAX_AGE_SECONDS = 300;

export type WebhookSecurityCode =
  | 'MISSING_WEBHOOK_HEADERS'
  | 'INVALID_WEBHOOK_TIMESTAMP'
  | 'STALE_WEBHOOK'
  | 'INVALID_WEBHOOK_SIGNATURE'
  | 'DUPLICATE_WEBHOOK_EVENT';

export class WebhookSecurityError extends Error {
  readonly code: WebhookSecurityCode;
  readonly status: number;

  constructor(code: WebhookSecurityCode, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export interface ReplayStore {
  has(eventId: string): Promise<boolean>;
  record(eventId: string, timestamp: number, bodyHash: string): Promise<void>;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function sha256(value: string): Promise<string> {
  return hex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
  );
}

export async function signWebhook(
  secret: string,
  timestamp: number,
  rawBody: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${rawBody}`)
  );
  return hex(new Uint8Array(signature));
}

export async function verifyWebhookRequest(
  request: Request,
  secret: string,
  replayStore: ReplayStore,
  options: { nowMs?: number; maxAgeSeconds?: number } = {}
): Promise<{ rawBody: string; eventId: string; timestamp: number; bodyHash: string }> {
  const signatureHeader = request.headers.get('X-Webhook-Signature');
  const timestampHeader = request.headers.get('X-Webhook-Timestamp');
  const eventId = request.headers.get('X-Webhook-Event-Id')?.trim();

  if (!signatureHeader || !timestampHeader || !eventId) {
    throw new WebhookSecurityError('MISSING_WEBHOOK_HEADERS', 401);
  }
  if (eventId.length < 8 || eventId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(eventId)) {
    throw new WebhookSecurityError('MISSING_WEBHOOK_HEADERS', 401);
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    throw new WebhookSecurityError('INVALID_WEBHOOK_TIMESTAMP', 401);
  }

  const nowMs = options.nowMs ?? Date.now();
  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > maxAgeSeconds) {
    throw new WebhookSecurityError('STALE_WEBHOOK', 401);
  }

  const rawBody = await request.text();
  const suppliedHex = signatureHeader.replace(/^sha256=/i, '');
  const supplied = decodeHex(suppliedHex);
  const expected = decodeHex(await signWebhook(secret, timestamp, rawBody));
  if (!supplied || !expected || !constantTimeEqual(supplied, expected)) {
    throw new WebhookSecurityError('INVALID_WEBHOOK_SIGNATURE', 401);
  }

  if (await replayStore.has(eventId)) {
    throw new WebhookSecurityError('DUPLICATE_WEBHOOK_EVENT', 409);
  }

  const bodyHash = await sha256(rawBody);
  try {
    await replayStore.record(eventId, timestamp, bodyHash);
  } catch {
    throw new WebhookSecurityError('DUPLICATE_WEBHOOK_EVENT', 409);
  }
  return { rawBody, eventId, timestamp, bodyHash };
}

export class D1WebhookReplayStore implements ReplayStore {
  private readonly db: D1Database;
  private readonly source: string;

  constructor(db: D1Database, source: string) {
    this.db = db;
    this.source = source;
  }

  async has(eventId: string): Promise<boolean> {
    const existing = await this.db
      .prepare('SELECT event_id FROM webhook_events WHERE event_id = ? LIMIT 1')
      .bind(eventId)
      .first();
    return Boolean(existing);
  }

  async record(eventId: string, timestamp: number, bodyHash: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO webhook_events (
          event_id, source, request_timestamp, body_hash, status, created_at
        ) VALUES (?, ?, ?, ?, 'verified', datetime('now'))`
      )
      .bind(eventId, this.source, timestamp, bodyHash)
      .run();
  }
}
