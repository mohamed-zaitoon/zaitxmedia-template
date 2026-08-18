const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://zaitxmedia-api.zaitxmedia.workers.dev";

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  turnstileToken?: string,
) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, turnstile_token: turnstileToken }),
  });
  return res.json();
}

export async function login(
  email: string,
  password: string,
  turnstileToken?: string,
) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, turnstile_token: turnstileToken }),
  });
  return res.json();
}

export async function logout() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  const res = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.json();
}

export async function forgotPassword(email: string, turnstileToken?: string) {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, turnstile_token: turnstileToken }),
  });
  return res.json();
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  return res.json();
}

export async function listSessions() {
  const res = await fetch(`${API_BASE}/api/auth/sessions`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function revokeSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/auth/sessions/${sessionId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}

export async function revokeAllSessions() {
  const res = await fetch(`${API_BASE}/api/auth/sessions`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}

// ─── Google Auth ───────────────────────────────────────────────────────────

export async function googleAuth(idToken: string, csrfToken?: string) {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id_token: idToken, csrf_token: csrfToken }),
  });
  return res.json();
}

export async function linkGoogle(idToken: string, csrfToken?: string) {
  const res = await fetch(`${API_BASE}/api/auth/link-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id_token: idToken, csrf_token: csrfToken }),
  });
  return res.json();
}

export async function unlinkGoogle() {
  const res = await fetch(`${API_BASE}/api/auth/unlink-google`, {
    method: "POST",
    credentials: "include",
  });
  return res.json();
}

export async function listAuthAccounts() {
  const res = await fetch(`${API_BASE}/api/auth/auth-accounts`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

// ─── User Profile ──────────────────────────────────────────────────────────

export async function updateProfile(data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/admin/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Orders ────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  serviceId: string;
  quantity: number;
  options: {
    currency?: "EGP" | "SAR" | "USD";
    link?: string;
    country?: string;
    paymentMethod?: string;
    proofOfPayment?: string;
    isGame?: boolean;
  };
  idempotencyKey: string;
}

export async function createOrder(data: CreateOrderInput) {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function createOrderFromBalance(data: CreateOrderInput) {
  const res = await fetch(`${API_BASE}/api/orders/from-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function listMyOrders() {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function getOrder(id: string) {
  const res = await fetch(`${API_BASE}/api/orders/${id}`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

// ─── Recharge ──────────────────────────────────────────────────────────────

export async function createRecharge(data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/recharge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function listMyRecharges() {
  const res = await fetch(`${API_BASE}/api/recharge`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

// ─── Notifications ─────────────────────────────────────────────────────────

export async function listNotifications() {
  const res = await fetch(`${API_BASE}/api/notifications`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function markNotificationRead(id: string) {
  const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: "PATCH",
    credentials: "include",
  });
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: "PATCH",
    credentials: "include",
  });
  return res.json();
}

// ─── Settings ──────────────────────────────────────────────────────────────

export async function getSettings() {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function getPricing() {
  const res = await fetch(`${API_BASE}/api/settings/pricing`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function getPaymentMethods() {
  const res = await fetch(`${API_BASE}/api/settings/payment-methods`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

// ─── Services ──────────────────────────────────────────────────────────────

export async function listServices(params?: {
  category?: string;
  appCategory?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.category) sp.set("category_id", params.category);
  if (params?.appCategory) sp.set("app_category", params.appCategory);
  const qs = sp.toString();
  const res = await fetch(`${API_BASE}/api/services${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function adminListUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function adminGetUser(id: string) {
  const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function adminUpdateUser(
  id: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminListOrders(params?: {
  status?: string;
  userId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.userId) sp.set("userId", params.userId);
  if (params?.type) sp.set("type", params.type);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  const res = await fetch(`${API_BASE}/api/admin/orders${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function adminUpdateOrder(
  id: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/api/admin/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminUpdateSetting(key: string, value: unknown) {
  const res = await fetch(`${API_BASE}/api/settings/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ value }),
  });
  return res.json();
}

export async function adminAddPricing(pricing: {
  category: string;
  min: number;
  max: number;
  pricePer1000: number;
}) {
  const res = await fetch(`${API_BASE}/api/admin/pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(pricing),
  });
  return res.json();
}

export async function adminUpdatePricing(
  id: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/api/admin/pricing/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminDeletePricing(id: string) {
  const res = await fetch(`${API_BASE}/api/admin/pricing/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}

export async function adminAddPaymentMethod(method: {
  type: string;
  label?: string;
  number?: string;
  name?: string;
  link?: string;
  minAmount?: number;
  maxAmount?: number;
  country?: string;
}) {
  const res = await fetch(`${API_BASE}/api/admin/payment-methods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(method),
  });
  return res.json();
}

export async function adminUpdatePaymentMethod(
  id: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/api/admin/payment-methods/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminDeletePaymentMethod(id: string) {
  const res = await fetch(`${API_BASE}/api/admin/payment-methods/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}

export async function adminAddService(service: {
  name: string;
  categoryId?: string;
  description?: string;
  priceEgp?: number;
  priceSar?: number;
  isManual?: boolean;
  appCategory?: string;
}) {
  const res = await fetch(`${API_BASE}/api/admin/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(service),
  });
  return res.json();
}

export async function adminUpdateService(
  id: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/api/admin/services/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminDeleteService(id: string) {
  const res = await fetch(`${API_BASE}/api/admin/services/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}

export async function adminGetStats() {
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}

export async function adminGetAuditLogs(params?: {
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  const res = await fetch(
    `${API_BASE}/api/admin/audit-logs${qs ? `?${qs}` : ""}`,
    { method: "GET", credentials: "include" },
  );
  return res.json();
}

export async function adminRevokeUserSessions(userId: string) {
  const res = await fetch(`${API_BASE}/api/admin/sessions/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
}
