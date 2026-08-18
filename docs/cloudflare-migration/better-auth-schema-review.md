# Better Auth Schema Review (v2)

**Date**: 2026-07-23  
**Better Auth**: v1.6.24  
**Prefix**: `ba_` (isolated from existing `users`, `sessions`, etc.)

## Server Config
```typescript
modelName: {
  user: "ba_users",
  session: "ba_sessions", 
  account: "ba_accounts",
  verification: "ba_verifications",
}
```
- baseURL: `https://auth.zaitxmedia.com`
- basePath: `/v3`
- Plugins: admin (role, banned, banReason, banExpires)

## Tables

### ba_users
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| email | TEXT UNIQUE NOT NULL | lowercase |
| emailVerified | INTEGER DEFAULT 0 | |
| name | TEXT DEFAULT '' | |
| image | TEXT | avatar URL |
| role | TEXT CHECK(user/admin) DEFAULT 'user' | Admin plugin |
| banned | INTEGER DEFAULT 0 | Admin plugin |
| banReason | TEXT | Admin plugin |
| banExpires | TEXT | Admin plugin |
| firebase_uid | TEXT UNIQUE | Nullable, input:false, migration only |
| createdAt/updatedAt | TEXT DEFAULT now | |

### ba_sessions
id PK, userId FK→ba_users ON DELETE CASCADE, token UNIQUE, expiresAt, ipAddress, userAgent

### ba_accounts
id PK, userId FK→ba_users, providerId+accountId UNIQUE, OAuth tokens (accessToken, refreshToken, idToken)

### ba_verifications
id PK, identifier, value, expiresAt

## firebase_uid
- Nullable, Unique via partial index
- `input: false` - cannot be set during registration
- For future Firebase→Better Auth migration

## Results
| Test | Status |
|------|--------|
| Build | ✅ |
| Route handler | Ready in lib/better-auth/route-handler.ts |
| Schema applied on local D1 | ✅ 4 tables |
| TypeScript checking | ✅ (lib/better-auth NOT excluded) |
| OAuth token encryption | Not enabled (requires secret + stable API) |

## Apply locally
```bash
npx wrangler d1 execute zaitxmedia-local --config wrangler.jsonc --file=migrations/better-auth-schema.sql
```
