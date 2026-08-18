"use client";

import { useEffect, useState } from "react";
import OneSignal from "react-onesignal";

export default function AdminNotificationEnrollmentPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"ready" | "busy" | "done" | "ios_install" | "denied" | "unsupported" | "error">("ready");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setToken(hash.get("token") || "");
  }, []);

  const enable = async () => {
    setStatus("busy");
    setErrorMessage("");
    try {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
        || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      if (isIos && !isStandalone) {
        setStatus("ios_install");
        return;
      }
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setStatus("unsupported");
        return;
      }
      const verification = await fetch("/api/push/admin-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!verification.ok) throw new Error("رابط التفعيل غير صالح أو انتهت مدته");
      const serviceWorkerPath = "/push/onesignal/OneSignalSDKWorker.js";
      const serviceWorkerScope = "/push/onesignal/";
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register(serviceWorkerPath, {
          scope: serviceWorkerScope,
        });
        const registration = await navigator.serviceWorker.getRegistration(
          serviceWorkerScope,
        );
        if (!registration) {
          throw new Error("تعذر تسجيل Service Worker الخاص بالإشعارات");
        }
      }
      if (!(OneSignal as any).initialized) {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
            || "0daf00e5-5441-4b6c-a22c-9c1b6223b9a7",
          serviceWorkerPath,
          serviceWorkerParam: { scope: serviceWorkerScope },
        });
      }
      await OneSignal.login("zaitxmedia-admin");
      const granted = OneSignal.Notifications.permission
        || await OneSignal.Notifications.requestPermission();
      if (!granted || Notification.permission !== "granted") {
        setStatus("denied");
        return;
      }
      await OneSignal.User.PushSubscription.optIn();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (OneSignal.User.PushSubscription.optedIn && OneSignal.User.PushSubscription.id) break;
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      if (!OneSignal.User.PushSubscription.optedIn || !OneSignal.User.PushSubscription.id) {
        throw new Error("تم السماح بالإشعارات لكن لم يكتمل تسجيل الهاتف");
      }
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "تعذر تسجيل الهاتف");
      setStatus("error");
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-5 text-white" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-slate-900 p-7 text-center shadow-2xl">
        <h1 className="mb-3 text-xl font-black text-cyan-300">تفعيل إشعارات الإدارة</h1>
        <p className="mb-6 text-sm leading-7 text-slate-400">
          اسمح بالإشعارات ليصلك تنبيه فوري عند وصول طلب أو طلب شحن جديد.
        </p>
        {status === "done" ? (
          <div className="rounded-xl bg-emerald-500/10 p-4 font-bold text-emerald-400">
            تم تفعيل إشعارات الأدمن بنجاح. يمكنك إغلاق هذه الصفحة.
          </div>
        ) : status === "ios_install" ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-7 text-amber-300">
            على iPhone: اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية». افتح التطبيق من الأيقونة الجديدة وارجع لنفس رابط التفعيل واضغط السماح.
          </div>
        ) : (
          <button
            onClick={enable}
            disabled={!token || status === "busy"}
            className="h-12 w-full rounded-xl bg-cyan-400 font-black text-slate-950 disabled:opacity-50"
          >
            {status === "busy" ? "جاري التفعيل..." : "السماح بإشعارات الأدمن"}
          </button>
        )}
        {status === "denied" && (
          <p className="mt-4 text-sm leading-7 text-red-400">الإشعارات محظورة للمتصفح. افتح إعدادات الموقع في المتصفح، غيّر الإشعارات إلى «سماح»، ثم أعد المحاولة.</p>
        )}
        {status === "unsupported" && (
          <p className="mt-4 text-sm leading-7 text-red-400">هذا المتصفح لا يدعم إشعارات الويب. استخدم Chrome على Android، أو أضف الموقع للشاشة الرئيسية على iPhone.</p>
        )}
        {status === "error" && (
          <p className="mt-4 text-sm leading-7 text-red-400">{errorMessage || "تعذر التفعيل. افتح رابطًا جديدًا من لوحة الأدمن."}</p>
        )}
      </div>
    </main>
  );
}
