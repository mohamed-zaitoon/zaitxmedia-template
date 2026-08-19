import { Env } from './types';
import { handleAuthRequest } from './auth';
import { handleAdminRequest } from './admin';
import { handleOrdersRequest } from './orders';
import { handleFinancialRequest } from './financial';
import { handleRechargeRequest } from './recharge';
import { handleNotificationsRequest } from './notifications';
import { handleSettingsRequest } from './settings';
import { handleServicesRequest } from './services';
import { handleWebhookRequest } from './webhooks';
import { handleBinancePayRequest } from './binance-pay';
import { handleProviderRequest } from './provider';
import { checkRateLimit, RATE_LIMITS, getClientIp, handleInternalUpload, handleInternalDelete } from './utils';

const ALLOWED_ORIGINS = [
  'https://zaitxmedia.com',
  'https://www.zaitxmedia.com',
  'https://admin.zaitxmedia.com',
  'https://api.zaitxmedia.com',
  'https://zaitxmedia.pages.dev',
  'https://*.zaitxmedia.pages.dev',
  'http://localhost:3000',
  'http://localhost:3100',
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.some(o => {
    if (o.includes('*')) {
      const regex = new RegExp('^' + o.replace(/\*/g, '.*') + '$');
      return regex.test(origin);
    }
    return o === origin;
  });
  const allowedOrigin = allowed ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const ip = getClientIp(request);

    if (!path.startsWith('/api/webhook/')) {
      const rlAllowed = await checkRateLimit(env.CACHE, ip, 'global', {
        windowSeconds: 60,
        maxRequests: 300,
      });
      if (!rlAllowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...corsHeaders(request),
            },
          }
        );
      }
    }

    try {
      let response: Response;

      if (path === '/api/internal/upload') {
        response = await handleInternalUpload(request, env);
      } else if (path === '/api/internal/delete') {
        response = await handleInternalDelete(request, env);
      } else if (path.startsWith('/storage/')) {
        const key = path.substring('/storage/'.length);
        if (!env.STORAGE) {
          response = new Response('Storage not configured', { status: 500 });
        } else {
          const object = await env.STORAGE.get(key);
          if (!object) {
            response = new Response('Object not found', { status: 404 });
          } else {
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=31536000');
            response = new Response(object.body, {
              headers,
            });
          }
        }
      } else if (path.startsWith('/api/auth/')) {
        response = await handleAuthRequest(request, env, path);
      } else if (path.startsWith('/api/admin/pricing') || path.startsWith('/api/admin/payment-methods')) {
        response = await handleSettingsRequest(request, env, path);
      } else if (path.startsWith('/api/admin/services')) {
        response = await handleServicesRequest(request, env, path);
      } else if (path.startsWith('/api/admin/')) {
        response = await handleAdminRequest(request, env, path);
      } else if (path.startsWith('/v1/financial/')) {
        response = await handleFinancialRequest(request, env, path);
      } else if (path.startsWith('/v1/orders/')) {
        response = await handleOrdersRequest(request, env, path);
      } else if (path.startsWith('/api/orders')) {
        response = await handleOrdersRequest(request, env, path);
      } else if (path.startsWith('/api/recharge')) {
        response = await handleRechargeRequest(request, env, path);
      } else if (path.startsWith('/api/notifications')) {
        response = await handleNotificationsRequest(request, env, path);
      } else if (path.startsWith('/api/settings')) {
        response = await handleSettingsRequest(request, env, path);
      } else if (path.startsWith('/api/services')) {
        response = await handleServicesRequest(request, env, path);
      } else if (path.startsWith('/v1/payment/binance-pay')) {
        response = await handleBinancePayRequest(request, env, path, ctx);
      } else if (path.startsWith('/api/webhook/') || path.startsWith('/v1/')) {
        response = await handleWebhookRequest(request, env, path, ctx);
      } else if (path === '/health') {
        response = new Response(JSON.stringify({ status: 'ok', version: '2.0.0' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
        });
      } else if (path === '/' || path.startsWith('/smmx/') || path.startsWith('/catalog') || path.startsWith('/offers') || path === '/onesignal/send') {
        const providerResponse = await handleProviderRequest(request, env, path);
        if (providerResponse) {
          response = providerResponse;
        } else {
          response = new Response(
            JSON.stringify({ success: true, data: { message: 'zaitxmedia API', version: '2.0.0' } }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                ...corsHeaders(request),
              },
            }
          );
        }
      } else {
        response = new Response(
          JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND', message: `Route ${method} ${path} not found` },
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...corsHeaders(request),
            },
          }
        );
      }

      const responseHeaders = new Headers(response.headers);
      const corsHdrs = corsHeaders(request);
      for (const [key, value] of Object.entries(corsHdrs)) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      console.error('Unhandled error:', err.stack || err.message || err);
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders(request),
          },
        }
      );
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.CRON_SECRET) {
      console.error("Firebase cleanup skipped: CRON_SECRET is missing");
      return;
    }

    ctx.waitUntil(
      fetch("https://zaitxmedia.com/api/cron/firebase-cleanup", {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Firebase cleanup failed with HTTP ${response.status}`);
        }
        console.log("Firebase cleanup completed", await response.text());
      }),
    );
  },
};
