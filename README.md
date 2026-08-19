# 👑 ZaitXMedia Platform — Primary Production Core

[![Production URL](https://img.shields.io/badge/Production-zaitxmedia.com-00F0FF?style=for-the-badge&logo=vercel)](https://zaitxmedia.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)](https://www.python.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com)

> **ZaitXMedia** is a state-of-the-art digital storefront, TikTok coin pricing engine, and automated multi-country payment management platform. Designed with high-availability serverless micro-services, real-time SMS payment gateway verification, and dynamic country-aware currency isolation.

---

## 🌟 Key Features & Innovations

### 🌍 1. Dynamic Custom Country & Isolated Payment Routing
- **Custom Country Manager**: Admin can dynamically register any country (ISO code, currency, emoji flag, exchange rate).
- **Location-Isolated Payment Methods**:
  - 🇪🇬 **Egypt (EG)**: Vodafone Cash, InstaPay, and Bank Transfer.
  - 🇸🇦 **Saudi Arabia (SA)**: Barq App and Bank Transfer.
  - 🌐 **Global (USD / Custom)**: Bank Transfer available to all countries.
- **Modal Preference Persistence**: `<PaymentSetupModal />` records user payment preferences to `localStorage` and profile storage, ensuring seamless onboarding with zero repeating popups.

### 🐍 2. Python Automation & Dynamic Exchange Rate Engine
- **FastAPI Microservice Engine** (`python_services/main.py`):
  - Calculates TikTok Coin package boundaries, profit margins, and price tiers dynamically.
- **Zero Hardcoded Rates**:
  - Live rates (`usd_rate`, `sar_rate_override`, `deposit_fee_percent`) are fetched on-the-fly from Firestore `settings/pricing`.

### 🔐 3. Hardened Security & Anti-Inspection Engine
- **Console Log Interceptor** (`app/lib/security-logger.ts`):
  - Automatically silences browser `console.log`, `console.info`, `console.debug`, and `console.warn` for regular users in production.
  - Grants full unthrottled debugging privileges **only** to verified admin accounts.
- **Obfuscated Admin Path Guarding**:
  - Requests to `/admin` and `/api/admin/*` by non-administrators trigger an instant HTTP 404 response.
- **Firestore Access Rule Hardening**:
  - Client-side write access to `settings`, `pricing`, `financial_ledger`, and `admin_accounts` is strictly forbidden.

---

## 🛠️ Technology Stack

| Layer | Language / Tool | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 15 (React 19)** / **TypeScript** | Responsive UI, Server Components, SSR/SSG rendering. |
| **Design System** | **Vanilla CSS3 + TailwindCSS** | Glassmorphism UI tokens, custom animation keyframes, HSL color palettes. |
| **Backend & APIs** | **Node.js (TypeScript API Routes)** | Server actions, profile handling, payment webhooks, and rate enforcement. |
| **Automation Engine** | **Python 3.11 (FastAPI & Scripts)** | Package pricing algorithms, automation scripts, and helper tools. |
| **Database** | **Firebase Firestore** | NoSQL document storage for users, orders, deposit records, and site settings. |
| **Authentication** | **Clerk Auth & Passkeys** | Passwordless authentication, multi-factor security, session management. |
| **Edge Compute** | **Cloudflare Workers (Wrangler)** | Webhook forwarding, rate limiting, and SMS payment gateway verification. |

---

## 📁 Project Architecture & Layout

```
.
├── app/                      # Next.js App Router
│   ├── (store)/              # Storefront & category product catalog
│   ├── account/              # User account & preferred payment preferences
│   ├── admin/                # Secure Admin Panel & Country Manager
│   ├── api/                  # Server API routes (Webhooks, Python bridge)
│   ├── components/           # UI Components (PaymentSetupModal, AppShell)
│   └── lib/                  # Auth context, currency context, security logger
├── lib/                      # Core business logic (Money minor units, SMS parser)
├── python_services/          # Python FastAPI Microservice & Scripts
│   ├── main.py               # FastAPI server script
│   ├── scripts/              # Independent Python helpers (tiktok_helper.py)
│   └── requirements.txt      # Python dependencies
├── worker/                   # Cloudflare Worker SMS Payment Gateway
├── firestore.rules           # Hardened Firestore Security Rules
├── next.config.ts            # Next.js configuration
└── wrangler.jsonc            # Cloudflare Worker configuration
```

---

## 🚀 Quick Setup & Deployment Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Python**: `v3.10` or higher
- **npm** / **yarn**

### 1. Installation
```bash
npm install
pip install -r python_services/requirements.txt
```

### 2. Run Next.js Local Server
```bash
npm run dev
```

### 3. Run Python Microservice
```bash
uvicorn python_services.main:app --reload --port 8000
```

### 4. Deploy to Vercel Production
```bash
npx vercel --prod
```

---

## 🌐 Arabic Documentation

Detailed Arabic instructions are documented in [`README_AR.md`](./README_AR.md).