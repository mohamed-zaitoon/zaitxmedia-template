"use client";

import { useEffect } from "react";
import { useAuth } from "./auth-context";

// ============================================================================
// 🔒 [EN] Verified Admin Emails with full console debugging privileges
// 🔒 [AR] الحسابات الإدارية المعتمدة التي يتاح لها استخدام الكونسول وتتبع الأخطاء
// ============================================================================
const ALLOWED_ADMIN_EMAILS = new Set([
  "mohamwdzaitoon242@gmail.com",
  "mohamedzaitoon242@gmail.com",
]);

/**
 * 🔒 [EN] Security Console Protection Hook:
 * Intercepts and silences browser console output for regular users to prevent devtools inspection.
 * Grants full unthrottled console debugging ONLY to authorized system administrators.
 * 
 * 🔒 [AR] خطاف حماية الكونسول وسجلات المتصفح:
 * يقوم بكتم وسحر كافة مخرجات الكونسول للمستخدمين العاديين لمنع التجسس أو التتبع عبر DevTools،
 * ويسمح بالتتبع الكامل فقط للمشرفين والمسؤولين المعترف بهم.
 */
export function useConsoleProtection() {
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userEmail = (user?.email || "").toLowerCase().trim();
    const userRole = user?.role || "user";
    const isAdmin = userRole === "admin" || ALLOWED_ADMIN_EMAILS.has(userEmail);

    if (!isAdmin) {
      // 🔒 [EN] Override console functions for non-admins
      // 🔒 [AR] تعطيل دوال الكونسول لغير الأدمن
      const emptyFn = () => {};
      try {
        window.console.log = emptyFn;
        window.console.info = emptyFn;
        window.console.debug = emptyFn;
        window.console.warn = emptyFn;
      } catch {}
    }
  }, [user]);
}
