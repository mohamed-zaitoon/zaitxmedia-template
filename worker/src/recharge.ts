import {
  json,
  error,
  generateId,
  requireAuth,
  getClientIp,
  createAuditLog,
  parsePagination,
  checkRateLimit,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';

export async function handleRechargeRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.CACHE, ip, 'recharge', RATE_LIMITS.api);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  const method = request.method;

  if (path === '/api/recharge' && method === 'POST') {
    return handleCreateRecharge(request, env);
  }
  if (path === '/api/recharge' && method === 'GET') {
    return handleListRecharge(request, env);
  }

  return error('NOT_FOUND', 'Recharge endpoint not found', 404);
}

async function handleCreateRecharge(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const {
    amount,
    currency,
    payment_method,
    name,
    proof_of_payment,
  } = body;

  if (!amount || !currency || !payment_method) {
    return error('MISSING_FIELDS', 'amount, currency, and payment_method are required', 400);
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return error('INVALID_AMOUNT', 'Amount must be a positive number', 400);
  }

  if (!['EGP', 'SAR', 'USD'].includes(currency)) {
    return error('INVALID_CURRENCY', 'Currency must be EGP, SAR, or USD', 400);
  }

  const id = generateId();
  const serviceName =
    payment_method === 'instapay'
      ? `Recharge via InstaPay - ${amount} ${currency}`
      : payment_method === 'barq'
      ? `Recharge via Barq - ${amount} ${currency}`
      : payment_method === 'binance'
      ? `Recharge via Binance - ${amount} ${currency}`
      : `Recharge - ${amount} ${currency}`;

  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, service_name, quantity, price, currency,
      payment_method, proof_of_payment, user_whatsapp, full_name, username, user_email,
      status, type, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'recharge', datetime('now'), datetime('now'))`
  )
    .bind(
      id,
      session.user_id,
      serviceName,
      amount,
      currency,
      payment_method,
      proof_of_payment || null,
      session.whatsapp || null,
      name || session.full_name || null,
      session.username || null,
      session.email || null
    )
    .run();

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'recharge.create',
    entityType: 'orders',
    entityId: id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, created_at)
     VALUES (?, ?, ?, ?, 'recharge_created', datetime('now'))`
  )
    .bind(
      generateId(),
      session.user_id,
      'Recharge Request Sent',
      `Your recharge request #${id.slice(0, 8)} for ${amount} ${currency} has been submitted.`
    )
    .run();

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();

  return json({ success: true, data: { order } }, 201);
}

async function handleListRecharge(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  const { page, limit, offset } = parsePagination(request);

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM orders WHERE user_id = ? AND type = ?'
  )
    .bind(session.user_id, 'recharge')
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const orders = await env.DB.prepare(
    `SELECT * FROM orders WHERE user_id = ? AND type = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(session.user_id, 'recharge', limit, offset)
    .all();

  return json({
    success: true,
    data: { recharges: orders.results },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}


