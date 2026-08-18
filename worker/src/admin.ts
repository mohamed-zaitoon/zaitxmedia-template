import {
  json,
  error,
  generateId,
  requireAdmin,
  getClientIp,
  createAuditLog,
  parsePagination,
  checkRateLimit,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';

export async function handleAdminRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.CACHE, ip, 'admin', RATE_LIMITS.api);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  let session;
  try {
    session = await requireAdmin(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  const method = request.method;

  try {
    if (path === '/api/admin/users' && method === 'GET') {
      return handleListUsers(request, env, session);
    }
    if (path.match(/^\/api\/admin\/users\/[^/]+$/) && method === 'GET') {
      return handleGetUser(path, env, session);
    }
    if (path.match(/^\/api\/admin\/users\/[^/]+$/) && method === 'PATCH') {
      return handleUpdateUser(request, path, env, session);
    }
    if (path === '/api/admin/orders' && method === 'GET') {
      return handleListOrders(request, env, session);
    }
    if (path.match(/^\/api\/admin\/orders\/[^/]+$/) && method === 'PATCH') {
      return handleUpdateOrder(request, path, env, session);
    }
    if (path.match(/^\/api\/admin\/sessions\/[^/]+$/) && method === 'DELETE') {
      return handleAdminRevokeSessions(request, path, env, session);
    }
    if (path === '/api/admin/audit-logs' && method === 'GET') {
      return handleAuditLogs(request, env, session);
    }
    if (path === '/api/admin/stats' && method === 'GET') {
      return handleStats(env, session);
    }
    return error('NOT_FOUND', 'Admin endpoint not found', 404);
  } catch (e: any) {
    console.error('Admin error:', e.message);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function handleListUsers(request: Request, env: Env, session: any): Promise<Response> {
  const { page, limit, offset } = parsePagination(request);
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const role = url.searchParams.get('role') || '';
  const banned = url.searchParams.get('banned');

  let whereClause = '1=1';
  const bindings: any[] = [];

  if (search) {
    whereClause += ' AND (email LIKE ? OR full_name LIKE ? OR username LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role) {
    whereClause += ' AND role = ?';
    bindings.push(role);
  }
  if (banned !== null && banned !== '') {
    whereClause += ' AND banned = ?';
    bindings.push(banned === '1' ? 1 : 0);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const users = await env.DB.prepare(
    `SELECT id, email, email_verified, full_name, username, whatsapp, country,
            preferred_currency, role, banned, balance_usd, created_at, updated_at
     FROM users WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...bindings, limit, offset)
    .all();

  return json({
    success: true,
    data: { users: users.results },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function handleGetUser(path: string, env: Env, session: any): Promise<Response> {
  const userId = path.split('/').pop();

  const user = await env.DB.prepare(
    `SELECT id, email, email_verified, full_name, username, whatsapp, country,
            preferred_currency, role, banned, balance_usd, name_last_changed_at,
            username_last_changed_at, country_last_changed_at, created_at, updated_at
     FROM users WHERE id = ?`
  )
    .bind(userId)
    .first();

  if (!user) {
    return error('NOT_FOUND', 'User not found', 404);
  }

  const [ordersCount, sessionsCount, transactions] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as total FROM orders WHERE user_id = ?')
      .bind(userId)
      .first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) as total FROM sessions WHERE user_id = ? AND expires_at > datetime(\'now\')')
      .bind(userId)
      .first<{ total: number }>(),
    env.DB.prepare(
      'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
    )
      .bind(userId)
      .all(),
  ]);

  return json({
    success: true,
    data: {
      user,
      stats: {
        totalOrders: ordersCount?.total || 0,
        activeSessions: sessionsCount?.total || 0,
      },
      recentTransactions: transactions.results,
    },
  });
}

async function handleUpdateUser(
  request: Request,
  path: string,
  env: Env,
  session: any
): Promise<Response> {
  const userId = path.split('/').pop();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>();
  if (!user) {
    return error('NOT_FOUND', 'User not found', 404);
  }

  const updates: string[] = [];
  const bindings: any[] = [];
  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  const updatableFields = [
    'balance_usd',
    'role',
    'banned',
    'full_name',
    'username',
    'whatsapp',
    'country',
    'preferred_currency',
    'email_verified',
  ];

  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      oldValues[field] = user[field];
      newValues[field] = body[field];
      updates.push(`${field} = ?`);
      bindings.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return error('NO_UPDATES', 'No valid fields to update', 400);
  }

  updates.push('updated_at = datetime(\'now\')');
  bindings.push(userId);

  if (body.balance_usd !== undefined && body.balance_usd !== user.balance_usd) {
    const txId = generateId();
    const amountDiff = body.balance_usd - user.balance_usd;
    await env.DB.prepare(
      `INSERT INTO wallet_transactions (id, user_id, amount_usd, type, description, balance_before, balance_after, performed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        txId,
        userId,
        Math.abs(amountDiff),
        amountDiff >= 0 ? 'credit' : 'debit',
        'Balance adjusted by admin',
        user.balance_usd,
        body.balance_usd,
        session.user_id
      )
      .run();
  }

  await env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...bindings)
    .run();

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'admin.update_user',
    entityType: 'users',
    entityId: userId,
    oldValues,
    newValues,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  const updated = await env.DB.prepare(
    `SELECT id, email, email_verified, full_name, username, whatsapp, country,
            preferred_currency, role, banned, balance_usd, created_at, updated_at
     FROM users WHERE id = ?`
  )
    .bind(userId)
    .first();

  return json({ success: true, data: { user: updated } });
}

async function handleListOrders(request: Request, env: Env, session: any): Promise<Response> {
  const { page, limit, offset } = parsePagination(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const userId = url.searchParams.get('userId') || '';
  const type = url.searchParams.get('type') || '';
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';

  let whereClause = '1=1';
  const bindings: any[] = [];

  if (status) {
    whereClause += ' AND o.status = ?';
    bindings.push(status);
  }
  if (userId) {
    whereClause += ' AND o.user_id = ?';
    bindings.push(userId);
  }
  if (type) {
    whereClause += ' AND o.type = ?';
    bindings.push(type);
  }
  if (dateFrom) {
    whereClause += ' AND o.created_at >= ?';
    bindings.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND o.created_at <= ?';
    bindings.push(dateTo);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const orders = await env.DB.prepare(
    `SELECT o.*, u.email as user_email_field, u.full_name as user_full_name
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC
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

async function handleUpdateOrder(
  request: Request,
  path: string,
  env: Env,
  session: any
): Promise<Response> {
  const orderId = path.split('/').pop();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first<any>();

  if (!order) {
    return error('NOT_FOUND', 'Order not found', 404);
  }

  const validStatuses = ['pending', 'processing', 'completed', 'rejected', 'cancelled', 'refunded'];

  if (body.status && !validStatuses.includes(body.status)) {
    return error('INVALID_STATUS', `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const updates: string[] = [];
  const bindings: any[] = [];

  if (body.status) {
    updates.push('status = ?');
    bindings.push(body.status);
  }
  if (body.admin_notes !== undefined) {
    updates.push('admin_notes = ?');
    bindings.push(body.admin_notes);
  }

  if (updates.length === 0) {
    return error('NO_UPDATES', 'No valid fields to update', 400);
  }

  updates.push('updated_at = datetime(\'now\')');
  bindings.push(orderId);

  await env.DB.prepare(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...bindings)
    .run();

  if (body.status === 'refunded' && order.payment_method === 'wallet') {
    const txId = generateId();
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET balance_usd = balance_usd + ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(order.price, order.user_id),
      env.DB.prepare(
        `INSERT INTO wallet_transactions (id, user_id, order_id, amount_usd, type, description, performed_by, created_at)
         VALUES (?, ?, ?, ?, 'refund', ?, ?, datetime('now'))`
      ).bind(txId, order.user_id, order.id, order.price, `Refund for order ${order.id}`, session.user_id),
    ]);

    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, created_at)
       VALUES (?, ?, ?, ?, 'order_refund', datetime('now'))`
    )
      .bind(generateId(), order.user_id, 'Order Refunded', `Your order #${order.id.slice(0, 8)} has been refunded. $${order.price} has been credited to your balance.`)
      .run();
  }

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'admin.update_order',
    entityType: 'orders',
    entityId: orderId,
    oldValues: { status: order.status, admin_notes: order.admin_notes },
    newValues: { status: body.status || order.status, admin_notes: body.admin_notes !== undefined ? body.admin_notes : order.admin_notes },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  const updated = await env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  return json({ success: true, data: { order: updated } });
}

async function handleAdminRevokeSessions(
  request: Request,
  path: string,
  env: Env,
  session: any
): Promise<Response> {
  const userId = path.split('/').pop();

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) {
    return error('NOT_FOUND', 'User not found', 404);
  }

  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'admin.revoke_sessions',
    entityType: 'users',
    entityId: userId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { message: 'All sessions revoked for user' } });
}

async function handleAuditLogs(request: Request, env: Env, session: any): Promise<Response> {
  const { page, limit, offset } = parsePagination(request);
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '';
  const action = url.searchParams.get('action') || '';

  let whereClause = '1=1';
  const bindings: any[] = [];

  if (userId) {
    whereClause += ' AND user_id = ?';
    bindings.push(userId);
  }
  if (action) {
    whereClause += ' AND action LIKE ?';
    bindings.push(`%${action}%`);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const logs = await env.DB.prepare(
    `SELECT a.*, u.email as user_email
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...bindings, limit, offset)
    .all();

  return json({
    success: true,
    data: { logs: logs.results },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function handleStats(env: Env, session: any): Promise<Response> {
  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    totalOrders,
    ordersByStatus,
    totalRevenue,
    recentOrders,
    recentUsers,
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) as total FROM users WHERE banned = 0').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) as total FROM users WHERE banned = 1').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) as total FROM orders').first<{ total: number }>(),
    env.DB.prepare(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status`
    ).all(),
    env.DB.prepare(
      `SELECT SUM(price) as total FROM orders WHERE status = 'completed' AND payment_method = 'wallet'`
    ).first<{ total: number }>(),
    env.DB.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 5'
    ).all(),
    env.DB.prepare(
      `SELECT id, email, full_name, username, role, banned, balance_usd, created_at
       FROM users ORDER BY created_at DESC LIMIT 5`
    ).all(),
  ]);

  const totalBalance = await env.DB.prepare(
    'SELECT SUM(balance_usd) as total FROM users'
  ).first<{ total: number }>();

  const rechargeOrders = await env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(price) as amount FROM orders WHERE type = 'recharge' AND status = 'pending'`
  ).first<{ total: number; amount: number }>();

  return json({
    success: true,
    data: {
      users: {
        total: totalUsers?.total || 0,
        active: activeUsers?.total || 0,
        banned: bannedUsers?.total || 0,
        totalBalance: totalBalance?.total || 0,
      },
      orders: {
        total: totalOrders?.total || 0,
        totalRevenue: totalRevenue?.total || 0,
        byStatus: ordersByStatus.results,
      },
      recharge: {
        pending: rechargeOrders?.total || 0,
        pendingAmount: rechargeOrders?.amount || 0,
      },
      recentOrders: recentOrders.results,
      recentUsers: recentUsers.results,
    },
  });
}


