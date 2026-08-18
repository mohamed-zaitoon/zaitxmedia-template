import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { runPythonScript } from "@/app/lib/python-runner";

// ============================================================================
// 🐍 [EN] Next.js <-> Python Microservice & Automation Bridge API
// 🐍 [AR] مسار واجهة برمجة التطبيقات للربط بين Next.js ومحرك أتمتة بايثون
// ============================================================================
export async function POST(request: Request) {
  try {
    // 🔒 [EN] Validate Clerk Authentication session
    // 🔒 [AR] التحقق من جلسة المصادقة والمستخدم الحسابي
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, coinsCount } = body;

    // 📡 [EN] Securely fetch live pricing settings from Firestore admin collection
    // 📡 [AR] سحب إعدادات أسعار الصرف الحية والأحدث مباشرة من قاعدة بيانات Firestore
    const pricingSnap = await adminDb.collection("settings").doc("pricing").get();
    const pricingData = pricingSnap.exists ? pricingSnap.data() : {};
    const liveUsdRate = Number(pricingData?.usd_rate || pricingData?.tiktok_usd_rate || 50.0);

    if (action === "tiktok_coins") {
      const coins = Number(coinsCount) || 1000;

      // ⚡ [EN] Execute Python automation script passing dynamic Firestore USD rate
      // ⚡ [AR] تشغيل سكربت بايثون مع تمرير سعر الدولار الحي المسحوب من Firestore
      const result = await runPythonScript("tiktok_helper.py", [
        String(coins),
        String(liveUsdRate),
      ]);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Python execution failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        source: "Python Automation Engine (Dynamic Firestore Rate)",
        executionTimeMs: result.executionTimeMs,
        data: result.data,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Python bridge internal error" },
      { status: 500 }
    );
  }
}
