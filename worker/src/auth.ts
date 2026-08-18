import {
  json,
  error,
  generateId,
  generateToken,
  hashToken,
  sanitizeUser,
  createSession,
  sessionCookie,
  clearSessionCookie,
  getUserFromCookie,
  requireAuth,
  getClientIp,
  checkRateLimit,
  createAuditLog,
  verifyTurnstile,
  sendEmail,
  generateEmailVerificationEmail,
  generatePasswordResetEmail,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';
import { verifyGoogleIdToken } from './google-auth';

async function hashPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ hash: string; salt: string }> {
  if (!salt) salt = crypto.getRandomValues(new Uint8Array(32));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const params = { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' };
  const bits = await crypto.subtle.deriveBits(params, key, 256);
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return { hash, salt: btoa(String.fromCharCode(...salt)) };
}

async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const salt = Uint8Array.from(atob(storedSalt), (c) => c.charCodeAt(0));
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

export async function handleAuthRequest(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(env.CACHE, ip, 'auth', RATE_LIMITS.auth);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  try {
    if (path === '/api/auth/register' && method === 'POST') {
      return handleRegister(request, env);
    }
    if (path === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env);
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      return handleLogout(request, env);
    }
    if (path === '/api/auth/me' && method === 'GET') {
      return handleMe(request, env);
    }
    if (path === '/api/auth/change-password' && method === 'POST') {
      return handleChangePassword(request, env);
    }
    if (path === '/api/auth/forgot-password' && method === 'POST') {
      return handleForgotPassword(request, env);
    }
    if (path === '/api/auth/reset-password' && method === 'POST') {
      return handleResetPassword(request, env);
    }
    if (path === '/api/auth/kinde-sync' && method === 'POST') {
      return handleKindeSync(request, env);
    }
    if (path === '/api/auth/kinde-me' && method === 'GET') {
      return handleKindeMe(request, env);
    }
    if (path === '/api/auth/appwrite-sync' && method === 'POST') {
      return handleAppwriteSync(request, env);
    }
    if (path === '/api/auth/verify-email' && method === 'GET') {
      return handleVerifyEmail(request, env);
    }
    if (path === '/api/auth/google' && method === 'POST') {
      return handleGoogleAuth(request, env);
    }
    if (path === '/api/auth/link-google' && method === 'POST') {
      return handleLinkGoogle(request, env);
    }
    if (path === '/api/auth/unlink-google' && method === 'POST') {
      return handleUnlinkGoogle(request, env);
    }
    if (path === '/api/auth/auth-accounts' && method === 'GET') {
      return handleListAuthAccounts(request, env);
    }
    if (path === '/api/auth/sessions' && method === 'GET') {
      return handleListSessions(request, env);
    }
    if (path === '/api/auth/sessions' && method === 'DELETE') {
      return handleRevokeAllSessions(request, env);
    }
    if (path.startsWith('/api/auth/sessions/') && method === 'DELETE') {
      return handleRevokeSession(request, env, path);
    }
    return error('NOT_FOUND', 'Auth endpoint not found', 404);
  } catch (e: any) {
    console.error('Auth error:', e.message);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { email, password, full_name, turnstile_token } = body;

  if (!email || !password) {
    return error('MISSING_FIELDS', 'Email and password are required', 400);
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return error('INVALID_EMAIL', 'Invalid email address', 400);
  }

  if (typeof password !== 'string' || password.length < 6) {
    return error('WEAK_PASSWORD', 'Password must be at least 6 characters', 400);
  }

  // Verify Turnstile if secret is configured
  if (env.TURNSTILE_SECRET) {
    if (!turnstile_token) {
      return error('TURNSTILE_REQUIRED', 'Turnstile verification required', 400);
    }
    const valid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET);
    if (!valid) {
      return error('TURNSTILE_FAILED', 'Turnstile verification failed', 400);
    }
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return error('EMAIL_EXISTS', 'An account with this email already exists', 409);
  }

  const { hash, salt } = await hashPassword(password);
  const id = generateId();
  const ip = getClientIp(request);

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, salt, full_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  )
    .bind(id, email, hash, salt, full_name || null)
    .run();

  // Create email verification token
  const evToken = generateToken();
  const evTokenHash = await hashToken(evToken);
  const evId = generateId();
  const evExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(evId, id, evTokenHash, evExpires).run();

  // Send verification email
  await sendEmail(env, email, 'تأكيد البريد الإلكتروني - ZAITX MEDIA', generateEmailVerificationEmail(evToken));

  await createAuditLog(env.DB, {
    userId: id,
    action: 'user.register',
    entityType: 'users',
    entityId: id,
    ipAddress: ip,
    userAgent: request.headers.get('User-Agent') || null,
  });

  const token = await createSession(
    env.DB, id, ip, request.headers.get('User-Agent') || null
  );

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  const safeUser = sanitizeUser(user);

  return json(
    { success: true, data: { user: safeUser } },
    201,
    { 'Set-Cookie': sessionCookie(token) }
  );
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { email, password, turnstile_token } = body;

  if (!email || !password) {
    return error('MISSING_FIELDS', 'Email and password are required', 400);
  }

  // Verify Turnstile if secret is configured (after rate limiting suggests bot activity)
  if (env.TURNSTILE_SECRET && turnstile_token) {
    const valid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET);
    if (!valid) {
      return error('TURNSTILE_FAILED', 'Turnstile verification failed', 400);
    }
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<any>();
  if (!user) {
    return error('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  if (user.banned === 1) {
    return error('BANNED', 'Account is banned', 403);
  }

  const valid = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    await createAuditLog(env.DB, {
      userId: user.id,
      action: 'user.login.failed',
      entityType: 'users',
      entityId: user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('User-Agent') || null,
      result: 'failure',
    });
    return error('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const ip = getClientIp(request);
  const token = await createSession(
    env.DB,
    user.id,
    ip,
    request.headers.get('User-Agent') || null
  );

  await createAuditLog(env.DB, {
    userId: user.id,
    action: 'user.login',
    entityType: 'users',
    entityId: user.id,
    ipAddress: ip,
    userAgent: request.headers.get('User-Agent') || null,
  });

  const safeUser = sanitizeUser(user);

  return json(
    { success: true, data: { user: safeUser } },
    200,
    { 'Set-Cookie': sessionCookie(token) }
  );
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_token=([^;]+)/);

  if (match) {
    const tokenHash = await hashToken(match[1]);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  return json(
    { success: true, data: { message: 'Logged out' } },
    200,
    { 'Set-Cookie': clearSessionCookie() }
  );
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await getUserFromCookie(request, env.DB);
  if (!session) {
    return error('UNAUTHORIZED', 'Not authenticated', 401);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<any>();

  if (!user) {
    return error('NOT_FOUND', 'User not found', 404);
  }

  if (user.banned === 1) {
    return error('BANNED', 'Account is banned', 403);
  }

  const safeUser = sanitizeUser(user);
  return json({ success: true, data: { user: safeUser } });
}

async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  const session = await requireAuth(request, env.DB).catch((e) => null);
  if (!session) {
    return error('UNAUTHORIZED', 'Authentication required', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { current_password, new_password } = body;

  if (!current_password || !new_password) {
    return error('MISSING_FIELDS', 'Current password and new password are required', 400);
  }

  if (typeof new_password !== 'string' || new_password.length < 6) {
    return error('WEAK_PASSWORD', 'New password must be at least 6 characters', 400);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<any>();

  if (!user) {
    return error('NOT_FOUND', 'User not found', 404);
  }

  const valid = await verifyPassword(current_password, user.password_hash, user.salt);
  if (!valid) {
    return error('INVALID_PASSWORD', 'Current password is incorrect', 400);
  }

  const { hash, salt } = await hashPassword(new_password);

  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(hash, salt, user.id)
    .run();

  await createAuditLog(env.DB, {
    userId: user.id,
    action: 'user.change_password',
    entityType: 'users',
    entityId: user.id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { message: 'Password changed successfully' } });
}

async function handleForgotPassword(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { email, turnstile_token } = body;
  if (!email) {
    return error('MISSING_FIELDS', 'Email is required', 400);
  }

  // Verify Turnstile if configured
  if (env.TURNSTILE_SECRET) {
    if (!turnstile_token) {
      return error('TURNSTILE_REQUIRED', 'Turnstile verification required', 400);
    }
    const valid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET);
    if (!valid) {
      return error('TURNSTILE_FAILED', 'Turnstile verification failed', 400);
    }
  }

  const user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?')
    .bind(email)
    .first<any>();

  if (!user) {
    return json({ success: true, data: { message: 'If the email exists, a reset link has been sent' } });
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const id = generateId();

  await env.DB.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(id, user.id, tokenHash, expiresAt)
    .run();

  // Send reset email
  await sendEmail(env, email, 'استعادة كلمة المرور - ZAITX MEDIA', generatePasswordResetEmail(token));

  await createAuditLog(env.DB, {
    userId: user.id,
    action: 'user.forgot_password',
    entityType: 'users',
    entityId: user.id,
    ipAddress: getClientIp(request),
  });

  return json({
    success: true,
    data: {
      message: 'If the email exists, a reset link has been sent',
      ...(env.ENVIRONMENT !== 'production' ? { reset_token: token } : {}),
    },
  });
}

async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { token, new_password } = body;

  if (!token || !new_password) {
    return error('MISSING_FIELDS', 'Token and new password are required', 400);
  }

  if (typeof new_password !== 'string' || new_password.length < 6) {
    return error('WEAK_PASSWORD', 'New password must be at least 6 characters', 400);
  }

  const tokenHash = await hashToken(token);

  const resetRecord = await env.DB.prepare(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = ? AND expires_at > datetime('now') AND used = 0`
  )
    .bind(tokenHash)
    .first<any>();

  if (!resetRecord) {
    return error('INVALID_TOKEN', 'Invalid or expired reset token', 400);
  }

  const { hash, salt } = await hashPassword(new_password);

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(hash, salt, resetRecord.user_id),
    env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
      .bind(resetRecord.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
      .bind(resetRecord.user_id),
  ]);

  await createAuditLog(env.DB, {
    userId: resetRecord.user_id,
    action: 'user.reset_password',
    entityType: 'users',
    entityId: resetRecord.user_id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { message: 'Password reset successfully. Please log in again.' } });
}

async function handleVerifyEmail(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return error('MISSING_TOKEN', 'Verification token is required', 400);
  }

  const tokenHash = await hashToken(token);

  const record = await env.DB.prepare(
    `SELECT * FROM email_verification_tokens
     WHERE token_hash = ? AND expires_at > datetime('now')`
  )
    .bind(tokenHash)
    .first<any>();

  if (!record) {
    return error('INVALID_TOKEN', 'Invalid or expired verification token', 400);
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(record.user_id),
    env.DB.prepare('DELETE FROM email_verification_tokens WHERE id = ?')
      .bind(record.id),
  ]);

  await createAuditLog(env.DB, {
    userId: record.user_id,
    action: 'user.verify_email',
    entityType: 'users',
    entityId: record.user_id,
    ipAddress: getClientIp(request),
  });

  return json({ success: true, data: { message: 'Email verified successfully' } });
}

async function handleListSessions(request: Request, env: Env): Promise<Response> {
  const session = await requireAuth(request, env.DB).catch(() => null);
  if (!session) {
    return error('UNAUTHORIZED', 'Authentication required', 401);
  }

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_token=([^;]+)/);
  const currentTokenHash = match ? await hashToken(match[1]) : null;

  const sessions = await env.DB.prepare(
    `SELECT id, ip_address, user_agent, created_at, expires_at,
            CASE WHEN token_hash = ? THEN 1 ELSE 0 END as is_current
     FROM sessions
     WHERE user_id = ? AND expires_at > datetime('now')
     ORDER BY created_at DESC`
  )
    .bind(currentTokenHash || '', session.user_id)
    .all();

  return json({ success: true, data: { sessions: sessions.results } });
}

async function handleRevokeSession(request: Request, env: Env, path: string): Promise<Response> {
  const session = await requireAuth(request, env.DB).catch(() => null);
  if (!session) {
    return error('UNAUTHORIZED', 'Authentication required', 401);
  }

  const sessionId = path.split('/').pop();

  if (!sessionId) {
    return error('INVALID_ID', 'Session ID is required', 400);
  }

  const targetSession = await env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND user_id = ?'
  )
    .bind(sessionId, session.user_id)
    .first();

  if (!targetSession) {
    return error('NOT_FOUND', 'Session not found', 404);
  }

  await env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, session.user_id)
    .run();

  return json({ success: true, data: { message: 'Session revoked' } });
}

async function handleRevokeAllSessions(request: Request, env: Env): Promise<Response> {
  const session = await requireAuth(request, env.DB).catch(() => null);
  if (!session) {
    return error('UNAUTHORIZED', 'Authentication required', 401);
  }

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_token=([^;]+)/);
  const currentTokenHash = match ? await hashToken(match[1]) : null;

  await env.DB.prepare(
    'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?'
  )
    .bind(session.user_id, currentTokenHash || '')
    .run();

  return json({ success: true, data: { message: 'All other sessions revoked' } });
}

// ─── Google OAuth Handlers ───────────────────────────────────────────────────

async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { id_token, csrf_token } = body;

  if (!id_token) {
    return error('MISSING_FIELDS', 'Google ID token is required', 400);
  }

  // Verify CSRF token (stored in a cookie before redirect)
  if (csrf_token) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/g_csrf_token=([^;]+)/);
    const storedCsrf = match ? match[1] : null;
    if (!storedCsrf || storedCsrf !== csrf_token) {
      return error('CSRF_MISMATCH', 'CSRF token mismatch', 403);
    }
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return error('CONFIG_ERROR', 'Google Client ID not configured', 500);
  }

  // Verify Google ID Token
  let payload;
  try {
    payload = await verifyGoogleIdToken(id_token, clientId);
  } catch (e: any) {
    return error('GOOGLE_AUTH_FAILED', 'Google authentication failed: ' + e.message, 401);
  }

  const googleSub = payload.sub;
  const googleEmail = payload.email || null;
  const googleName = payload.name || null;
  const googlePicture = payload.picture || null;
  const emailVerified = payload.email_verified ? 1 : 0;
  const ip = getClientIp(request);
  const userAgent = request.headers.get('User-Agent') || null;

  // Check if Google account already linked
  const existingAccount = await env.DB.prepare(
    'SELECT * FROM auth_accounts WHERE provider = ? AND provider_user_id = ?'
  ).bind('google', googleSub).first<{ id: string; user_id: string }>();

  let userId: string;

  if (existingAccount) {
    // Existing Google account - login
    userId = existingAccount.user_id;

    // Update Google account info
    await env.DB.prepare(
      `UPDATE auth_accounts SET provider_email = ?, provider_email_verified = ?, provider_name = ?, provider_avatar_url = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(googleEmail, emailVerified, googleName, googlePicture, existingAccount.id).run();

    // Update user info
    await env.DB.prepare(
      `UPDATE users SET email = COALESCE(?, email), full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now')
       WHERE id = ?`
    ).bind(googleEmail, googleName, googlePicture, userId).run();
  } else {
    // New Google account - create user
    userId = generateId();

    await env.DB.prepare(
      `INSERT INTO users (id, email, email_verified, full_name, avatar_url, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'user', datetime('now'), datetime('now'))`
    ).bind(userId, googleEmail, emailVerified, googleName, googlePicture).run();

    // Create auth account link
    const authAccountId = generateId();
    await env.DB.prepare(
      `INSERT INTO auth_accounts (id, user_id, provider, provider_user_id, provider_email, provider_email_verified, provider_name, provider_avatar_url, created_at, updated_at)
       VALUES (?, ?, 'google', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(authAccountId, userId, googleSub, googleEmail, emailVerified, googleName, googlePicture).run();

    await createAuditLog(env.DB, {
      userId,
      action: 'user.register.google',
      entityType: 'users',
      entityId: userId,
      ipAddress: ip,
      userAgent,
    });
  }

  // Check if user is banned
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>();
  if (user?.banned === 1) {
    return error('BANNED', 'Account is banned', 403);
  }

  // Create session
  const token = await createSession(env.DB, userId, ip, userAgent);

  await createAuditLog(env.DB, {
    userId,
    action: 'user.login.google',
    entityType: 'users',
    entityId: userId,
    ipAddress: ip,
    userAgent,
  });

  const safeUser = sanitizeUser(user);

  // Clear CSRF cookie
  const clearCsrf = 'g_csrf_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

  return json(
    { success: true, data: { user: safeUser }, isNewUser: !existingAccount },
    200,
    { 'Set-Cookie': `${sessionCookie(token)}, ${clearCsrf}` }
  );
}

// Link Google to existing account (user must be logged in)
async function handleLinkGoogle(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code || 'UNAUTHORIZED', e.message, e.status || 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { id_token, csrf_token } = body;

  if (!id_token) {
    return error('MISSING_FIELDS', 'Google ID token is required', 400);
  }

  if (csrf_token) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/g_csrf_token=([^;]+)/);
    const storedCsrf = match ? match[1] : null;
    if (!storedCsrf || storedCsrf !== csrf_token) {
      return error('CSRF_MISMATCH', 'CSRF token mismatch', 403);
    }
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return error('CONFIG_ERROR', 'Google Client ID not configured', 500);
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(id_token, clientId);
  } catch (e: any) {
    return error('GOOGLE_AUTH_FAILED', 'Google authentication failed', 401);
  }

  // Check if this Google account is already linked to another user
  const existingLink = await env.DB.prepare(
    'SELECT * FROM auth_accounts WHERE provider = ? AND provider_user_id = ?'
  ).bind('google', payload.sub).first();

  if (existingLink && existingLink.user_id !== session.user_id) {
    return error('ALREADY_LINKED', 'This Google account is already linked to another user', 409);
  }

  if (existingLink && existingLink.user_id === session.user_id) {
    return error('ALREADY_LINKED', 'This Google account is already linked to your account', 409);
  }

  // Check email conflict (Google email matches existing user but different sub)
  if (payload.email) {
    const emailUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(payload.email, session.user_id).first();
    if (emailUser) {
      return error('EMAIL_CONFLICT', 'An account with this email already exists. Please login with that account first.', 409);
    }
  }

  // Link
  const authAccountId = generateId();
  await env.DB.prepare(
    `INSERT INTO auth_accounts (id, user_id, provider, provider_user_id, provider_email, provider_email_verified, provider_name, provider_avatar_url, created_at, updated_at)
     VALUES (?, ?, 'google', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(authAccountId, session.user_id, payload.sub, payload.email || null, payload.email_verified ? 1 : 0, payload.name || null, payload.picture || null).run();

  // Update user if name/picture is missing
  if (!session.full_name && payload.name) {
    await env.DB.prepare('UPDATE users SET full_name = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(payload.name, session.user_id).run();
  }

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'user.link_google',
    entityType: 'auth_accounts',
    entityId: authAccountId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { message: 'Google account linked successfully' } });
}

// Unlink Google from current account
async function handleUnlinkGoogle(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code || 'UNAUTHORIZED', e.message, e.status || 401);
  }

  // Check that user has another login method (password or other auth accounts)
  const hasPassword = await env.DB.prepare(
    'SELECT password_hash FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>();

  const otherAuthAccounts = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM auth_accounts WHERE user_id = ? AND provider != \'google\''
  ).bind(session.user_id).first<any>();

  const googleAccount = await env.DB.prepare(
    'SELECT * FROM auth_accounts WHERE user_id = ? AND provider = \'google\''
  ).bind(session.user_id).first<any>();

  if (!googleAccount) {
    return error('NOT_FOUND', 'No Google account linked', 404);
  }

  if (!hasPassword?.password_hash && (!otherAuthAccounts || otherAuthAccounts.count === 0)) {
    return error('LAST_METHOD', 'You must set a password or link another login method before unlinking Google', 400);
  }

  await env.DB.prepare(
    'DELETE FROM auth_accounts WHERE id = ?'
  ).bind(googleAccount.id).run();

  await createAuditLog(env.DB, {
    userId: session.user_id,
    action: 'user.unlink_google',
    entityType: 'auth_accounts',
    entityId: googleAccount.id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { message: 'Google account unlinked' } });
}

// List auth accounts for current user
async function handleListAuthAccounts(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code || 'UNAUTHORIZED', e.message, e.status || 401);
  }

  const accounts = await env.DB.prepare(
    `SELECT id, provider, provider_email, provider_email_verified, provider_name, provider_avatar_url, created_at
     FROM auth_accounts WHERE user_id = ?`
  ).bind(session.user_id).all();

  const hasPassword = await env.DB.prepare(
    'SELECT password_hash FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>();

  return json({
    success: true,
    data: {
      accounts: accounts.results,
      hasPassword: !!hasPassword?.password_hash,
    },
  });
}

// ─── Kinde Auth Sync ────────────────────────────────────────────────────────

async function handleKindeSync(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { kinde_user_id, email, name, image_url } = body;

  if (!kinde_user_id) {
    return error('MISSING_FIELDS', 'kinde_user_id is required', 400);
  }

  // Find or create user
  let user = await env.DB.prepare("SELECT * FROM users WHERE kinde_user_id = ?")
    .bind(kinde_user_id)
    .first<any>();

  if (!user) {
    const id = generateId();
    await env.DB.prepare(
      `INSERT INTO users (id, kinde_user_id, email, full_name, avatar_url, role, status, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', datetime('now'), datetime('now'), datetime('now'))`
    )
      .bind(id, kinde_user_id, email || null, name || null, image_url || null)
      .run();

    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
  } else {
    await env.DB.prepare(
      `UPDATE users SET email = COALESCE(?, email), full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), last_login_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(email || null, name || null, image_url || null, user.id)
      .run();

    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<any>();
  }

  const safeUser = sanitizeUser(user);

  await createAuditLog(env.DB, {
    userId: user.id,
    action: 'user.kinde_sync',
    entityType: 'users',
    entityId: user.id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { user: safeUser } });
}

async function handleKindeMe(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { kinde_user_id } = body;

  if (!kinde_user_id) {
    return error('MISSING_FIELDS', 'kinde_user_id is required', 400);
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE kinde_user_id = ?")
    .bind(kinde_user_id)
    .first<any>();

  if (!user) {
    return error('NOT_FOUND', 'User not found', 404);
  }

  return json({ success: true, data: { user: sanitizeUser(user) } });
}

// ─── Appwrite Auth Sync ────────────────────────────────────────────────────

async function handleAppwriteSync(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Invalid request body', 400);
  }

  const { appwrite_user_id, email, name } = body;

  if (!appwrite_user_id) {
    return error('MISSING_FIELDS', 'appwrite_user_id is required', 400);
  }

  // Find or create user
  let user = await env.DB.prepare("SELECT * FROM users WHERE appwrite_user_id = ?")
    .bind(appwrite_user_id)
    .first<any>();

  if (!user) {
    const id = generateId();
    await env.DB.prepare(
      `INSERT INTO users (id, appwrite_user_id, email, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', datetime('now'), datetime('now'))`
    )
      .bind(id, appwrite_user_id, email || null, name || null)
      .run();

    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
  } else {
    await env.DB.prepare(
      `UPDATE users SET email = COALESCE(?, email), full_name = COALESCE(?, full_name), updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(email || null, name || null, user.id)
      .run();

    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<any>();
  }

  const safeUser = sanitizeUser(user);

  await createAuditLog(env.DB, {
    userId: user.id,
    action: 'user.appwrite_sync',
    entityType: 'users',
    entityId: user.id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || null,
  });

  return json({ success: true, data: { user: safeUser } });
}


