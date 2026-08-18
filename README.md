# 🌟 ZaitXMedia Store Template (Open Source Example)

> This repository is a **clean, open-source template** designed as an architectural example for developers building Next.js 15 digital stores, TikTok coin calculation platforms, and multi-country payment management engines.
> **All production keys, credentials, phone numbers, and live data have been completely removed or replaced with generic placeholders.**

---

## 🛠️ Technology Stack & Languages

| Technology | Language | Purpose & Functionality |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (React 19)** | App Router, SSR/SSG rendering, Glassmorphism UI layout. |
| **Type Safety** | **TypeScript** | Strict interfaces for payment methods, wallet transactions, and admin controls. |
| **Automation** | **Python 3 (FastAPI)** | Standalone microservice for coin rate calculations and automation tasks. |
| **Database** | **Firebase Firestore** | Document database schema for products, categories, orders, and site settings. |
| **Auth Engine** | **Clerk Auth** | Passwordless authentication, multi-factor security, user sessions. |
| **Edge Compute** | **Cloudflare Workers** | Webhook forwarding, rate limiting, and SMS payment gateway. |

---

## 🚀 How to Use This Template

### 1. Clone & Install
```bash
git clone https://github.com/mohamed-zaitoon/zaitxmedia-example.git
cd zaitxmedia-example
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and fill in your credentials:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```

---

## 🌐 Arabic Note / ملاحظة باللغة العربية
هذا المشروع هو **نسخة قالب مفتوحة المصدر (Open-Source Template)** تم فيها استبدال كافة مفاتيح الربط والبيانات الحقيقية وأرقام الهواتف بقيم توضيحية لتعمل كمثال هندسي لمصممي ومطوري تطبيقات Next.js و Python.