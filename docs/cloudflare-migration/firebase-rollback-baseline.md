# Firebase Rollback Baseline Report

**Date**: 2026-07-23  
**Branch**: `migration/cloudflare-better-auth`  
**Commit**: `70546f8`

## What was deleted
- `app/lib/appwrite/` - Appwrite client config + server helpers
- `app/api/appwrite/[...appwrite]/` - Appwrite SSR handlers
- `app/api/data/route.ts` - Appwrite data proxy
- `app/auth/` - Appwrite auth pages (reset-password, verify)
- `app/providers.tsx` - Appwrite React Provider
- `app/complete-account/` - Appwrite onboarding
- `app/v3/[...all]/` - Better-Auth routes
- `app/lib/better-auth/` - Better-Auth client + server
- `app/lib/email/brevo.ts` - Brevo email helper
- `app/components/AccountGate.tsx` - Auth gate component
- `starter-for-nextjs/` - Appwrite starter kit clone
- `scripts/migrate-d1-to-appwrite.mjs` - D1→Appwrite migration
- `migrations/0005_appwrite.sql` - Appwrite user_id column
- `docs/migration/` - Old migration docs
- `docs/cloudflare-migration/*` - Previous migration reports
- `.open-next/` - OpenNext build cache

## What was restored (from git)
- `app/TikTokLanding.tsx`
- `app/admin/page.tsx`
- `app/api-client.ts`
- `app/login/page.tsx`
- `app/orders/page.tsx`
- `app/recharge/page.tsx`
- `app/page.tsx`
- `app/components/CheckoutModal.tsx`
- `app/components/ProfileSettingsModal.tsx`
- `app/components/NotificationsModal.tsx`
- `app/components/OneSignalProvider.tsx`
- `app/components/UserOrdersModal.tsx`
- `app/utils/onesignal.ts`
- `app/layout.tsx`

## What was newly created
- `app/firebase.ts` - Firebase client (zaitxmedia242)
- `app/lib/auth-context.tsx` - FirebaseAuthProvider + useAuth
- `app/components/KindeAuthProvider.tsx` - Wraps FirebaseAuthProvider
- `firebase.json` - Firebase Hosting config
- `.firebaserc` - Firebase project alias
- `.env.local` - Firebase environment variables

## Packages removed
- `appwrite` (client)
- `@appwrite.io/react` (React integration)
- `node-appwrite` (server SDK)

## Packages installed
- `firebase` (Web SDK v12)

## Current Auth System
- **Provider**: Firebase Authentication (zaitxmedia242)
- **Methods**: Email/Password + Google OAuth
- **Session**: Firebase SDK manages automatically via IndexedDB
- **Context**: `FirebaseAuthProvider` in `app/lib/auth-context.tsx`

## Firestore Collections Used
| Collection | Path | Purpose |
|-----------|------|---------|
| users | `/users/{uid}` | User profiles, role, status |
| users/balance | `/users/{uid}/balance/main` | User balance (amount field) |
| app_settings | `/app_settings/pricing` | Pricing config |
| app_settings | `/app_settings/site` | Site settings, wallets, instapay |
| orders | `/orders/{id}` | Customer orders |
| notifications | `/notifications/{id}` | User notifications |
| prices | `/prices/{id}` | TikTok coin price tiers |
| manual_services | `/manual_services/{id}` | Manual service listings |
| tiers | `/tiers/{id}` | Price tiers (alternate path) |
| settings | `/settings/app` | App settings (alternate path) |

## Firebase Hosting
- **Site**: zaitxmedia242
- **URL**: https://zaitxmedia242.web.app
- **Custom domains**: zaitxmedia.com, admin.zaitxmedia.com, auth.zaitxmedia.com

## Deployment Result
- `npm run build`: ✅
- `firebase deploy --only hosting`: ✅
- `firebase deploy --only firestore:rules`: ✅

## Uncommitted changes
- 30+ modified files (restored Firebase versions)
- 13+ deleted files (Appwrite dependencies)
- 3 new untracked files: `.firebaserc`, `app/firebase.ts`, `firebase.json`

## Known Issues
1. **SMMX API key exposed** in commit `7cecf23` → needs key rotation at smmxmedia.com
2. **Firestore rules allow all authenticated users** → needs tightening
3. **Settings doc path mismatch** - code reads `settings/app` but data at `app_settings/pricing`
4. **No server-side price verification** - prices are trusted from client
5. **Admin role check** - depends on Firestore `users/{uid}.role` field
6. **No R2 file upload** - files not yet migrated

## Delta to target architecture
| Component | Current | Target |
|-----------|---------|--------|
| Auth | Firebase Auth | Better Auth on D1 |
| Database | Firestore | Cloudflare D1 |
| Hosting | Firebase Hosting | Cloudflare Pages (OpenNext) |
| Files | None | R2 |
| Email | None | Brevo API |
| API | Cloudflare Worker | Cloudflare Worker |
