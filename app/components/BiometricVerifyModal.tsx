"use client";

import { useState, useEffect } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint, ShieldAlert, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";

interface BiometricVerifyModalProps {
  isOpen: boolean;
  userId: string;
  userEmail?: string;
  userName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BiometricVerifyModal({
  isOpen,
  userId,
  userEmail,
  userName,
  onSuccess,
  onCancel,
}: BiometricVerifyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (isOpen && (userId || userEmail)) {
      setError("");
      setVerified(false);
      // Auto trigger fingerprint prompt
      triggerBiometricAuth();
    }
  }, [isOpen, userId, userEmail]);

  if (!isOpen) return null;

  async function triggerBiometricAuth() {
    setLoading(true);
    setError("");

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("متصفحك لا يدعم قراءة البصمة البيومترية");
      }

      // 1. Get authentication challenge
      const res = await fetch("/api/auth/passkey/authenticate-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.options) {
        throw new Error(data.error || "تعذر بدء التحقق بالبصمة");
      }

      // 2. Prompt native browser/phone biometric prompt
      let asstResp;
      try {
        asstResp = await startAuthentication({ optionsJSON: data.options });
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          throw new Error("تم إلغاء عملية قراءة البصمة من قبل المستخدم");
        } else if (err.name === "NotSupportedError") {
          throw new Error("الجهاز أو المتصفح الحالي لا يدعم قراءة البصمة");
        }
        throw err;
      }

      if (!asstResp) {
        throw new Error("لم يتم قراءة البصمة بشكل صحيح");
      }

      // 3. Verify assertion on backend
      const verifyRes = await fetch("/api/auth/passkey/authenticate-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: userEmail,
          credential: asstResp,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || "فشل تأكيد البصمة في الخادم");
      }

      setVerified(true);
      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "تعذر إجراء التحقق البيومتري");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="relative w-full max-w-md rounded-3xl border border-cyan-500/30 bg-[#070d19] p-6 text-center shadow-2xl shadow-cyan-500/10 flex flex-col items-center gap-5">
        
        <button
          onClick={onCancel}
          className="absolute left-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          title="إلغاء"
        >
          <X size={20} />
        </button>

        {/* Icon Animation */}
        <div className={`relative flex items-center justify-center w-20 h-20 rounded-full border-2 transition-all duration-300 ${
          verified 
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
            : error 
              ? "border-red-500 bg-red-500/10 text-red-400"
              : "border-cyan-400 bg-cyan-400/10 text-cyan-400 animate-pulse"
        }`}>
          {verified ? (
            <CheckCircle2 size={42} className="animate-in zoom-in-50" />
          ) : error ? (
            <ShieldAlert size={42} />
          ) : (
            <Fingerprint size={46} className={loading ? "animate-bounce" : ""} />
          )}
        </div>

        {/* Text Details */}
        <div>
          <h3 className="text-lg font-extrabold text-white">
            {verified ? "تم تأكيد الهوية بالبصمة!" : "التحقق البيومتري من الهوية 🔒"}
          </h3>
          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed max-w-xs">
            {verified
              ? "تمت قراءة البصمة بنجاح، جاري فتح الجلسة..."
              : `الحساب (${userName || userId}) مُمكّن بحماية البصمة. يرجى مسح بصمة الأصبع لتأكيد الهوية لدخول الحساب.`}
          </p>
        </div>

        {/* Error message if any */}
        {error && (
          <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="text-right">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col w-full gap-2.5 mt-2">
          {!verified && (
            <button
              onClick={triggerBiometricAuth}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>جاري انتظار قراءة البصمة من الهاتف...</span>
                </>
              ) : (
                <>
                  <Fingerprint size={18} />
                  <span>اضغط هنا لمسح البصمة / Face ID</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
          >
            إلغاء تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
