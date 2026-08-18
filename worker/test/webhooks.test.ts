import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert';
import { handleWebhookRequest } from '../src/webhooks.ts';

const mockEnv: any = {
  SMS_WEBHOOK_HMAC_SECRET: 'fixed-test-hmac-secret',
  INTERNAL_API_SECRET: 'test-internal-secret',
  CACHE: null,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function hmacHex(rawBody: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(mockEnv.SMS_WEBHOOK_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signedRequest(
  rawBody: string,
  options: { signature?: string; contentType?: string; path?: string } = {},
): Promise<Response> {
  return handleWebhookRequest(
    new Request(`https://api.zaitxmedia.com${options.path ?? '/v1/payment/sms'}`, {
      method: 'POST',
      body: rawBody,
      headers: {
        'Content-Type': options.contentType ?? 'application/json',
        'X-Signature': options.signature ?? await hmacHex(rawBody),
      },
    }),
    mockEnv,
    options.path ?? '/v1/payment/sms',
  );
}

describe('SMS Forwarder webhook', () => {
  it('returns 405 Method Not Allowed for GET /sms', async () => {
    const response = await handleWebhookRequest(
      new Request('https://api.zaitxmedia.com/v1/payment/sms'),
      mockEnv,
      '/v1/payment/sms',
    );
    assert.strictEqual(response.status, 405);
    assert.deepStrictEqual(await response.json(), {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed',
      },
    });
  });

  it('returns the required 401 response when X-Signature is missing', async () => {
    const response = await handleWebhookRequest(
      new Request('https://api.zaitxmedia.com/v1/payment/sms', {
        method: 'POST',
        body: JSON.stringify({ from: 'VF-Cash', text: 'message' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      mockEnv,
      '/v1/payment/sms',
    );
    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), {
      success: false,
      error: {
        code: 'SIGNATURE_MISSING',
        message: 'X-Signature header is required',
      },
    });
  });

  it('returns the required 401 response for a wrong hex signature', async () => {
    const rawBody = JSON.stringify({ from: 'VF-Cash', text: 'message' });
    const response = await signedRequest(rawBody, { signature: '0'.repeat(64) });
    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), {
      success: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid webhook signature',
      },
    });
  });

  it('verifies the raw body before returning INVALID_JSON', async () => {
    const response = await signedRequest('{"from":');
    assert.strictEqual(response.status, 400);
    assert.deepStrictEqual(await response.json(), {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      },
    });
  });

  it('accepts application/json with charset and a valid fixed-body hex HMAC', async () => {
    const rawBody = JSON.stringify({
      from: 'Vodafone Cash',
      text: 'not a payment rule match',
      sentStamp: '1722400000000',
      receivedStamp: 1722400000100,
      sim: 1,
      appVersion: '3.2',
      battery: '88',
      network: 'wifi',
      extraField: 'allowed',
    });
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: false, error: 'Unsupported or unparseable payment SMS' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );

    const response = await signedRequest(rawBody, {
      contentType: 'application/json; charset=utf-8',
    });
    assert.strictEqual(response.status, 200);
    const result = await response.json() as any;
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'SMS received successfully');
    assert.strictEqual(typeof result.requestId, 'string');
    assert.deepStrictEqual(result.data, { matched: false });
  });

  it('returns HTTP 200 for duplicate SMS messages', async () => {
    const rawBody = JSON.stringify({
      from: 'VF-CASH',
      text: 'تم استلام مبلغ 100 جنيه من رقم 01060795179',
    });
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: true, duplicate: true, smsId: 'sms-1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    const response = await signedRequest(rawBody);
    assert.strictEqual(response.status, 200);
    const result = await response.json() as any;
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.duplicate, true);
  });

  it('returns HTTP 200 after storing a valid payment SMS', async () => {
    const rawBody = JSON.stringify({
      from: 'VF-CASH',
      text: 'تم استلام مبلغ 100 جنيه من رقم 01060795179',
    });
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: true, duplicate: false, smsId: 'sms-2' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    const response = await signedRequest(rawBody);
    assert.strictEqual(response.status, 200);
    const result = await response.json() as any;
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'SMS received successfully');
    assert.deepStrictEqual(result.data, { matched: false });
  });

  it('requires non-empty from and text fields', async () => {
    const response = await signedRequest(JSON.stringify({ from: '', text: 'message' }));
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json() as any).error.code, 'VALIDATION_ERROR');
  });

  it('rejects non-JSON content types without strict charset comparison', async () => {
    const rawBody = JSON.stringify({ from: 'VF-CASH', text: 'message' });
    const response = await signedRequest(rawBody, {
      contentType: 'application/x-www-form-urlencoded',
    });
    assert.strictEqual(response.status, 415);
    assert.strictEqual((await response.json() as any).error.code, 'UNSUPPORTED_CONTENT_TYPE');
  });

  it('keeps gateway heartbeat behavior separate from SMS POST handling', async () => {
    const response = await handleWebhookRequest(
      new Request('https://api.zaitxmedia.com/v1/payment/gateway'),
      mockEnv,
      '/v1/payment/gateway',
    );
    assert.strictEqual(response.status, 200);
    const body = await response.json() as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'online');
    assert.ok(body.serverTime);
  });
});
