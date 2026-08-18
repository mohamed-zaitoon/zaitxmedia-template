import {
  json,
  error,
  requireAdmin,
  getClientIp,
  checkRateLimit,
  RATE_LIMITS,
} from './utils';
import { Env } from './types';

export async function handleFinancialRequest(
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
  if (method !== 'GET') {
    return error('METHOD_NOT_ALLOWED', 'Only GET requests are allowed', 405);
  }

  const url = new URL(request.url);
  const normalizedPath = path.replace(/\/$/, '');

  try {
    if (normalizedPath === '/v1/financial/overview') {
      return handleFinancialOverview(env, session);
    }
    if (normalizedPath === '/v1/financial/orders') {
      return handleFinancialOrders(env, session, url);
    }
    if (normalizedPath === '/v1/financial/deposits') {
      return handleFinancialDeposits(env, session, url);
    }
    if (normalizedPath === '/v1/financial/customers') {
      return handleFinancialCustomers(env, session, url);
    }
    if (normalizedPath === '/v1/financial/transactions') {
      return handleFinancialTransactions(env, session, url);
    }
    if (normalizedPath === '/v1/financial/profits') {
      return handleFinancialProfits(env, session, url);
    }

    return error('NOT_FOUND', 'Financial endpoint not found', 404);
  } catch (e: any) {
    console.error('Financial error:', e.message);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function handleFinancialOverview(env: Env, session: any): Promise<Response> {
  const [
    totalUsers,
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    totalRevenue,
    totalBalance,
    totalRefunds,
    depositsStats,
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) as total FROM orders').first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) as total FROM orders WHERE status = 'completed'").first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) as total FROM orders WHERE status = 'pending' OR status = 'processing'").first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) as total FROM orders WHERE status = 'cancelled' OR status = 'rejected'").first<{ total: number }>(),
    env.DB.prepare("SELECT COALESCE(SUM(price), 0) as total FROM orders WHERE status = 'completed' AND payment_method = 'wallet'").first<{ total: number }>(),
    env.DB.prepare('SELECT COALESCE(SUM(balance_usd), 0) as total FROM users').first<{ total: number }>(),
    env.DB.prepare("SELECT COALESCE(SUM(amount_usd), 0) as total FROM wallet_transactions WHERE type = 'refund'").first<{ total: number }>(),
    env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' OR status = 'verified' THEN credited_usd ELSE 0 END), 0) as totalCreditedUsd,
        COALESCE(SUM(CASE WHEN status = 'approved' OR status = 'verified' THEN net_deposit_egp ELSE 0 END), 0) as totalNetEgp,
        COALESCE(SUM(CASE WHEN status = 'approved' OR status = 'verified' THEN deposit_fee_egp ELSE 0 END), 0) as totalFeesEgp
      FROM recharges
    `).first<{ totalCreditedUsd: number; totalNetEgp: number; totalFeesEgp: number }>(),
  ]);

  // Get order profits
  const orderProfits = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(COALESCE(sale_amount_usd, 0) - COALESCE(supplier_cost_usd, 0)), 0) as totalProfitUsd,
      COALESCE(SUM(COALESCE(sale_amount_usd, 0)), 0) as totalSalesUsd
    FROM orders
    WHERE status = 'completed'
  `).first<{ totalProfitUsd: number; totalSalesUsd: number }>();

  return json({
    success: true,
    data: {
      customerBalances: {
        USD: { total: totalBalance?.total || 0 },
        EGP: { total: (totalBalance?.total || 0) * 50 },
        SAR: { total: (totalBalance?.total || 0) * 3.75 },
      },
      customersWithBalance: totalUsers?.total || 0,
      orders: {
        totalCount: totalOrders?.total || 0,
        completedCount: completedOrders?.total || 0,
        pendingCount: pendingOrders?.total || 0,
        cancelledCount: cancelledOrders?.total || 0,
        sales: { USD: orderProfits?.totalSalesUsd || 0 },
        profits: { USD: orderProfits?.totalProfitUsd || 0 },
      },
      deposits: {
        totalPaid: { EGP: depositsStats?.totalNetEgp || 0 },
        feesCollected: { EGP: depositsStats?.totalFeesEgp || 0 },
        totalCredited: { USD: depositsStats?.totalCreditedUsd || 0 },
        netProfit: { EGP: depositsStats?.totalFeesEgp || 0 },
      },
      totalRefundsUsd: totalRefunds?.total || 0,
    },
  });
}

async function handleFinancialOrders(env: Env, session: any, url: URL): Promise<Response> {
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  const orders = await env.DB.prepare(`
    SELECT
      o.id, o.user_id, o.service_name, o.price, o.currency, o.status,
      o.sale_amount_usd, o.supplier_cost_usd,
      COALESCE(o.sale_amount_usd, 0) - COALESCE(o.supplier_cost_usd, 0) as net_profit_usd,
      o.created_at, o.updated_at,
      u.email as user_email, u.full_name as user_name
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<any>();

  return json({
    success: true,
    data: orders.results.map(o => ({
      id: o.id,
      userId: o.user_id,
      userName: o.user_name || o.user_email || '—',
      serviceName: o.service_name,
      saleAmountUsd: o.sale_amount_usd || 0,
      supplierCostUsd: o.supplier_cost_usd || 0,
      netProfitUsd: o.net_profit_usd || 0,
      status: o.status,
      createdAt: o.created_at,
    })),
  });
}

async function handleFinancialDeposits(env: Env, session: any, url: URL): Promise<Response> {
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  const deposits = await env.DB.prepare(`
    SELECT
      r.id, r.user_id, r.amount, r.currency, r.method as payment_method,
      r.status, r.credited_usd, r.net_deposit_egp, r.deposit_fee_egp,
      r.gross_deposit_egp, r.external_reference, r.created_at,
      u.email as user_email
    FROM recharges r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<any>();

  return json({
    success: true,
    data: deposits.results.map(d => ({
      id: d.id,
      userEmail: d.user_email || '—',
      paymentMethod: d.payment_method || '—',
      customerPaidAmount: d.gross_deposit_egp || d.amount || 0,
      currency: d.currency || 'EGP',
      creditedUsd: d.credited_usd || 0,
      chargedFeeAmount: d.deposit_fee_egp || 0,
      status: d.status,
      externalReference: d.external_reference || '—',
      createdAt: d.created_at,
    })),
  });
}

async function handleFinancialCustomers(env: Env, session: any, url: URL): Promise<Response> {
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  const customers = await env.DB.prepare(`
    SELECT
      id, email, full_name, username, country, balance_usd, created_at
    FROM users
    ORDER BY balance_usd DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<any>();

  return json({
    success: true,
    data: customers.results.map(c => ({
      id: c.id,
      name: c.full_name || c.username || '—',
      email: c.email,
      country: c.country || 'EG',
      balances: {
        USD: { total: c.balance_usd || 0 },
        EGP: { total: (c.balance_usd || 0) * 50 },
        SAR: { total: (c.balance_usd || 0) * 3.75 },
      },
    })),
  });
}

async function handleFinancialTransactions(env: Env, session: any, url: URL): Promise<Response> {
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  const transactions = await env.DB.prepare(`
    SELECT
      id, user_id, order_id, amount_usd, type, description,
      balance_before, balance_after, performed_by, created_at
    FROM wallet_transactions
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<any>();

  return json({
    success: true,
    data: transactions.results.map(t => ({
      id: t.id,
      userId: t.user_id,
      type: t.type,
      amount: t.amount_usd || 0,
      balanceBefore: t.balance_before || 0,
      balanceAfter: t.balance_after || 0,
      description: t.description || '—',
      createdAt: t.created_at,
    })),
  });
}

async function handleFinancialProfits(env: Env, session: any, url: URL): Promise<Response> {
  const period = url.searchParams.get('period') || 'all';
  let dateFilter = '';
  const now = new Date();

  switch (period) {
    case 'today':
      dateFilter = "AND o.updated_at >= datetime('now', '-1 day')";
      break;
    case '7d':
      dateFilter = "AND o.updated_at >= datetime('now', '-7 days')";
      break;
    case '30d':
      dateFilter = "AND o.updated_at >= datetime('now', '-30 days')";
      break;
    case 'month':
      dateFilter = `AND o.updated_at >= '${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01'`;
      break;
    default:
      dateFilter = '';
  }

  const [orderProfits, depositFees, totalSales, totalCosts] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COALESCE(SUM(COALESCE(sale_amount_usd, 0) - COALESCE(supplier_cost_usd, 0)), 0) as profitUsd
      FROM orders o
      WHERE o.status = 'completed' ${dateFilter}
    `).first<{ profitUsd: number }>(),
    env.DB.prepare(`
      SELECT COALESCE(SUM(deposit_fee_egp), 0) as feesEgp
      FROM recharges
      WHERE (status = 'approved' OR status = 'verified') ${dateFilter.replace(/o\./g, '')}
    `).first<{ feesEgp: number }>(),
    env.DB.prepare(`
      SELECT COALESCE(SUM(COALESCE(sale_amount_usd, 0)), 0) as salesUsd
      FROM orders o
      WHERE o.status = 'completed' ${dateFilter}
    `).first<{ salesUsd: number }>(),
    env.DB.prepare(`
      SELECT COALESCE(SUM(COALESCE(supplier_cost_usd, 0)), 0) as costsUsd
      FROM orders o
      WHERE o.status = 'completed' ${dateFilter}
    `).first<{ costsUsd: number }>(),
  ]);

  return json({
    success: true,
    data: {
      period,
      profits: {
        total: {
          USD: (orderProfits?.profitUsd || 0),
          EGP: (depositFees?.feesEgp || 0),
        },
        orders: {
          USD: orderProfits?.profitUsd || 0,
        },
        deposits: {
          EGP: depositFees?.feesEgp || 0,
        },
      },
      sales: {
        USD: totalSales?.salesUsd || 0,
      },
      costs: {
        USD: totalCosts?.costsUsd || 0,
      },
    },
  });
}