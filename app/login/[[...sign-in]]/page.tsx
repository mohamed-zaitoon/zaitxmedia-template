"use client";

import { useEffect, useState } from "react";
import { SignIn } from "@clerk/nextjs";
import BiometricVerifyModal from "@/app/components/BiometricVerifyModal";

export default function Page() {
  const [isAdminLogin, setIsAdminLogin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Biometric state post-login verification
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricUserId, setBiometricUserId] = useState("");
  const [biometricUserName, setBiometricUserName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdminLogin(
      window.location.hostname === "admin.zaitxmedia.com"
      || params.get("mode") === "admin",
    );

    if (typeof window !== "undefined") {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("biometric_verified_")) {
          localStorage.removeItem(key);
        }
      }
    }
  }, []);

  async function performAdminSessionCreation() {
    setSubmitting(true);
    setAdminError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(
          response.status === 401
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : result?.error?.message || "تعذر إنشاء جلسة الإدارة",
        );
      }
      if (window.location.hostname === "admin.zaitxmedia.com") {
        window.location.replace("/");
      } else {
        window.location.replace("https://admin.zaitxmedia.com");
      }
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : "تعذر إنشاء جلسة الإدارة",
      );
    } finally {
      setSubmitting(false);
      setShowBiometricModal(false);
    }
  }

  async function handleAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError("");
    setSubmitting(true);

    try {
      // 1. Check if passkey fingerprint protection is enabled for this admin account
      const statusRes = await fetch("/api/auth/passkey/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: email }),
      });
      const statusData = await statusRes.json();

      if (statusData.hasPasskey) {
        // Biometric protection enabled -> prompt fingerprint scan FIRST before concluding login
        setSubmitting(false);
        setBiometricUserId(email);
        setBiometricUserName(email);
        setShowBiometricModal(true);
        return;
      }

      // No passkey -> conclude admin session directly
      await performAdminSessionCreation();
    } catch (error) {
      console.warn("Passkey status check error, falling back to session creation", error);
      await performAdminSessionCreation();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 80% 0%, rgba(6,182,212,.13), transparent 36rem), radial-gradient(circle at 0% 100%, rgba(59,130,246,.08), transparent 32rem), #050914",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      dir="rtl"
    >
      {/* Biometric Post-Login Verification Modal */}
      <BiometricVerifyModal
        isOpen={showBiometricModal}
        userId={biometricUserId}
        userName={biometricUserName}
        onSuccess={() => {
          performAdminSessionCreation();
        }}
        onCancel={() => {
          setShowBiometricModal(false);
          setSubmitting(false);
        }}
      />

      <div className="flex w-full max-w-md flex-col items-center gap-4">
        {isAdminLogin && (
          <div className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-center">
            <strong className="block text-cyan-300">دخول الإدارة المستقل</strong>
            <span className="mt-1 block text-xs leading-6 text-slate-400">
              استخدم حساب الإدارة المحفوظ في Firebase. هذه الجلسة لا تؤثر على
              حساب المتجر المفتوح.
            </span>
          </div>
        )}
        {adminError && (
          <div className="w-full rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">
            {adminError}
          </div>
        )}
        {isAdminLogin === false && (
          <SignIn routing="hash" />
        )}
        {isAdminLogin && (
          <form
            onSubmit={handleAdminLogin}
            className="premium-surface w-full rounded-3xl p-7 shadow-2xl"
          >
            <label className="mb-2 block text-sm text-slate-300" htmlFor="admin-email">
              البريد الإلكتروني
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left text-white outline-none focus:border-cyan-400/60"
              dir="ltr"
            />
            <label className="mb-2 block text-sm text-slate-300" htmlFor="admin-password">
              كلمة المرور
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mb-5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left text-white outline-none focus:border-cyan-400/60"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-extrabold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "جاري التحقق..." : "دخول لوحة الإدارة"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
