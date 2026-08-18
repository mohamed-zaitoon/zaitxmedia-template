# Balance Removal Plan

**Date**: 2026-07-23

## Current Balance System
- `users` table: `balance_usd` column (REAL)
- `users/{uid}/balance/main` subcollection (Firestore)
- Wallet transactions for balance credits/debits
- Balance displayed to user, used for order payment
- `/recharge` page for balance top-up
- Admin can adjust user balances

## Files Using Balance
| File | Usage |
|------|-------|
| `app/TikTokLanding.tsx` | Display balance, formatBalance() |
| `app/recharge/page.tsx` | Recharge page, balance display |
| `app/admin/page.tsx` | User balance fields |
| `app/components/CheckoutModal.tsx` | Balance-based payment flow |
| `app/lib/auth-context.tsx` | User balance sync |
| Firestore: `users/{uid}/balance/main` | Balance storage |

## Removal Steps
1. ✅ Disable balance-based payment in CheckoutModal
2. ✅ Hide recharge page link from navigation
3. Keep recharge page accessible via direct URL (temporarily)
4. Do NOT delete balance data from Firestore yet
5. Create report of users with existing balances
6. Wait for approval before deleting balance columns

## New Payment Model
- Each order paid directly via: Vodafone Cash, InstaPay, Barq
- No internal balance or wallet
- Payment verified via SMS/webhook matching
- Payment state stored in `payment_intents` table
