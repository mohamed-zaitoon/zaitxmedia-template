# Security Findings

**Date**: 2026-07-23

## SMMX API Key Status
- **Exposed in git**: YES - commit `7cecf23` in wrangler.jsonc
- **Current wrangler.jsonc**: CLEAN - not present
- **Deployed on Worker**: YES - set as variable on `zaitxmedia-api`
- **Deployed on Provider Worker**: YES - set on `zaitxmedia-provider`
- **Action required**: Rotate key at smmxmedia.com, then update via `wrangler secret put SMMX_API_KEY`

## Other Secrets Scan
| Pattern | Files Found | Status |
|---------|-------------|--------|
| SMMX_API_KEY | wrangler.jsonc (history only) | Needs rotation |
| FIREBASE_API_KEY | .env.local, app/firebase.ts | Public - OK for web SDK |
| GOOGLE_CLIENT_ID | Not found in source | Clean |
| PRIVATE_KEY | Not found | Clean |
| PASSWORD | Not found in plaintext | Clean |
| TOKEN | Not found exposed | Clean |

## Recommendations
1. Rotate SMMX key at smmxmedia.com immediately
2. Run `wrangler secret put SMMX_API_KEY` after rotation
3. Consider using BFG or git-filter-repo to clean history
