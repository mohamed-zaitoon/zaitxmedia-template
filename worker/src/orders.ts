import {
  json,
  error,
  generateId,
  requireAuth,
  requireAdmin,
  getClientIp,
  createAuditLog,
  parsePagination,
  checkRateLimit,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';
import {
  getServerPrice,
  type PriceSnapshot,
  type SupportedCurrency,
} from './pricing';

export async function handleOrdersRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.CACHE, ip, 'orders', RATE_LIMITS.api);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  const method = request.method;

  if (path === '/api/orders' && method === 'POST') {
    return handleCreateOrder(request, env);
  }
  if (path === '/api/orders/from-balance' && method === 'POST') {
    return handleCreateOrderFromBalance(request, env);
  }
  if (path === '/api/orders' && method === 'GET') {
    return handleListOrders(request, env);
  }
  if (path.match(/^\/api\/orders\/[^/]+$/) && method === 'GET') {
    return handleGetOrder(request, env, path);
  }

  // POST /v1/orders/:orderId/reject - Admin reject order
  const rejectMatch = path.match(/^\/v1\/orders\/([^/]+)\/reject$/);
  if (rejectMatch && method === 'POST') {
    return handleRejectOrder(request, env, rejectMatch[1]);
  }

  return error('NOT_FOUND', 'Orders endpoint not found', 404);
}

interface OrderOptions {
  currency?: SupportedCurrency;
  link?: string;
  country?: string;
  paymentMethod?: string;
  proofOfPayment?: string;
  isGame?: boolean;
}

interface OrderInput {
  serviceId: string;
  quantity: number;
  options: OrderOptions;
  idempotencyKey: string;
}

function parseOrderInput(body: any): OrderInput {
  const serviceId = String(body?.serviceId ?? body?.service_id ?? '').trim();
  const quantity = Number(body?.quantity);
  const idempotencyKey = String(
    body?.idempotencyKey ?? body?.idempotency_key ?? ''
  ).trim();
  const options =
    body?.options && typeof body.options === 'object' ? body.options : {};

  if (!serviceId || !Number.isInteger(quantity) || quantity <= 0 || !idempotencyKey) {
    throw new Error('INVALID_ORDER_INPUT');
  }
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    throw new Error('INVALID_IDEMPOTENCY_KEY');
  }

  return { serviceId, quantity, options, idempotencyKey };
}

async function existingIdempotentOrder(
  db: D1Database,
  userId: string,
  idempotencyKey: string
): Promise<any | null> {
  return db
    .prepare(
      'SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1'
    )
    .bind(userId, idempotencyKey)
    .first();
}

function mapPricingError(err: unknown): Response {
  const code = err instanceof Error ? err.message : 'PRICING_FAILED';
  if (code === 'SERVICE_NOT_FOUND' || code === 'PRICE_TIER_NOT_FOUND') {
    return error(code, 'Service pricing is not available', 404);
  }
  if (code === 'SERVICE_INACTIVE') {
    return error(code, 'Service is inactive', 409);
  }
  if (code.startsWith('INVALID_')) {
    return error(code, 'Invalid service quantity or pricing configuration', 400);
  }
  return error('PRICING_FAILED', 'Unable to calculate order price', 500);
}

async function getUsdAmount(
  db: D1Database,
  pricing: PriceSnapshot
): Promise<number> {
  if (pricing.currency === 'USD') return pricing.total;

  const settingKey =
    pricing.currency === 'EGP' ? 'usd_to_egp_rate' : 'usd_to_sar_rate';
  const setting = await db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .bind(settingKey)
    .first<{ value: string }>();
  const parsed = setting?.value ? JSON.parse(setting.value) : null;
  const rate = Number(parsed);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('INVALID_EXCHANGE_RATE');
  return Math.round((pricing.total / rate + Number.EPSILON) * 100) / 100;
}

async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  let input: OrderInput;
  try {
    input = parseOrderInput(await request.json());
  } catch (err) {
    return mapPricingError(err);
  }

  const existing = await existingIdempotentOrder(
    env.DB,
    session.user_id,
    input.idempotencyKey
  );
  if (existing) {
    return json({ success: true, data: { order: existing, duplicate: true } });
  }

  const requestedCurrency = input.options.currency ?? 'EGP';
  if (!['EGP', 'SAR', 'USD'].includes(requestedCurrency)) {
    return error('INVALID_CURRENCY', 'Unsupported currency', 400);
  }

  let pricing: PriceSnapshot;
  try {
    pricing = await getServerPrice(
      env.DB,
      input.serviceId,
      input.quantity,
      requestedCurrency
    );
  } catch (err) {
    return mapPricingError(err);
  }

  const id = generateId();
  try {
    await env.DB.prepare(
      `INSERT INTO orders (
        id, user_id, service_id, service_name, is_game, quantity, price, currency,
        link, country, payment_method, proof_of_payment, user_whatsapp, full_name,
        username, user_email, price_snapshot, idempotency_key, status, type,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'pending', 'order', datetime('now'), datetime('now')
      )`
    )
      .bind(
        id,
        session.user_id,
        pricing.serviceId,
        pricing.serviceName,
        input.options.isGame ? 1 : 0,
        pricing.quantity,
        pricing.total,
        pricing.currency,
        input.options.link || null,
        input.options.country || null,
        input.options.paymentMethod || 'wallet',
        input.options.proofOfPayment || null,
        session.whatsapp || null,
        session.full_name || null,
        session.username || null,
        session.email || null,
        JSON.stringify(pricing),
        input.idempotencyKey
      )
      .run();
  } catch {
    const duplicate = await existingIdempotentOrder(
      env.DB,
      session.user_id,
      input.idempotencyKey
    );
    if (duplicate) {
      return json({ success: true, data: { order: duplicate, duplicate: true } });
    }
    return error('ORDER_CREATE_FAILED', 'Unable to create order', 500);
  }

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'order.create',
    entityType: 'orders',
    entityId: id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
    newValues: { pricing, idempotencyKey: '[REDACTED]' },
  });

  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, created_at)
     VALUES (?, ?, ?, ?, 'order_created', datetime('now'))`
  )
    .bind(
      generateId(),
      session.user_id,
      'Order Created',
      `Your order #${id.slice(0, 8)} for ${pricing.serviceName} has been created and is pending.`
    )
    .run();

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return json({ success: true, data: { order } }, 201);
}

async function handleCreateOrderFromBalance(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  let input: OrderInput;
  try {
    input = parseOrderInput(await request.json());
  } catch (err) {
    return mapPricingError(err);
  }

  const existing = await existingIdempotentOrder(
    env.DB,
    session.user_id,
    input.idempotencyKey
  );
  if (existing) {
    return json({ success: true, data: { order: existing, duplicate: true } });
  }

  let pricing: PriceSnapshot;
  let priceUsd: number;
  try {
    pricing = await getServerPrice(
      env.DB,
      input.serviceId,
      input.quantity,
      input.options.currency ?? 'EGP'
    );
    priceUsd = await getUsdAmount(env.DB, pricing);
  } catch (err) {
    return mapPricingError(err);
  }

  const currentUser = await env.DB.prepare('SELECT balance_usd FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<{ balance_usd: number }>();
  if (!currentUser) return error('NOT_FOUND', 'User not found', 404);
  if (currentUser.balance_usd < priceUsd) {
    return error('INSUFFICIENT_BALANCE', 'Insufficient balance', 400);
  }

  const orderId = generateId();
  const txId = generateId();
  const notifId = generateId();

  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE users
         SET balance_usd = balance_usd - ?, updated_at = datetime('now')
         WHERE id = ? AND balance_usd >= ?`
      ).bind(priceUsd, session.user_id, priceUsd),
      env.DB.prepare(
        `INSERT INTO orders (
          id, user_id, service_id, service_name, is_game, quantity, price,
          currency, link, country, payment_method, user_whatsapp, full_name,
          username, user_email, price_snapshot, idempotency_key, status, type,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'wallet', ?, ?, ?, ?, ?, ?,
          'processing', 'order', datetime('now'), datetime('now')
        )`
      ).bind(
        orderId,
        session.user_id,
        pricing.serviceId,
        pricing.serviceName,
        input.options.isGame ? 1 : 0,
        pricing.quantity,
        pricing.total,
        pricing.currency,
        input.options.link || null,
        input.options.country || null,
        session.whatsapp || null,
        session.full_name || null,
        session.username || null,
        session.email || null,
        JSON.stringify(pricing),
        input.idempotencyKey
      ),
      env.DB.prepare(
        `INSERT INTO wallet_transactions (
          id, user_id, order_id, amount_usd, type, description,
          balance_before, balance_after, created_at
        ) VALUES (?, ?, ?, ?, 'debit', ?, ?, ?, datetime('now'))`
      ).bind(
        txId,
        session.user_id,
        orderId,
        priceUsd,
        `Payment for order #${orderId.slice(0, 8)} - ${pricing.serviceName}`,
        currentUser.balance_usd,
        currentUser.balance_usd - priceUsd
      ),
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, created_at)
         VALUES (?, ?, ?, ?, 'order_created', datetime('now'))`
      ).bind(
        notifId,
        session.user_id,
        'Order Created',
        `Your order #${orderId.slice(0, 8)} for ${pricing.serviceName} has been placed from your balance.`
      ),
    ]);
    if (!results[0].success || (results[0].meta as any)?.changes_written === 0) {
      return error('INSUFFICIENT_BALANCE', 'Insufficient balance', 400);
    }
  } catch {
    const duplicate = await existingIdempotentOrder(
      env.DB,
      session.user_id,
      input.idempotencyKey
    );
    if (duplicate) {
      return json({ success: true, data: { order: duplicate, duplicate: true } });
    }
    return error('ORDER_CREATE_FAILED', 'Unable to create order', 500);
  }

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'order.create_from_balance',
    entityType: 'orders',
    entityId: orderId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
    newValues: { pricing, idempotencyKey: '[REDACTED]' },
  });

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  const updatedUser = await env.DB.prepare('SELECT balance_usd FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<{ balance_usd: number }>();

  return json({
    success: true,
    data: { order, balance_usd: updatedUser?.balance_usd },
  }, 201);
}

async function handleListOrders(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  const { page, limit, offset } = parsePagination(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const type = url.searchParams.get('type') || '';

  let whereClause = 'user_id = ?';
  const bindings: any[] = [session.user_id];

  if (status) {
    whereClause += ' AND status = ?';
    bindings.push(status);
  }
  if (type) {
    whereClause += ' AND type = ?';
    bindings.push(type);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const orders = await env.DB.prepare(
    `SELECT * FROM orders WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...bindings, limit, offset)
    .all();

  return json({
    success: true,
    data: { orders: orders.results },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function handleGetOrder(request: Request, env: Env, path: string): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  const orderId = path.split('/').pop();

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first<any>();

  if (!order) {
    return error('NOT_FOUND', 'Order not found', 404);
  }

  if (order.user_id !== session.user_id && session.role !== 'admin') {
    return error('FORBIDDEN', 'Access denied', 403);
  }

  const transactions = await env.DB.prepare(
    'SELECT * FROM wallet_transactions WHERE order_id = ?'
  )
    .bind(orderId)
    .all();

  return json({
    success: true,
    data: {
      order,
      transactions: transactions.results,
    },
  });
}

async function handleRejectOrder(
  request: Request,
  env: Env,
  orderId: string
): Promise<Response> {
  let session;
  try {
    session = await requireAdmin(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  // Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const reason = String(body?.reason ?? '').trim();
  if (!reason) {
    return error('REJECTION_REASON_REQUIRED', 'يجب إدخال سبب رفض الطلب', 400);
  }

  // Fetch order
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first<any>();

  if (!order) {
    return error('NOT_FOUND', 'الطلب غير موجود', 404);
  }

  // Prevent rejecting already rejected or cancelled orders
  if (order.status === 'rejected') {
    return error('ALREADY_REJECTED', 'الطلب مرفوض مسبقاً', 400);
  }
  if (order.status === 'cancelled') {
    return error('ALREADY_CANCELLED', 'الطلب ملغي مسبقاً', 400);
  }
  // Prevent rejecting completed orders unless explicitly allowed
  if (order.status === 'completed') {
    return error('ORDER_COMPLETED', 'لا يمكن رفض طلب مكتمل', 400);
  }

  const previousStatus = order.status;
  let refunded = false;

  // Handle wallet refund
  if (order.payment_method === 'wallet') {
    // Check if already refunded
    const existingRefund = await env.DB.prepare(
      'SELECT id FROM wallet_transactions WHERE order_id = ? AND type = ? LIMIT 1'
    )
      .bind(orderId, 'refund')
      .first();

    if (!existingRefund) {
      // Get user's current balance
      const user = await env.DB.prepare('SELECT balance_usd FROM users WHERE id = ?')
        .bind(order.user_id)
        .first<{ balance_usd: number }>();

      if (user) {
        const balanceBefore = user.balance_usd;
        let refundAmount = 0;

        // Try to extract USD amount from price_snapshot
        try {
          const snapshot = JSON.parse(order.price_snapshot || '{}');
          refundAmount = Number(snapshot.total) || 0;
        } catch {
          // Fallback: use price field directly
          // The price is in local currency; use exchange rate to convert
          const settingKey = order.currency === 'EGP' ? 'usd_to_egp_rate' : 'usd_to_sar_rate';
          const setting = await env.DB
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .bind(settingKey)
            .first<{ value: string }>();
          const rate = setting?.value ? Number(JSON.parse(setting.value)) : 0;
          if (rate > 0) {
            refundAmount = Math.round((order.price / rate) * 100) / 100;
          } else {
            refundAmount = order.price; // fallback
          }
        }

        if (refundAmount > 0) {
          const balanceAfter = balanceBefore + refundAmount;

          await env.DB.batch([
            env.DB.prepare(
              'UPDATE users SET balance_usd = balance_usd + ?, updated_at = datetime(\'now\') WHERE id = ?'
            ).bind(refundAmount, order.user_id),
            env.DB.prepare(
              `INSERT INTO wallet_transactions (
                id, user_id, order_id, amount_usd, type, description,
                balance_before, balance_after, performed_by, created_at
              ) VALUES (?, ?, ?, ?, 'refund', ?, ?, ?, ?, datetime('now'))`
            ).bind(
              generateId(),
              order.user_id,
              orderId,
              refundAmount,
              `استرداد قيمة طلب مرفوض #${orderId.slice(0, 8)}`,
              balanceBefore,
              balanceAfter,
              session.user_id
            ),
          ]);

          refunded = true;
        }
      }
    } else {
      refunded = true; // Already refunded
    }
  }

  // Update order with rejection details
  await env.DB.prepare(
    `UPDATE orders SET
      status = 'rejected',
      rejection_reason = ?,
      rejected_at = datetime('now'),
      rejected_by = ?,
      admin_notes = CASE WHEN admin_notes IS NULL THEN ? ELSE admin_notes || '\n' || ? END,
      realized_profit_usd = 0,
      profit_status = 'reversed',
      updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    reason,
    session.user_id,
    `رفض: ${reason}`,
    `رفض: ${reason}`,
    orderId
  ).run();

  // Create notification for user
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, created_at)
     VALUES (?, ?, ?, ?, 'order_rejected', datetime('now'))`
  ).bind(
    generateId(),
    order.user_id,
    'تم رفض الطلب',
    `تم رفض طلبك #${orderId.slice(0, 8)} (${order.service_name}). السبب: ${reason}`,
  ).run();

  // Create audit log
  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'order_rejected',
    entityType: 'order',
    entityId: orderId,
    oldValues: { status: previousStatus, realized_profit_usd: order.realized_profit_usd, profit_status: order.profit_status },
    newValues: { status: 'rejected', reason, refunded, realized_profit_usd: 0, profit_status: 'reversed' },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({
    success: true,
    data: {
      orderId,
      status: 'rejected',
      refunded,
    },
    message: 'تم رفض الطلب بنجاح',
  });
}

