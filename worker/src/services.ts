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

export async function handleServicesRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.CACHE, ip, 'services', RATE_LIMITS.api);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  const method = request.method;

  if (path === '/api/services' && method === 'GET') {
    return handleListServices(request, env);
  }

  if (path === '/api/admin/services' && method === 'POST') {
    return handleAdminServices(request, env);
  }

  return error('NOT_FOUND', 'Services endpoint not found', 404);
}

async function handleListServices(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('category_id') || '';
  const appCategory = url.searchParams.get('app_category') || '';
  const search = url.searchParams.get('search') || '';
  const isManual = url.searchParams.get('is_manual');
  const isFazer = url.searchParams.get('is_fazer');
  const active = url.searchParams.get('active') || '1';

  const { page, limit, offset } = parsePagination(request);

  let whereClause = '1=1';
  const bindings: any[] = [];

  if (active === '1') {
    whereClause += ' AND s.is_active = 1';
  }
  if (categoryId) {
    whereClause += ' AND s.category_id = ?';
    bindings.push(categoryId);
  }
  if (appCategory) {
    whereClause += ' AND s.app_category = ?';
    bindings.push(appCategory);
  }
  if (search) {
    whereClause += ' AND (s.name LIKE ? OR s.description LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`);
  }
  if (isManual !== null && isManual !== '') {
    whereClause += ' AND s.is_manual = ?';
    bindings.push(isManual === '1' ? 1 : 0);
  }
  if (isFazer !== null && isFazer !== '') {
    whereClause += ' AND s.is_fazer = ?';
    bindings.push(isFazer === '1' ? 1 : 0);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM services s WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const services = await env.DB.prepare(
    `SELECT s.*, c.name as category_name, c.slug as category_slug
     FROM services s
     LEFT JOIN categories c ON s.category_id = c.id
     WHERE ${whereClause}
     ORDER BY s.sort_order ASC, s.name ASC
     LIMIT ? OFFSET ?`
  )
    .bind(...bindings, limit, offset)
    .all();

  const categories = !categoryId
    ? await env.DB.prepare(
        `SELECT c.*, COUNT(s.id) as service_count
         FROM categories c
         LEFT JOIN services s ON s.category_id = c.id AND s.is_active = 1
         GROUP BY c.id
         ORDER BY c.sort_order ASC`
      ).all()
    : null;

  return json({
    success: true,
    data: {
      services: services.results,
      ...(categories ? { categories: categories.results } : {}),
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function handleAdminServices(request: Request, env: Env): Promise<Response> {
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

  const { action, service } = body;

  if (!action) {
    return error('MISSING_FIELDS', 'action is required (create, update, delete)', 400);
  }

  if (action === 'create' || action === 'update') {
    if (!service || !service.name) {
      return error('MISSING_FIELDS', 'service with name is required', 400);
    }

    if (action === 'create') {
      const id = generateId();
      await env.DB.prepare(
        `INSERT INTO services (id, category_id, provider_id, name, description, service_ref,
          price_usd, price_egp, price_sar, min_quantity, max_quantity, is_active,
          is_manual, is_fazer, app_category, sort_order, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(
          id,
          service.category_id || null,
          service.provider_id || null,
          service.name,
          service.description || null,
          service.service_ref || null,
          service.price_usd || null,
          service.price_egp || null,
          service.price_sar || null,
          service.min_quantity ?? 0,
          service.max_quantity ?? 999999,
          service.is_active !== undefined ? service.is_active : 1,
          service.is_manual !== undefined ? service.is_manual : 0,
          service.is_fazer !== undefined ? service.is_fazer : 0,
          service.app_category || null,
          service.sort_order || 0,
          service.metadata ? JSON.stringify(service.metadata) : '{}'
        )
        .run();

      await createAuditLog(env.DB, {
        userId: session.user_id,
        action: 'service.create',
        entityType: 'services',
        entityId: id,
        newValues: service,
        ipAddress: getClientIp(request),
      });

      const created = await env.DB.prepare('SELECT * FROM services WHERE id = ?')
        .bind(id)
        .first();

      return json({ success: true, data: { service: created } }, 201);
    }

    if (action === 'update') {
      if (!service.id) {
        return error('MISSING_FIELDS', 'service.id is required for update', 400);
      }

      const existing = await env.DB.prepare('SELECT * FROM services WHERE id = ?')
        .bind(service.id)
        .first<any>();

      if (!existing) {
        return error('NOT_FOUND', 'Service not found', 404);
      }

      const fields = [
        'category_id', 'provider_id', 'name', 'description', 'service_ref',
        'price_usd', 'price_egp', 'price_sar', 'min_quantity', 'max_quantity',
        'is_active', 'is_manual', 'is_fazer', 'app_category', 'sort_order',
      ];

      const updates: string[] = [];
      const bindings: any[] = [];

      for (const field of fields) {
        if (service[field] !== undefined) {
          updates.push(`${field} = ?`);
          bindings.push(service[field]);
        }
      }

      if (service.metadata !== undefined) {
        updates.push('metadata = ?');
        bindings.push(typeof service.metadata === 'string' ? service.metadata : JSON.stringify(service.metadata));
      }

      if (updates.length === 0) {
        return error('NO_UPDATES', 'No valid fields to update', 400);
      }

      updates.push('updated_at = datetime(\'now\')');
      bindings.push(service.id);

      await env.DB.prepare(
        `UPDATE services SET ${updates.join(', ')} WHERE id = ?`
      )
        .bind(...bindings)
        .run();

      await createAuditLog(env.DB, {
        userId: session.user_id,
        action: 'service.update',
        entityType: 'services',
        entityId: service.id,
        oldValues: existing,
        newValues: service,
        ipAddress: getClientIp(request),
      });

      const updated = await env.DB.prepare('SELECT * FROM services WHERE id = ?')
        .bind(service.id)
        .first();

      return json({ success: true, data: { service: updated } });
    }
  }

  if (action === 'delete') {
    if (!body.id) {
      return error('MISSING_FIELDS', 'id is required for delete', 400);
    }

    const existing = await env.DB.prepare('SELECT * FROM services WHERE id = ?')
      .bind(body.id)
      .first();

    if (!existing) {
      return error('NOT_FOUND', 'Service not found', 404);
    }

    await env.DB.prepare('DELETE FROM services WHERE id = ?').bind(body.id).run();

    await createAuditLog(env.DB, {
      userId: session.user_id,
      action: 'service.delete',
      entityType: 'services',
      entityId: body.id,
      oldValues: existing as any,
      ipAddress: getClientIp(request),
    });

    return json({ success: true, data: { message: 'Service deleted' } });
  }

  return error('INVALID_ACTION', 'Invalid action. Must be create, update, or delete', 400);
}


