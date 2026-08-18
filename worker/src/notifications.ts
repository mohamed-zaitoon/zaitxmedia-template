import {
  json,
  error,
  generateId,
  requireAuth,
  getClientIp,
  checkRateLimit,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';

export async function handleNotificationsRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.CACHE, ip, 'notifications', RATE_LIMITS.api);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code, e.message, e.status);
  }

  const method = request.method;

  try {
    if (path === '/api/notifications' && method === 'GET') {
      return handleListNotifications(request, env, session);
    }
    if (path.match(/^\/api\/notifications\/[^/]+\/read$/) && method === 'PATCH') {
      return handleMarkRead(request, env, session, path);
    }
    if (path === '/api/notifications/read-all' && method === 'PATCH') {
      return handleMarkAllRead(env, session);
    }
    return error('NOT_FOUND', 'Notifications endpoint not found', 404);
  } catch (e: any) {
    console.error('Notifications error:', e.message);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function handleListNotifications(
  request: Request,
  env: Env,
  session: any
): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;
  const unreadOnly = url.searchParams.get('unread') === '1';

  let whereClause = 'user_id = ?';
  const bindings: any[] = [session.user_id];

  if (unreadOnly) {
    whereClause += ' AND read = 0';
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  const unreadCount = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND read = 0'
  )
    .bind(session.user_id)
    .first<{ total: number }>();

  const notifications = await env.DB.prepare(
    `SELECT * FROM notifications WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...bindings, limit, offset)
    .all();

  return json({
    success: true,
    data: {
      notifications: notifications.results,
      unreadCount: unreadCount?.total || 0,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function handleMarkRead(
  request: Request,
  env: Env,
  session: any,
  path: string
): Promise<Response> {
  const parts = path.split('/');
  const notificationId = parts[3];

  const notification = await env.DB.prepare(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  )
    .bind(notificationId, session.user_id)
    .first();

  if (!notification) {
    return error('NOT_FOUND', 'Notification not found', 404);
  }

  await env.DB.prepare(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?'
  )
    .bind(notificationId, session.user_id)
    .run();

  return json({ success: true, data: { message: 'Notification marked as read' } });
}

async function handleMarkAllRead(env: Env, session: any): Promise<Response> {
  const result = await env.DB.prepare(
    'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0'
  )
    .bind(session.user_id)
    .run();

  return json({
    success: true,
    data: {
      message: 'All notifications marked as read',
      updated: (result.meta as any)?.changes_written || 0,
    },
  });
}


