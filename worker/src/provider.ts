// Provider routes that forward to the old zaitxmedia-provider worker
// This handles SMMX/Fazer catalog/offers/OneSignal proxy
// These routes are heavy and run on a separate worker to avoid subrequest timeouts
import { Env } from './types';

const PROVIDER_BASE = "https://zaitxmedia-provider.zaitxmedia.workers.dev";

export async function handleProviderRequest(
  request: Request,
  _env: Env,
  path: string
): Promise<Response | null> {
  // Forward compatible routes to the old provider worker
  if (
    path.startsWith('/smmx/') ||
    path.startsWith('/catalog') ||
    path.startsWith('/offers') ||
    path === '/onesignal/send'
  ) {
    const url = new URL(request.url);
    const targetUrl = PROVIDER_BASE + path + (url.search || '');
    try {
      const res = await fetch(targetUrl, {
        method: request.method,
        headers: { 'Accept': 'application/json' },
      });
      return res;
    } catch {
      return new Response(JSON.stringify({ error: 'Provider unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return null;
}
