import assert from 'node:assert/strict';
import test from 'node:test';
import {
  signWebhook,
  verifyWebhookRequest,
  WebhookSecurityError,
  type ReplayStore,
} from '../src/webhook-security.ts';

const secret = 'test-only-secret-not-for-production';
const nowMs = Date.UTC(2026, 6, 23, 12, 0, 0);
const timestamp = Math.floor(nowMs / 1000);

class MemoryReplayStore implements ReplayStore {
  readonly events = new Map<string, string>();
  async has(eventId: string) {
    return this.events.has(eventId);
  }
  async record(eventId: string, _timestamp: number, bodyHash: string) {
    if (this.events.has(eventId)) throw new Error('duplicate');
    this.events.set(eventId, bodyHash);
  }
}

async function request(
  body: string,
  overrides: Record<string, string | null> = {}
): Promise<Request> {
  const signature = await signWebhook(secret, timestamp, body);
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Timestamp': String(timestamp),
    'X-Webhook-Event-Id': 'evt_test_123',
  });
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return new Request('https://example.test/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof WebhookSecurityError);
    assert.equal(err.code, code);
    return true;
  });
}

test('accepts a valid signature', async () => {
  const verified = await verifyWebhookRequest(
    await request('{"ok":true}'),
    secret,
    new MemoryReplayStore(),
    { nowMs }
  );
  assert.equal(verified.eventId, 'evt_test_123');
  assert.equal(verified.rawBody, '{"ok":true}');
});

test('rejects an invalid signature', async () => {
  await expectCode(
    verifyWebhookRequest(
      await request('{"ok":true}', {
        'X-Webhook-Signature': `sha256=${'00'.repeat(32)}`,
      }),
      secret,
      new MemoryReplayStore(),
      { nowMs }
    ),
    'INVALID_WEBHOOK_SIGNATURE'
  );
});

test('rejects a stale timestamp', async () => {
  const oldTimestamp = timestamp - 301;
  const body = '{"ok":true}';
  const oldSignature = await signWebhook(secret, oldTimestamp, body);
  await expectCode(
    verifyWebhookRequest(
      await request(body, {
        'X-Webhook-Timestamp': String(oldTimestamp),
        'X-Webhook-Signature': `sha256=${oldSignature}`,
      }),
      secret,
      new MemoryReplayStore(),
      { nowMs }
    ),
    'STALE_WEBHOOK'
  );
});

test('rejects replay of the same event', async () => {
  const store = new MemoryReplayStore();
  await verifyWebhookRequest(await request('{"ok":true}'), secret, store, { nowMs });
  await expectCode(
    verifyWebhookRequest(await request('{"ok":true}'), secret, store, { nowMs }),
    'DUPLICATE_WEBHOOK_EVENT'
  );
});

test('rejects a modified body', async () => {
  const original = '{"amount":100}';
  const signature = await signWebhook(secret, timestamp, original);
  await expectCode(
    verifyWebhookRequest(
      await request('{"amount":1}', {
        'X-Webhook-Signature': `sha256=${signature}`,
      }),
      secret,
      new MemoryReplayStore(),
      { nowMs }
    ),
    'INVALID_WEBHOOK_SIGNATURE'
  );
});

test('rejects a missing header', async () => {
  await expectCode(
    verifyWebhookRequest(
      await request('{"ok":true}', { 'X-Webhook-Event-Id': null }),
      secret,
      new MemoryReplayStore(),
      { nowMs }
    ),
    'MISSING_WEBHOOK_HEADERS'
  );
});

test('rejects a duplicated event id even with a different valid body', async () => {
  const store = new MemoryReplayStore();
  await verifyWebhookRequest(await request('{"version":1}'), secret, store, { nowMs });
  await expectCode(
    verifyWebhookRequest(await request('{"version":2}'), secret, store, { nowMs }),
    'DUPLICATE_WEBHOOK_EVENT'
  );
});
