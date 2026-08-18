"use client";

import { useState, useEffect } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint, ShieldCheck, CheckCircle2, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";

export default function PasskeyButton({
  userId,
  userEmail,
  userRole = "user",
}: {
  userId: string;
  userEmail?: string;
  userRole?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSupported(browserSupportsWebAuthn());
    }
  }, []);

  useEffect(() => {
    if ((userId || userEmail) && supported) {
      checkPasskeyStatus();
    } else {
      setChecking(false);
    }
  }, [userId, userEmail, supported]);

  const checkPasskeyStatus = async () => {
    try {
      const res = await fetch("/api/auth/passkey/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail }),
      });
      const data = await res.json();
      setRegistered(!!data.hasPasskey);
    } catch (e) {
      console.warn("Could not check passkey status", e);
    } finally {
      setChecking(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!supported) {
      return Swal.fire({
        icon: "warning",
        title: "غير مدعوم",
        text: "متصفحك الحالي لا يدعم حماية بصمة الأصبع / Passkey",
        background: "#0c1322",
        color: "#fff",
      });
    }

    setLoading(true);
    try {
      // 1. Get challenge options from server
      const res = await fetch("/api/auth/passkey/register-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail, userRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.options) {
        throw new Error(data.error || "فشل إنشاء تحدي التشفير البيومتري");
      }

      // 2. Trigger browser native biometric prompt & save to phone Keychain / Passkey manager
      let credentialResponse;
      try {
        credentialResponse = await startRegistration({ optionsJSON: data.options });
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          throw new Error("تم إلغاء عملية قراءة البصمة من قبل المستخدم");
        } else if (err.name === "InvalidStateError") {
          throw new Error("هذه البصمة / الجهاز مسجل بالفعل لهذا الحساب");
        } else if (err.name === "NotSupportedError") {
          throw new Error("الجهاز أو المتصفح الحالي لا يدعم إنشاء Passkey");
        }
        throw err;
      }

      if (!credentialResponse) {
        throw new Error("لم تم إكمال قراءة البصمة بشكل صحيح");
      }

      // 3. Store passkey in database
      const saveRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: userEmail,
          credential: credentialResponse,
        }),
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok || !saveResult.success) {
        throw new Error(saveResult.error || "فشل حفظ البصمة في السيرفر");
      }

      setRegistered(true);
      Swal.fire({
        icon: "success",
        title: "تمت الحماية ببصمة الأصبع! 🔒",
        text: "تم ربط وحفظ البصمة / Passkey في هاتفك بنجاح. سيُطلب منك تأكيد البصمة فور تسجيل دخولك للحساب.",
        background: "#0c1322",
        color: "#fff",
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "فشل تفعيل البصمة",
        text: err.message || "تعذر تفعيل البصمة البيومترية",
        background: "#0c1322",
        color: "#fff",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-center flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
        <ShieldCheck size={18} />
        <span>حماية الحساب ببصمة الأصبع / Face ID</span>
      </div>
      <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
        {registered
          ? "حسابك محمي ببصمة الأصبع. سيُطلب منك قراءة البصمة لتأكيد الهوية فور إدخال بيانات الدخول."
          : "قم بتشغيل الحماية البيومترية لحفظ البصمة في هاتفك والتأكد من هوية المستخدم بعد إدخال كلمة المرور."}
      </p>

      {registered && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <CheckCircle2 size={14} />
          <span>البصمة مفعلة ومحفوظة بنجاح 🔒</span>
        </div>
      )}

      <button
        onClick={handleRegisterPasskey}
        disabled={loading || checking}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 px-5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <>
            <RefreshCw size={16} className="animate-spin" />
            <span>جاري قراءة وحفظ البصمة...</span>
          </>
        ) : (
          <>
            <Fingerprint size={16} />
            <span>{registered ? "إعادة ربط / تحديث بصمة الأصبع 🔒" : "تفعيل وحفظ بصمة الأصبع"}</span>
          </>
        )}
      </button>
    </div>
  );
}
