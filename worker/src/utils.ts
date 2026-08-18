import { Env, SafeUser, SessionWithUser } from './types';

export function generateId(): string {
  return crypto.randomUUID();
}

export function json(data: any, status: number = 200, extraHeaders: Record<string, string> = {}, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': getOriginForCors(request),
      'Access-Control-Allow-Credentials': 'true',
      ...extraHeaders,
    },
  });
}

export function error(code: string, message: string, status: number = 400, request?: Request): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': getOriginForCors(request),
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  );
}

function getOriginForCors(request?: Request): string {
  if (request) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://zaitxmedia.com',
      'https://www.zaitxmedia.com',
      'https://admin.zaitxmedia.com',
      'https://api.zaitxmedia.com',
      'https://zaitxmedia.pages.dev',
      'https://*.zaitxmedia.pages.dev',
      'http://localhost:3000',
      'http://localhost:3100',
    ];
    const allowed = allowedOrigins.some(o => {
      if (o.includes('*')) {
        return new RegExp('^' + o.replace(/\*/g, '.*') + '$').test(origin);
      }
      return o === origin;
    });
    if (allowed) return origin;
  }
  return 'https://zaitxmedia.com';
}

export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}

// Turnstile verification
export async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const data = await res.json() as { success: boolean };
  return data.success === true;
}

// Email sending via Cloudflare Email Service
export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const emailBinding = env.EMAIL as any;
    if (!emailBinding) {
      console.warn('[Email] EMAIL binding not configured');
      return false;
    }
    await emailBinding.send({
      to,
      from: 'noreply@zaitxmedia.com',
      subject,
      html: htmlBody,
    });
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err);
    return false;
  }
}

export function generateEmailVerificationEmail(token: string): string {
  const link = `https://api.zaitxmedia.com/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return `
    <div dir="rtl" style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2>تأكيد البريد الإلكتروني</h2>
      <p>شكراً لتسجيلك في ZAITX MEDIA! الرجاء تأكيد بريدك الإلكتروني بالضغط على الرابط أدناه:</p>
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #44aaff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold;">تأكيد البريد الإلكتروني</a>
      <p style="color: #666; font-size: 12px;">إذا لم تقم بإنشاء حساب، تجاهل هذا البريد.</p>
    </div>`;
}

export function generatePasswordResetEmail(token: string): string {
  const link = `https://zaitxmedia.com/login?reset=${encodeURIComponent(token)}`;
  return `
    <div dir="rtl" style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2>استعادة كلمة المرور</h2>
      <p>تم طلب استعادة كلمة المرور لحسابك في ZAITX MEDIA. اضغط الرابط أدناه لتعيين كلمة مرور جديدة:</p>
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #44aaff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold;">تعيين كلمة مرور جديدة</a>
      <p style="color: #666; font-size: 12px;">الرابط صالح لمدة ساعة واحدة. تجاهل هذا البريد إذا لم تطلب استعادة كلمة المرور.</p>
    </div>`;
}

export async function getUserFromCookie(
  request: Request,
  db: D1Database
): Promise<SessionWithUser | null> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_token=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const tokenHash = await hashToken(token);
  const session = await db
    .prepare(
      `SELECT s.*, u.id as uid, u.email, u.role, u.banned, u.balance_usd, u.full_name,
              u.username, u.whatsapp, u.country, u.preferred_currency,
              u.email_verified, u.name_last_changed_at, u.username_last_changed_at,
              u.country_last_changed_at, u.created_at as user_created_at, u.updated_at as user_updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .bind(tokenHash)
    .first<SessionWithUser>();
  if (!session) return null;
  return session;
}

export async function getUserFromRequest(
  request: Request,
  db: D1Database
): Promise<SessionWithUser | null> {
  return getUserFromCookie(request, db);
}

export async function requireAuth(request: Request, db: D1Database): Promise<SessionWithUser> {
  const user = await getUserFromCookie(request, db);
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
  }
  if (user.banned === 1) {
    throw new AuthError('BANNED', 'Account is banned', 403);
  }
  return user;
}

export async function requireAdmin(request: Request, db: D1Database): Promise<SessionWithUser> {
  const user = await requireAuth(request, db);
  if (user.role !== 'admin') {
    throw new AuthError('FORBIDDEN', 'Admin access required', 403);
  }
  return user;
}

export class AuthError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function createAuditLog(
  db: D1Database,
  params: {
    userId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string | null;
    userAgent?: string | null;
    result?: 'success' | 'failure';
  }
): Promise<void> {
  const id = generateId();
  await db
    .prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      params.userId || null,
      params.action,
      params.entityType || null,
      params.entityId || null,
      JSON.stringify(params.oldValues || {}),
      JSON.stringify(params.newValues || {}),
      params.ipAddress || null,
      params.userAgent || null,
      params.result || 'success'
    )
    .run();
}

export function sanitizeUser(user: any): SafeUser {
  const { password_hash, salt, ...safe } = user;
  return { ...safe, id: safe.id || safe.uid } as SafeUser;
}

export async function createSession(
  db: D1Database,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<string> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const id = generateId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(id, userId, tokenHash, expiresAt, ipAddress, userAgent)
    .run();

  return token;
}

export function sessionCookie(token: string): string {
  return `session_token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`;
}

export function clearSessionCookie(): string {
  return 'session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export type RateLimitConfig = {
  windowSeconds: number;
  maxRequests: number;
};

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { windowSeconds: 60, maxRequests: 5 },
  api: { windowSeconds: 60, maxRequests: 60 },
};

export async function checkRateLimit(
  cache: KVNamespace | undefined | null,
  ip: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<boolean> {
  if (!cache) return true; // Skip rate limiting if KV not configured
  try {
    const key = `ratelimit:${ip}:${endpoint}`;
    const current = await cache.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= config.maxRequests) {
      return false;
    }

    await cache.put(key, String(count + 1), {
      expirationTtl: config.windowSeconds,
    });
    return true;
  } catch {
    return true; // Gracefully skip rate limiting on error
  }
}

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '127.0.0.1';
}

export function parsePagination(request: Request): { page: number; limit: number; offset: number } {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function handleInternalUpload(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get('x-internal-secret');
  const expectedSecret = env.INTERNAL_API_SECRET || 'dev_secret_fallback';
  if (!secret || secret !== expectedSecret) {
    return error('UNAUTHORIZED', 'Invalid internal secret', 401, request);
  }

  if (!env.STORAGE) {
    return error('STORAGE_NOT_CONFIGURED', 'R2 Storage is not configured on this worker', 500, request);
  }

  try {
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const filenameHeader = request.headers.get('x-filename') || 'uploaded_file';
    const cleanFilename = `qr_${Date.now()}_${filenameHeader.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const bodyData = await request.arrayBuffer();

    await env.STORAGE.put(cleanFilename, bodyData, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    const fileUrl = `https://api.zaitxmedia.com/storage/${cleanFilename}`;
    return json({
      success: true,
      url: fileUrl,
    }, 200, {}, request);
  } catch (e: any) {
    console.error('File upload error:', e.message);
    return error('UPLOAD_FAILED', e.message || 'Failed to upload file to R2', 500, request);
  }
}

export async function handleInternalDelete(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get('x-internal-secret');
  const expectedSecret = env.INTERNAL_API_SECRET || 'dev_secret_fallback';
  if (!secret || secret !== expectedSecret) {
    return error('UNAUTHORIZED', 'Invalid internal secret', 401, request);
  }

  if (!env.STORAGE) {
    return error('STORAGE_NOT_CONFIGURED', 'R2 Storage is not configured on this worker', 500, request);
  }

  try {
    let key = request.headers.get('x-file-key') || '';
    if (!key && (request.method === 'POST' || request.method === 'DELETE')) {
      const body = await request.json().catch(() => ({})) as any;
      key = body.key || body.fileKey || body.url || '';
    }

    if (!key) {
      return error('INVALID_KEY', 'No file key provided for deletion', 400, request);
    }

    // Clean key if full URL was passed
    if (key.includes('/storage/')) {
      key = key.substring(key.indexOf('/storage/') + '/storage/'.length);
    }

    await env.STORAGE.delete(key);

    return json({
      success: true,
      deletedKey: key,
    }, 200, {}, request);
  } catch (e: any) {
    console.error('File deletion error:', e.message);
    return error('DELETE_FAILED', e.message || 'Failed to delete file from R2', 500, request);
  }
}
