import {
  json,
  error,
  generateId,
  requireAdmin,
  requireAuth,
  getClientIp,
  createAuditLog,
  checkRateLimit,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';

export async function handleSettingsRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.CACHE, ip, 'settings', RATE_LIMITS.api);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  const method = request.method;

  try {
    if (path === '/api/settings' && method === 'GET') {
      return handleGetSettings(env);
    }
    if (path.match(/^\/api\/settings\/[^/]+$/) && method === 'PATCH') {
      return handleUpdateSetting(request, env, path);
    }
    if (path === '/api/settings/pricing' && method === 'GET') {
      return handleGetPricing(env);
    }
    if (path === '/api/settings/payment-methods' && method === 'GET') {
      return handleGetPaymentMethods(env);
    }
    if (path === '/api/admin/pricing' && method === 'POST') {
      return handleManagePricing(request, env);
    }
    if (path === '/api/admin/payment-methods' && method === 'POST') {
      return handleManagePaymentMethods(request, env);
    }
    return error('NOT_FOUND', 'Settings endpoint not found', 404);
  } catch (e: any) {
    console.error('Settings error:', e.message);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function handleGetSettings(env: Env): Promise<Response> {
  const settings = await env.DB.prepare(
    'SELECT * FROM app_settings'
  ).all();

  const settingsObj: Record<string, string> = {};
  for (const row of settings.results) {
    settingsObj[(row as any).key] = (row as any).value;
  }

  return json({ success: true, data: { settings: settingsObj } });
}

async function handleUpdateSetting(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  let session;
  try {
    session = await requireAdmin(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  const key = path.split('/').pop()!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  if (body.value === undefined) {
    return error('MISSING_FIELDS', 'value is required', 400);
  }

  const existing = await env.DB.prepare(
    'SELECT * FROM app_settings WHERE key = ?'
  )
    .bind(key)
    .first<any>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE app_settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?`
    )
      .bind(String(body.value), session.user_id, key)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))`
    )
      .bind(key, String(body.value), session.user_id)
      .run();
  }

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'settings.update',
    entityType: 'app_settings',
    entityId: key,
    oldValues: existing ? { value: existing.value } : {},
    newValues: { value: body.value },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  const updated = await env.DB.prepare(
    'SELECT * FROM app_settings WHERE key = ?'
  )
    .bind(key)
    .first();

  return json({ success: true, data: { setting: updated } });
}

async function handleGetPricing(env: Env): Promise<Response> {
  const pricing = await env.DB.prepare(
    'SELECT * FROM price_tiers ORDER BY category, min'
  ).all();

  return json({ success: true, data: { pricing: pricing.results } });
}

async function handleGetPaymentMethods(env: Env): Promise<Response> {
  const methods = await env.DB.prepare(
    'SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order'
  ).all();

  return json({ success: true, data: { paymentMethods: methods.results } });
}

async function handleManagePricing(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAdmin(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { action, tier } = body;

  if (!action) {
    return error('MISSING_FIELDS', 'action is required (create, update, delete)', 400);
  }

  if (action === 'create' || action === 'update') {
    if (!tier || !tier.category || tier.min === undefined || tier.max === undefined || tier.price_per_1000 === undefined) {
      return error('MISSING_FIELDS', 'tier with category, min, max, and price_per_1000 is required', 400);
    }

    if (action === 'create') {
      const id = generateId();
      await env.DB.prepare(
        `INSERT INTO price_tiers (id, category, min, max, price_per_1000, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(id, tier.category, tier.min, tier.max, tier.price_per_1000)
        .run();

      await createAuditLog(env.DB, {
        userId: session.user_id,
        action: 'pricing.create',
        entityType: 'price_tiers',
        entityId: id,
        newValues: tier,
        ipAddress: getClientIp(request),
      });

      const created = await env.DB.prepare('SELECT * FROM price_tiers WHERE id = ?').bind(id).first();
      return json({ success: true, data: { tier: created } }, 201);
    }

    if (action === 'update') {
      if (!tier.id) {
        return error('MISSING_FIELDS', 'tier.id is required for update', 400);
      }

      const existing = await env.DB.prepare('SELECT * FROM price_tiers WHERE id = ?')
        .bind(tier.id)
        .first<any>();

      if (!existing) {
        return error('NOT_FOUND', 'Price tier not found', 404);
      }

      await env.DB.prepare(
        `UPDATE price_tiers SET category = ?, min = ?, max = ?, price_per_1000 = ? WHERE id = ?`
      )
        .bind(tier.category, tier.min, tier.max, tier.price_per_1000, tier.id)
        .run();

      await createAuditLog(env.DB, {
        userId: session.user_id,
        action: 'pricing.update',
        entityType: 'price_tiers',
        entityId: tier.id,
        oldValues: existing,
        newValues: tier,
        ipAddress: getClientIp(request),
      });

      const updated = await env.DB.prepare('SELECT * FROM price_tiers WHERE id = ?')
        .bind(tier.id)
        .first();

      return json({ success: true, data: { tier: updated } });
    }
  }

  if (action === 'delete') {
    if (!body.id) {
      return error('MISSING_FIELDS', 'id is required for delete', 400);
    }

    const existing = await env.DB.prepare('SELECT * FROM price_tiers WHERE id = ?')
      .bind(body.id)
      .first();

    if (!existing) {
      return error('NOT_FOUND', 'Price tier not found', 404);
    }

    await env.DB.prepare('DELETE FROM price_tiers WHERE id = ?').bind(body.id).run();

    await createAuditLog(env.DB, {
      userId: session.user_id,
      action: 'pricing.delete',
      entityType: 'price_tiers',
      entityId: body.id,
      oldValues: existing as any,
      ipAddress: getClientIp(request),
    });

    return json({ success: true, data: { message: 'Price tier deleted' } });
  }

  return error('INVALID_ACTION', 'Invalid action. Must be create, update, or delete', 400);
}

async function handleManagePaymentMethods(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAdmin(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { action, method } = body;

  if (!action) {
    return error('MISSING_FIELDS', 'action is required (create, update, delete)', 400);
  }

  if (action === 'create' || action === 'update') {
    if (!method || !method.type) {
      return error('MISSING_FIELDS', 'method with type is required', 400);
    }

    const validTypes = ['wallet', 'instapay', 'barq', 'binance'];
    if (!validTypes.includes(method.type)) {
      return error('INVALID_TYPE', `Type must be one of: ${validTypes.join(', ')}`, 400);
    }

    if (action === 'create') {
      const id = generateId();
      await env.DB.prepare(
        `INSERT INTO payment_methods (id, type, label, number, name, link, min_amount, max_amount, is_active, country, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          id,
          method.type,
          method.label || null,
          method.number || null,
          method.name || null,
          method.link || null,
          method.min_amount || null,
          method.max_amount || null,
          method.is_active !== undefined ? method.is_active : 1,
          method.country || null,
          method.sort_order || 0
        )
        .run();

      await createAuditLog(env.DB, {
        userId: session.user_id,
        action: 'payment_method.create',
        entityType: 'payment_methods',
        entityId: id,
        newValues: method,
        ipAddress: getClientIp(request),
      });

      const created = await env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?')
        .bind(id)
        .first();

      return json({ success: true, data: { method: created } }, 201);
    }

    if (action === 'update') {
      if (!method.id) {
        return error('MISSING_FIELDS', 'method.id is required for update', 400);
      }

      const existing = await env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?')
        .bind(method.id)
        .first<any>();

      if (!existing) {
        return error('NOT_FOUND', 'Payment method not found', 404);
      }

      await env.DB.prepare(
        `UPDATE payment_methods SET type = ?, label = ?, number = ?, name = ?, link = ?,
         min_amount = ?, max_amount = ?, is_active = ?, country = ?, sort_order = ? WHERE id = ?`
      )
        .bind(
          method.type || existing.type,
          method.label !== undefined ? method.label : existing.label,
          method.number !== undefined ? method.number : existing.number,
          method.name !== undefined ? method.name : existing.name,
          method.link !== undefined ? method.link : existing.link,
          method.min_amount !== undefined ? method.min_amount : existing.min_amount,
          method.max_amount !== undefined ? method.max_amount : existing.max_amount,
          method.is_active !== undefined ? method.is_active : existing.is_active,
          method.country !== undefined ? method.country : existing.country,
          method.sort_order !== undefined ? method.sort_order : existing.sort_order,
          method.id
        )
        .run();

      await createAuditLog(env.DB, {
        userId: session.user_id,
        action: 'payment_method.update',
        entityType: 'payment_methods',
        entityId: method.id,
        oldValues: existing,
        newValues: method,
        ipAddress: getClientIp(request),
      });

      const updated = await env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?')
        .bind(method.id)
        .first();

      return json({ success: true, data: { method: updated } });
    }
  }

  if (action === 'delete') {
    if (!body.id) {
      return error('MISSING_FIELDS', 'id is required for delete', 400);
    }

    const existing = await env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?')
      .bind(body.id)
      .first();

    if (!existing) {
      return error('NOT_FOUND', 'Payment method not found', 404);
    }

    await env.DB.prepare('DELETE FROM payment_methods WHERE id = ?').bind(body.id).run();

    await createAuditLog(env.DB, {
      userId: session.user_id,
      action: 'payment_method.delete',
      entityType: 'payment_methods',
      entityId: body.id,
      oldValues: existing as any,
      ipAddress: getClientIp(request),
    });

    return json({ success: true, data: { message: 'Payment method deleted' } });
  }

  return error('INVALID_ACTION', 'Invalid action. Must be create, update, or delete', 400);
}


