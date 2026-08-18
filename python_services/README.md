# ZaitXMedia Python Integration Engine 🐍

هذا المجلد يحتوي على **محرك أتمتة بايثون المباشر** المتصل بموقع Next.js.

## 📁 الهيكل والتصميم:

- `main.py`: خادم **FastAPI Microservice** عالي السرعة يقدم API مستقر لأي عمليات معقدة أو أتمتة.
- `scripts/tiktok_helper.py`: سكربت بايثون لتنفيذ عمليات حساب ومعالجة أسعار وحزم تيك توك.
- `requirements.txt`: المكتبات اللازمة لتشغيل الخادم.

## 🚀 كيفية تشغيل خدمة بايثون:

### 1. تثبيت المتطلبات:
```bash
pip install -r python_services/requirements.txt
```

### 2. تشغيل خادم FastAPI:
```bash
python python_services/main.py
```
أو عبر uvicorn:
```bash
uvicorn python_services.main:app --host 0.0.0.0 --port 8000 --reload
```

## 🔗 طريقة الاستدعاء من كود Next.js:

```typescript
import { runPythonScript } from "@/app/lib/python-runner";

// استدعاء سكربت بايثون من داخل Next.js API
const result = await runPythonScript("tiktok_helper.py", ["1000", "55.0"]);
console.log(result.data);
```
