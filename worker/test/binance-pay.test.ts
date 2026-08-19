import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleBinancePayRequest } from '../src/binance-pay';
import { calculateBinanceSignature } from '../../lib/payments/binance-pay';

class MockD1PreparedStatement {
  constructor(private sql: string, private params: any[] = []) {}

  bind(...params: any[]) {
    return new MockD1PreparedStatement(this.sql, params);
  }

  async run() {
    return { success: true, meta: { changes: 1 } };
  }

  async first<T = any>(): Promise<T | null> {
    if (this.sql.includes('SELECT * FROM orders')) {
      const param = this.params[0];
      if (param === 'BP_EXPIRED') {
        return {
          id: 'dep_expired',
          user_id: 'usr_1',
          price: 10.0,
          currency: 'USD',
          proof_of_payment: 'BP_EXPIRED',
          status: 'expired',
        } as any;
      }
      if (param === 'BP_PAID_ALREADY') {
        return {
          id: 'dep_paid',
          user_id: 'usr_1',
          price: 10.0,
          currency: 'USD',
          proof_of_payment: 'BP_PAID_ALREADY',
          status: 'completed',
        } as any;
      }
      if (param === 'BP_MATCH_10') {
        return {
          id: 'dep_10',
          user_id: 'usr_1',
          price: 10.0,
          currency: 'USD',
          proof_of_payment: 'BP_MATCH_10',
          status: 'pending',
        } as any;
      }
    }
    return null;
  }
}

class MockD1Database {
  prepare(sql: string) {
    return new MockD1PreparedStatement(sql);
  }
  async batch(statements: any[]) {
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  }
}

const mockEnv: any = {
  DB: new MockD1Database(),
  BINANCE_PAY_API_KEY: 'test_api_key',
  BINANCE_PAY_SECRET: 'EUMfltGGORHNPQ8IG0OhhYuwJps9gGZteVAUuikjIDftFNzlAjFWOpdIvhwJBICV',
  BINANCE_PAY_RECIPIENT_ID: '405960486',
};

test('GET request to /v1/payment/binance-pay returns 405 Method Not Allowed', async () => {
  const req = new Request('https://api.zaitxmedia.com/v1/payment/binance-pay/create', {
    method: 'GET',
  });
  const res = await handleBinancePayRequest(req, mockEnv, '/v1/payment/binance-pay/create');
  assert.equal(res.status, 405);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error.code, 'METHOD_NOT_ALLOWED');
});

test('Webhook with invalid signature returns 401 Unauthorized', async () => {
  const body = JSON.stringify({
    merchantTradeNo: 'BP_MATCH_10',
    totalFee: 10.0,
    currency: 'USD',
    status: 'PAID',
  });
  const req = new Request('https://api.zaitxmedia.com/v1/payment/binance-pay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': String(Date.now()),
      'BinancePay-Nonce': '12345678901234567890123456789012',
      'BinancePay-Signature': 'INVALID_SIG',
    },
    body,
  });

  const res = await handleBinancePayRequest(req, mockEnv, '/v1/payment/binance-pay/webhook');
  assert.equal(res.status, 401);
});

test('Valid signed webhook confirms deposit (Expected 10.00 USD, Received 10.00 USD)', async () => {
  const timestamp = Date.now();
  const nonce = '12345678901234567890123456789012';
  const body = JSON.stringify({
    merchantTradeNo: 'BP_MATCH_10',
    totalFee: 10.0,
    currency: 'USD',
    bizStatus: 'PAID',
  });
  const sig = await calculateBinanceSignature(mockEnv.BINANCE_PAY_SECRET, timestamp, nonce, body);

  const req = new Request('https://api.zaitxmedia.com/v1/payment/binance-pay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': String(timestamp),
      'BinancePay-Nonce': nonce,
      'BinancePay-Signature': sig,
    },
    body,
  });

  const res = await handleBinancePayRequest(req, mockEnv, '/v1/payment/binance-pay/webhook');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'confirmed');
});

test('Webhook with amount mismatch (Expected 10.00 USD, Received 9.99 USD) sets status to manual_review', async () => {
  const timestamp = Date.now();
  const nonce = '12345678901234567890123456789012';
  const body = JSON.stringify({
    merchantTradeNo: 'BP_MATCH_10',
    totalFee: 9.99, // Mismatch!
    currency: 'USD',
    bizStatus: 'PAID',
  });
  const sig = await calculateBinanceSignature(mockEnv.BINANCE_PAY_SECRET, timestamp, nonce, body);

  const req = new Request('https://api.zaitxmedia.com/v1/payment/binance-pay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': String(timestamp),
      'BinancePay-Nonce': nonce,
      'BinancePay-Signature': sig,
    },
    body,
  });

  const res = await handleBinancePayRequest(req, mockEnv, '/v1/payment/binance-pay/webhook');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'manual_review');
  assert.equal(data.reason, 'AMOUNT_MISMATCH');
});

test('Duplicate webhook delivery (Idempotency) does not double credit balance', async () => {
  const timestamp = Date.now();
  const nonce = '12345678901234567890123456789012';
  const body = JSON.stringify({
    merchantTradeNo: 'BP_PAID_ALREADY',
    totalFee: 10.0,
    currency: 'USD',
    bizStatus: 'PAID',
  });
  const sig = await calculateBinanceSignature(mockEnv.BINANCE_PAY_SECRET, timestamp, nonce, body);

  const req = new Request('https://api.zaitxmedia.com/v1/payment/binance-pay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': String(timestamp),
      'BinancePay-Nonce': nonce,
      'BinancePay-Signature': sig,
    },
    body,
  });

  const res = await handleBinancePayRequest(req, mockEnv, '/v1/payment/binance-pay/webhook');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.idempotency, true);
});
