import {
  json,
  error,
  generateId,
  hashToken,
  checkRateLimit,
  getClientIp,
  createAuditLog,
} from './utils';
import { Env } from './types';
import {
  D1WebhookReplayStore,
  verifyWebhookRequest,
  WebhookSecurityError,
} from './webhook-security';

type SmsSignatureFormat = 'hex' | 'base64' | 'unknown';

function detectSmsSignatureFormat(signature: string): SmsSignatureFormat {
  if (/^[0-9a-fA-F]{64}$/.test(signature)) return 'hex';
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature) || signature.length % 4 !== 0) {
    return 'unknown';
  }
  try {
    return Uint8Array.from(atob(signature), character => character.charCodeAt(0)).length === 32
      ? 'base64'
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

function decodeSmsSignature(signature: string, format: SmsSignatureFormat): Uint8Array | null {
  if (format === 'hex') {
    return Uint8Array.from(signature.match(/.{2}/g) || [], byte => parseInt(byte, 16));
  }
  if (format === 'base64') {
    try {
      return Uint8Array.from(atob(signature), character => character.charCodeAt(0));
    } catch {
      return null;
    }
  }
  return null;
}

function timingSafeBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  const maximumLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maximumLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function calculateSmsHmac(secret: string, rawBody: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)));
}

export async function handleWebhookRequest(
  request: Request,
  env: Env,
  path: string,
  ctx?: ExecutionContext
): Promise<Response> {
  let normalizedPath = path.replace(/\/$/, '');

  // The Android gateway may use the same configured URL for both its
  // connectivity test (GET) and SMS delivery (POST).
  if (
    normalizedPath === '/v1/payment/gateway' ||
    normalizedPath === '/payment/gateway' ||
    normalizedPath === '/v1/payment/geteway' ||
    normalizedPath === '/payment/geteway'
  ) {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return new Response(
        request.method === 'HEAD' ? null : JSON.stringify({
          success: true,
          status: 'online',
          serverTime: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          }
        }
      );
    }

    // Treat authenticated POST requests as SMS webhook deliveries.
    const gatewayUrl = new URL(request.url);
    const hasDeliveryCredentials =
      Boolean(gatewayUrl.searchParams.get('token')) ||
      request.headers.has('Authorization') ||
      request.headers.has('X-Signature') ||
      request.headers.has('X-Hub-Signature-256');

    if (request.method === 'POST' && hasDeliveryCredentials) {
      normalizedPath = '/v1/payment/sms';
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only GET and HEAD requests are allowed for gateway',
          },
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Allow': 'GET, HEAD',
          },
        }
      );
    }
  }

  // Handle incoming SMS webhook
  if (normalizedPath === '/v1/payment/sms' || normalizedPath === '/payment/sms') {
    // Some Android SMS gateway apps verify the destination with a GET request
    // before they allow the webhook to be saved. This is only a connectivity
    // check; actual SMS payloads still require a signed POST request below.
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only POST requests are allowed',
          },
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Allow': 'POST',
          },
        }
      );
    }

    const requestId = crypto.randomUUID();
    const contentType = request.headers.get('content-type') || '';
    const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
    const rawSignature = request.headers.get('X-Signature');

    // 1. Enforce content-type application/json
    if (mediaType !== 'application/json') {
      return json({
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT_TYPE',
          message: 'Unsupported Content-Type',
        },
      }, 415, {}, request);
    }

    // 2. Enforce X-Signature presence
    if (!rawSignature) {
      return json({
        success: false,
        error: {
          code: 'SIGNATURE_MISSING',
          message: 'X-Signature header is required',
        },
      }, 401, {}, request);
    }

    const signatureFormat = detectSmsSignatureFormat(rawSignature);
    console.log(JSON.stringify({
      event: 'sms_webhook_received',
      requestId,
      method: request.method,
      contentType,
      signaturePresent: Boolean(rawSignature),
      signatureLength: rawSignature?.length ?? 0,
      signatureFormat,
    }));

    try {
      const rawBody = await request.text();
      const rawBodyLength = new TextEncoder().encode(rawBody).length;
      console.log(JSON.stringify({ event: 'sms_webhook_body_read', requestId, rawBodyLength }));

      if (rawBodyLength > 32768) {
        console.warn(JSON.stringify({ event: 'sms_webhook_rejected', requestId, reason: 'PAYLOAD_TOO_LARGE' }));
        return json({
          success: false,
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
        }, 413, {}, request);
      }

      // 3. Enforce HMAC X-Signature check
      const secretToMatch = env.SMS_WEBHOOK_HMAC_SECRET || env.PROVIDER_WEBHOOK_HMAC_SECRET || '';
      let isAuthenticated = false;
      if (secretToMatch) {
        const receivedSignature = decodeSmsSignature(rawSignature, signatureFormat);
        const expectedSignature = await calculateSmsHmac(secretToMatch, rawBody);
        if (receivedSignature && timingSafeBytesEqual(receivedSignature, expectedSignature)) {
          isAuthenticated = true;
        }
      } else {
        // Fallback: if no secret configured
        isAuthenticated = true;
      }

      if (!isAuthenticated) {
        console.warn(JSON.stringify({ event: 'sms_webhook_rejected', requestId, reason: 'AUTHENTICATION_FAILED' }));
        return json({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature',
          },
        }, 401, {}, request);
      }

      // 4. Verify JSON syntax of body
      let normalizedPayload: Record<string, unknown> = {};
      if (rawBodyLength > 0) {
        try {
          const parsed = JSON.parse(rawBody);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            normalizedPayload = parsed as Record<string, unknown>;
          } else {
            throw new Error('Not an object');
          }
        } catch {
          return json({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON',
            },
          }, 400, {}, request);
        }
      }

      const normalizedSender = String(
        normalizedPayload.from ??
        normalizedPayload.sender ??
        normalizedPayload.address ??
        normalizedPayload.phone ??
        normalizedPayload.number ??
        normalizedPayload.origin ??
        ''
      ).trim();

      const normalizedMessage = String(
        normalizedPayload.text ??
        normalizedPayload.message ??
        normalizedPayload.body ??
        normalizedPayload.sms ??
        normalizedPayload.content ??
        ''
      ).trim();

      if (!normalizedSender || !normalizedMessage) {
        console.warn(JSON.stringify({
          event: 'sms_webhook_rejected',
          requestId,
          reason: 'VALIDATION_ERROR',
        }));
        return json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Sender and message body are required',
          },
        }, 400);
      }

      const normalizedBody = JSON.stringify({
        ...normalizedPayload,
        from: normalizedSender,
        text: normalizedMessage,
      });

      // Forward to Next.js API to store and check duplicates
      const targetUrl = `https://zaitxmedia.com/api/internal/payment/sms_store`;
      const storeResponse = await fetch(targetUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-internal-secret': env.INTERNAL_API_SECRET || 'dev_secret_fallback',
         },
         body: normalizedBody
      });
      
      console.log(JSON.stringify({
        event: 'sms_webhook_store_response',
        requestId,
        status: storeResponse.status,
      }));

      if (!storeResponse.ok) {
         if (storeResponse.status === 400) {
            console.log(JSON.stringify({
              event: 'sms_webhook_unmatched',
              requestId,
              reason: 'PAYMENT_RULES_NOT_MATCHED',
            }));
            return json({
              success: true,
              message: 'SMS received successfully',
              requestId,
              data: { matched: false },
            });
         }
         console.error(JSON.stringify({
           event: 'sms_webhook_store_failed',
           requestId,
           reason: 'INTERNAL_STORE_ERROR',
           status: storeResponse.status,
         }));
         return json({
           success: false,
           error: {
             code: 'SMS_STORE_FAILED',
             message: 'Failed to store SMS internally',
           },
         }, 500);
      }

      const storeResult: any = await storeResponse.json();

      if (storeResult.duplicate) {
         console.log(JSON.stringify({ event: 'sms_webhook_duplicate', requestId }));
         return json({
           success: true,
           message: 'SMS received successfully',
           requestId,
           duplicate: true,
           data: { matched: Boolean(storeResult.matched) },
         });
      }

      // Schedule atomic matching after 5 seconds
      if (ctx && storeResult.smsId) {
         const delaySeconds = parseInt(env.PAYMENT_VERIFICATION_DELAY_SECONDS || '1', 10);
         ctx.waitUntil((async () => {
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            await fetch(`https://zaitxmedia.com/api/internal/payment/sms_match`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-internal-secret': env.INTERNAL_API_SECRET || 'dev_secret_fallback',
               },
               body: JSON.stringify({ smsId: storeResult.smsId })
            }).catch(() => console.error(JSON.stringify({
              event: 'sms_webhook_match_failed',
              requestId,
              reason: 'DELAYED_MATCH_REQUEST_FAILED',
            })));
         })());
      }

      console.log(JSON.stringify({ event: 'sms_webhook_stored', requestId, matched: Boolean(storeResult.matched) }));
      return json({
        success: true,
        message: 'SMS received successfully',
        requestId,
        data: { matched: Boolean(storeResult.matched) },
      });
    } catch {
      console.error(JSON.stringify({
        event: 'sms_webhook_failed',
        requestId,
        reason: 'UNEXPECTED_INTERNAL_ERROR',
      }));
      return json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        500
      );
    }
  }

  // Proxy legacy V1 payment routes to Next.js
  if (normalizedPath.startsWith('/v1/payment/')) {
    const targetUrl = `https://zaitxmedia.com/api${path}`;
    return fetch(new Request(targetUrl, { method: request.method, headers: request.headers, body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined }));
  }

  if (request.method !== 'POST') {
    return error('NOT_FOUND', 'Webhook endpoint not found', 404);
  }

  const source =
    path === '/api/webhook/payment-sms'
      ? 'payment-sms'
      : path === '/api/webhook/provider'
        ? 'provider'
        : null;
  if (!source) return error('NOT_FOUND', 'Webhook endpoint not found', 404);

  const allowed = await checkRateLimit(
    env.CACHE,
    getClientIp(request),
    `webhook:${source}`,
    { windowSeconds: 60, maxRequests: 30 }
  );
  if (!allowed) return error('RATE_LIMITED', 'Webhook request rejected', 429);

  const secret =
    source === 'payment-sms'
      ? env.SMS_WEBHOOK_HMAC_SECRET
      : env.PROVIDER_WEBHOOK_HMAC_SECRET;
  if (!secret) {
    return error('WEBHOOK_NOT_CONFIGURED', 'Webhook is unavailable', 503);
  }

  let verified: Awaited<ReturnType<typeof verifyWebhookRequest>>;
  try {
    verified = await verifyWebhookRequest(
      request,
      secret,
      new D1WebhookReplayStore(env.DB, source)
    );
  } catch (err) {
    const securityError =
      err instanceof WebhookSecurityError
        ? err
        : new WebhookSecurityError('INVALID_WEBHOOK_SIGNATURE', 401);
    try {
      await createAuditLog(env.DB, {
        action: 'webhook.rejected',
        entityType: 'webhook',
        newValues: { source, code: securityError.code },
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('User-Agent'),
        result: 'failure',
      });
    } catch {
      // Rejection must not depend on audit storage availability.
    }
    return error(securityError.code, 'Webhook request rejected', securityError.status);
  }

  const response =
    source === 'payment-sms'
      ? await handleSmsPaymentWebhook(verified.rawBody, env)
      : await handleProviderWebhook(verified.rawBody, env);
  const processed = response.ok;

  await env.DB.prepare(
    `UPDATE webhook_events
     SET status = ?, error_code = ?, processed_at = datetime('now')
     WHERE event_id = ?`
  )
    .bind(
      processed ? 'processed' : 'failed',
      processed ? null : `HTTP_${response.status}`,
      verified.eventId
    )
    .run();
  await createAuditLog(env.DB, {
    action: processed ? 'webhook.processed' : 'webhook.failed',
    entityType: 'webhook_events',
    entityId: verified.eventId,
    newValues: {
      source,
      bodyHash: verified.bodyHash,
      timestamp: verified.timestamp,
    },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent'),
    result: processed ? 'success' : 'failure',
  });
  return response;
}

async function handleSmsPaymentWebhook(rawBody: string, env: Env): Promise<Response> {
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = {};
  }

  const smsText = body.message || body.sms || body.text || rawBody || '';
  const source = body.source || 'sms_webhook';

  const messageHash = await hashToken(smsText.trim().toLowerCase());

  const existing = await env.DB.prepare(
    'SELECT id FROM sms_webhook_events WHERE message_hash = ?'
  )
    .bind(messageHash)
    .first();

  if (existing) {
    return json({ success: true, data: { message: 'Duplicate message ignored' } });
  }

  const eventId = generateId();

  const phoneMatch = smsText.match(/0?1[0125]\d{8}/);
  const phoneNumber = phoneMatch ? phoneMatch[0] : body.phone_number || null;

  let amount: number | null = null;
  const amountMatches = smsText.match(/(\d+\.?\d*)\s*(EGP|SAR|USD|جنيه|ريال|دولار)/i);
  if (amountMatches) {
    amount = parseFloat(amountMatches[1]);
  } else {
    const numMatches = smsText.match(/\b(\d{2,6}(?:\.\d{2})?)\b/g);
    if (numMatches) {
      for (const m of numMatches) {
        const val = parseFloat(m);
        if (val >= 10 && val <= 100000) {
          amount = val;
          break;
        }
      }
    }
  }

  if (!amount) {
    amount = body.amount || null;
  }

  let orderId: string | null = null;
  let userId: string | null = null;
  let status: string = 'received';
  let reason: string | null = null;

  if (amount && phoneNumber) {
    const matchingOrders = await env.DB.prepare(
      `SELECT o.*, u.whatsapp FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.type = 'recharge' AND o.status = 'pending'
       AND (o.price BETWEEN ? AND ?)
       AND o.currency = 'EGP'
       AND o.created_at > datetime('now', '-7 days')
       ORDER BY o.created_at DESC
       LIMIT 5`
    )
      .bind(amount * 0.9, amount * 1.1)
      .all<any>();

    let bestMatch: any = null;

    for (const order of matchingOrders.results) {
      if (order.whatsapp && phoneNumber.includes(order.whatsapp.replace(/\D/g, ''))) {
        bestMatch = order;
        break;
      }
    }

    if (!bestMatch && matchingOrders.results.length === 1) {
      bestMatch = matchingOrders.results[0];
    }

    if (bestMatch) {
      orderId = bestMatch.id;
      userId = bestMatch.user_id;
      status = 'matched';

      const priceUsd = bestMatch.currency === 'USD'
        ? bestMatch.price
        : bestMatch.currency === 'EGP'
        ? bestMatch.price / 50
        : bestMatch.price / 3.75;

      const user = await env.DB.prepare('SELECT balance_usd FROM users WHERE id = ?')
        .bind(userId)
        .first<{ balance_usd: number }>();

      if (user) {
        const txId = generateId();
        const newBalance = user.balance_usd + priceUsd;

        await env.DB.batch([
          env.DB.prepare(
            'UPDATE users SET balance_usd = balance_usd + ?, updated_at = datetime(\'now\') WHERE id = ?'
          ).bind(priceUsd, userId),
          env.DB.prepare(
            `INSERT INTO wallet_transactions (id, user_id, order_id, amount_usd, type, description, balance_before, balance_after, created_at)
             VALUES (?, ?, ?, ?, 'credit', ?, ?, ?, datetime('now'))`
          ).bind(
            txId, userId, orderId, priceUsd,
            `SMS payment received - ${bestMatch.price} ${bestMatch.currency}`,
            user.balance_usd, newBalance
          ),
          env.DB.prepare(
            `UPDATE orders SET status = 'completed', webhook_data = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(JSON.stringify({ sms_text: smsText, matched_at: new Date().toISOString() }), orderId),
        ]);

        await env.DB.prepare(
          `INSERT INTO notifications (id, user_id, title, body, type, created_at)
           VALUES (?, ?, ?, ?, 'recharge_completed', datetime('now'))`
        )
          .bind(
            generateId(), userId, 'Balance Recharged',
            `Your recharge of ${bestMatch.price} ${bestMatch.currency} has been confirmed. Your balance has been updated.`
          )
          .run();

        status = 'processed';
      } else {
        reason = 'User not found';
      }
    } else {
      reason = 'No matching recharge order found';
    }
  } else {
    reason = amount ? 'Phone number not detected' : 'Amount not detected';
  }

  if (status === 'received') {
    status = 'rejected';
  }

  await env.DB.prepare(
    `INSERT INTO sms_webhook_events (id, message_hash, phone_number, amount, raw_text,
      parsed_data, status, order_id, user_id, reason, webhook_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      eventId, messageHash, phoneNumber, amount, smsText,
      JSON.stringify(body), status, orderId, userId, reason, source
    )
    .run();

  return json({
    success: true,
    data: {
      id: eventId,
      status,
      matched: status === 'processed',
      ...(reason ? { reason } : {}),
    },
  });
}

async function handleProviderWebhook(rawBody: string, env: Env): Promise<Response> {
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return error('INVALID_JSON', 'Invalid webhook payload', 400);
  }

  const { order_id, status, provider_ref, message } = body;

  if (!order_id || !status) {
    return error('MISSING_FIELDS', 'order_id and status are required', 400);
  }

  const validStatuses = ['pending', 'processing', 'completed', 'rejected', 'cancelled', 'refunded'];
  if (!validStatuses.includes(status)) {
    return error('INVALID_STATUS', `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(order_id)
    .first<any>();

  if (!order) {
    return error('NOT_FOUND', 'Order not found', 404);
  }

  const oldStatus = order.status;

  await env.DB.prepare(
    `UPDATE orders SET status = ?, webhook_data = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(
      status,
      JSON.stringify({
        provider_ref,
        message,
        previous_status: oldStatus,
        updated_at: new Date().toISOString(),
      }),
      order_id
    )
    .run();

  if (status === 'completed' || status === 'rejected' || status === 'cancelled' || status === 'refunded') {
    const notificationTitle =
      status === 'completed'
        ? 'Order Completed'
        : status === 'rejected'
        ? 'Order Rejected'
        : status === 'cancelled'
        ? 'Order Cancelled'
        : 'Order Refunded';

    const notificationBody =
      status === 'completed'
        ? `Your order #${order_id.slice(0, 8)} for ${order.service_name} has been completed.`
        : status === 'refunded'
        ? `Your order #${order_id.slice(0, 8)} has been refunded.`
        : `Your order #${order_id.slice(0, 8)} for ${order.service_name} has been ${status}.`;

    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, created_at)
       VALUES (?, ?, ?, ?, 'order_status', datetime('now'))`
    )
      .bind(generateId(), order.user_id, notificationTitle, notificationBody)
      .run();
  }

  return json({ success: true, data: { message: 'Webhook processed' } });
}
