export interface User {
  id: string;
  kinde_user_id: string | null;
  appwrite_user_id: string | null;
  email: string;
  email_verified: number;
  password_hash: string | null;
  salt: string | null;
  full_name: string | null;
  username: string | null;
  whatsapp: string | null;
  country: 'EG' | 'SA' | 'OTHER' | null;
  preferred_currency: 'USD' | 'EGP' | 'SAR' | 'auto';
  role: 'user' | 'admin' | 'provider';
  banned: number;
  status: 'active' | 'banned';
  balance_usd: number;
  name_last_changed_at: string | null;
  username_last_changed_at: string | null;
  country_last_changed_at: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, 'password_hash' | 'salt'>;

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SessionWithUser extends Session {
  uid?: string;
  email?: string;
  role?: string;
  banned?: number;
  balance_usd?: number;
  full_name?: string;
  username?: string;
  whatsapp?: string;
  country?: string;
  preferred_currency?: string;
}

export interface Order {
  id: string;
  user_id: string;
  service_id: string | null;
  service_name: string;
  is_game: number;
  quantity: number;
  price: number;
  currency: 'EGP' | 'SAR' | 'USD';
  name: string | null;
  link: string | null;
  country: string | null;
  payment_method: string;
  proof_of_payment: string | null;
  user_whatsapp: string | null;
  full_name: string | null;
  username: string | null;
  user_email: string | null;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled' | 'refunded';
  type: 'order' | 'recharge';
  balance_category: string | null;
  admin_notes: string | null;
  webhook_data: string;
  rejection_reason: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  realized_profit_usd: number | null;
  profit_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  read: number;
  type: string;
  created_at: string;
}

export interface Service {
  id: string;
  category_id: string | null;
  provider_id: string | null;
  name: string;
  description: string | null;
  service_ref: string | null;
  price_usd: number | null;
  price_egp: number | null;
  price_sar: number | null;
  min_quantity: number;
  max_quantity: number;
  is_active: number;
  is_manual: number;
  is_fazer: number;
  app_category: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PriceTier {
  id: string;
  category: string;
  min: number;
  max: number;
  price_per_1000: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  type: 'wallet' | 'instapay' | 'barq' | 'binance';
  label: string | null;
  number: string | null;
  name: string | null;
  link: string | null;
  min_amount: number | null;
  max_amount: number | null;
  is_active: number;
  country: 'EG' | 'SA' | 'OTHER' | null;
  sort_order: number;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  order_id: string | null;
  amount_usd: number;
  type: 'credit' | 'debit' | 'refund';
  description: string | null;
  balance_before: number | null;
  balance_after: number | null;
  performed_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: string;
  new_values: string;
  ip_address: string | null;
  user_agent: string | null;
  result: string;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export interface SmsWebhookEvent {
  id: string;
  message_hash: string;
  phone_number: string | null;
  amount: number | null;
  transaction_id: string | null;
  raw_text: string | null;
  parsed_data: string;
  status: string;
  order_id: string | null;
  user_id: string | null;
  reason: string | null;
  webhook_source: string | null;
  created_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  STORAGE?: R2Bucket;
  EMAIL?: any;
  ORDERS_QUEUE?: any;
  ENVIRONMENT?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  SMMX_API_KEY?: string;
  SMS_WEBHOOK_HMAC_SECRET?: string;
  SMS_WEBHOOK_SECRET?: string;
  INTERNAL_API_SECRET?: string;
  CRON_SECRET?: string;
  PAYMENT_VERIFICATION_DELAY_SECONDS?: string;
  PROVIDER_WEBHOOK_HMAC_SECRET?: string;
  BINANCE_PAY_API_KEY?: string;
  BINANCE_PAY_SECRET?: string;
  BINANCE_PAY_RECIPIENT_ID?: string;
  ONESIGNAL_APP_ID?: string;
  ONESIGNAL_REST_API_KEY?: string;
  CORS_ORIGIN?: string;
}
