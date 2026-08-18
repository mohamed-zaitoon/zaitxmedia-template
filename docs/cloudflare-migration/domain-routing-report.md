# Domain Routing Report

**Date**: 2026-07-23  
**Worker**: zaitxmedia-web  
**Framework**: OpenNext + Cloudflare Workers

## Domain Map

| Domain | Purpose | Internal Path | Handler |
|--------|---------|---------------|---------|
| `zaitxmedia.com` | Main site | `/` | Static + Server |
| `www.zaitxmedia.com` | WWW redirect | → zaitxmedia.com | 301 Redirect |
| `auth.zaitxmedia.com` | Authentication | `/v3/*` | Better Auth |
| `admin.zaitxmedia.com` | Admin panel | `/admin/*` (rewrite) | Auth + D1 |
| `api.zaitxmedia.com` | Public API | `/v1/*` | API handlers |

## Host Routing
Middleware at `middleware.ts` routes based on `Host` header:
- `auth.zaitxmedia.com` → only `/v3/*`, other paths → 404 or redirect
- `admin.zaitxmedia.com` → rewrites to `/admin/*` internally
- `api.zaitxmedia.com` → only `/v1/*`, returns JSON errors
- `zaitxmedia.com` → blocks `/admin` access, main site
- `www` → 301 redirect to non-www

## Cookie Policy
- Better Auth cross-subdomain cookies
- Domain: `.zaitxmedia.com`
- HttpOnly, Secure (production), SameSite=Lax
- Path=/

## CORS Policy
Allowed origins:
- `https://zaitxmedia.com`
- `https://admin.zaitxmedia.com`
- `https://auth.zaitxmedia.com`

No wildcard CORS. Credentials only where needed.

## Current Status
- ✅ Better Auth /v3 working on Workers
- ✅ Middleware created
- ✅ Drizzle D1 adapter configured
- ❌ Main site pages (Firebase SDK incompatible with Workers)
- ❌ OpenNext build hangs on page data collection

## Next Steps
1. Remove Firebase SDK from Worker build path
2. Replace Firebase with Better Auth + D1 for all data
3. Complete OpenNext build
4. Test with Host headers locally
