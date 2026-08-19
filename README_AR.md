# 👑 منصة زايت إكس ميديا (ZaitXMedia Core Production Engine)

[![Production URL](https://img.shields.io/badge/الموقع_المباشر-zaitxmedia.com-00F0FF?style=for-the-badge&logo=vercel)](https://zaitxmedia.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)](https://www.python.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com)

> **ZaitXMedia** هي المنصة البرمجية الرئيسية المستقلة والمباشرة لخدمات التسويق الرقمي وشحن عملات تيك توك، تعتمد على معمارية الخدمات المصغرة السحابية، التحقق اللحظي من إيداعات الرسائل النصية، والربط الديناميكي مع الدول والعملات المخصصة.

---

## 🌟 الميزات الهندسية والتحسينات الرئيسية

### 🌍 1. نظام إضافة وتخصيص الدول وطرق الدفع المشفرة:
- **إدارة الدول المخصصة (Country Manager)**: تمكين الأدمن من إضافة أي دولة جديدة فوراً بالاسم، الرمز (ISO)، رمز العملة والعلم.
- **توجيه وسائل الدفع حسب الدولة**:
  - 🇪🇬 **مصر**: فودافون كاش، انستا باي، والتحويل البنكي.
  - 🇸🇦 **السعودية**: تطبيق برق والتحويل البنكي.
  - 🌐 **كافة الدول الأخرى**: التحويل البنكي العام متاح لجميع دول العالم.
- **تذكر التفضيلات وعدم التكرار**: حفظ تفضيلات وسائل الدفع في `localStorage` لمنع ظهور النافذة المنبثقة مجدداً بعد الحفظ.

### 🐍 2. محرك بايثون وأسعار الصرف الديناميكية:
- **خادم خدمات بايثون المصغرة (`python_services/main.py`)**:
  - خادم عالي السرعة (FastAPI) لحساب باقات وعملات تيك توك وتوليد مخرجات JSON آمنة.
- **إلغاء الأسعار الثابتة**:
  - يتم سحب أسعار الدولار والريال ونسب العمولات ديناميكياً من قاعدة بيانات Firestore `settings/pricing` ومشاركتها مع كود بايثون فورياً.

### 🔐 3. نظام الأمان المشدد وحماية المتصفح:
- **حظر تتبع سجلات الكونسول (`security-logger.ts`)**:
  - كتم وإلغاء دوال `console.log`, `console.info`, `console.debug` تلقائياً للمستخدمين العاديين في بيئة الإنتاج لمنع التجسس عبر DevTools.
  - منح الصلاحية الكاملة للتتبع وتصحيح الأخطاء حصرياً لحسابات الأدمن المعتمدة.
- **إخفاء مسارات الإدارة**:
  - أي محاولة دخول لغير المصرح لهم إلى `/admin` أو `/api/admin/*` ترجع فوراً استجابة `404 Not Found`.

---

## 🛠️ تقنيات ولغات البرمجة

| المكون / التقنية | اللغة المستخدمة | الدور الهندسي |
| :--- | :--- | :--- |
| **واجهة المستخدم** | **Next.js 15 (React 19) / TypeScript** | البناء التفاعلي، التصميم الزجاجي Modern Glassmorphism، ودعم الجوال والكمبيوتر. |
| **التنسيقات والأنيميشن** | **CSS 3 + TailwindCSS** | الألوان الداكنة، المسافات المرنة (`px-5 py-3.5`) والأنيميشن التفاعلي. |
| **الخادم والـ API Backend** | **TypeScript (Node.js API Routes)** | معالجة الطلبات، المعاملات المالية، واستقبال الـ Webhooks. |
| **محرك الأتمتة** | **Python 3.11 (FastAPI & Scripts)** | خادم الخدمات المصغرة وحاسبة باقات وعملات تيك توك. |
| **قاعدة البيانات** | **Firebase Firestore** | تخزين بيانات المستخدمين، الطلبات، وسجلات الإيداع والإعدادات. |
| **نظام المصادقة** | **Clerk Auth + Passkeys** | تسجيل الدخول بدون كلمة سر، وتأمين الجلسات. |
| **الشبكة ومعالجة الرسائل** | **Cloudflare Workers (Wrangler)** | استقبال وتوجيه رسائل إيداعات SMS ومطابقتها على الـ Edge. |

---

## 📁 هيكل المجلدات والملفات

```
.
├── app/                      # تطبيق Next.js (الواجهات، الصفحات، ومسارات الـ API)
│   ├── (store)/              # المتجر الرئيسي وكتالوج الخدمات
│   ├── account/              # حساب المستخدم وتفضيلات الدفع
│   ├── admin/                # لوحة التحكم وإدارة الدول
│   ├── api/                  # مسارات API السيرفر (بوابات الدفع وجسر بايثون)
│   ├── components/           # المكونات التفاعلية (نافذة وسائل الدفع)
│   └── lib/                  # مصفوفة سياق الأمان، العملات، والمصادقة
├── lib/                      # منطق العمل التجاري (تحويل العملات ومطابقة الرسائل)
├── python_services/          # خادم محرك بايثون المستقل (FastAPI & Scripts)
│   ├── main.py               # خادم FastAPI للربط السريع
│   ├── scripts/              # سكربتات بايثون المستقلة (tiktok_helper.py)
│   └── requirements.txt      # مكتبات بايثون
├── worker/                   # خادم Cloudflare Worker لبوابة رسائل الدفع
├── firestore.rules           # قواعد حماية واستعلامات Firestore
├── next.config.ts            # إعدادات Next.js
└── wrangler.jsonc            # إعدادات Cloudflare Worker
```

---

## 🚀 التشغيل المباشر والنشر على Vercel

```bash
npm install
pip install -r python_services/requirements.txt
npm run dev
npx vercel --prod
```
