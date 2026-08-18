"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../lib/auth-context";

export default function ContentProtection() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 1. Check URL path / hostname / localStorage
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const lsUnlocked = typeof window !== "undefined" ? localStorage.getItem("admin_unlocked") === "true" : false;

    if (hostname.includes("admin") || pathname.startsWith("/admin") || lsUnlocked) {
      setIsAdmin(true);
      document.body.classList.add("admin-unlocked");
      return;
    }

    // 2. Check AuthContext user
    if (user) {
      const email = String(user.email || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      if (
        role === "admin" ||
        role === "management" ||
        user.isAdmin === true ||
        user.is_admin === true ||
        email.includes("zaitoon") ||
        email.endsWith("@admin.zaitxmedia.com") ||
        email === "mohamedzaitoon242@gmail.com" ||
        email === "admin@zaitxmedia.com"
      ) {
        setIsAdmin(true);
        document.body.classList.add("admin-unlocked");
        return;
      }
    }

    // 3. Check Firebase Auth listener
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (!user && !hostname.includes("admin") && !pathname.startsWith("/admin") && !lsUnlocked) {
          setIsAdmin(false);
          document.body.classList.remove("admin-unlocked");
        }
        return;
      }
      try {
        const email = (fbUser.email || "").toLowerCase();
        if (
          email.includes("zaitoon") ||
          email.endsWith("@admin.zaitxmedia.com") ||
          email === "mohamedzaitoon242@gmail.com" ||
          email === "admin@zaitxmedia.com"
        ) {
          setIsAdmin(true);
          document.body.classList.add("admin-unlocked");
          return;
        }

        const userSnap = await getDoc(doc(db, "users", fbUser.uid));
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (
            uData?.role === "admin" ||
            uData?.isAdmin === true ||
            uData?.is_admin === true ||
            uData?.role === "management"
          ) {
            setIsAdmin(true);
            document.body.classList.add("admin-unlocked");
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    // If user is Admin/Management or on Admin routes, do NOT lock copy, context menu, or devtools
    if (isAdmin) {
      document.body.classList.add("admin-unlocked");
      return;
    }

    document.body.classList.remove("admin-unlocked");

    // 1. Disable Inspection Hotkeys (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+C outside inputs)
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      if (!isInput && (e.ctrlKey || e.metaKey) && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      if (!isInput && (e.ctrlKey || e.metaKey) && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 2. Disable Copy Event outside input fields
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (!isInput) {
        e.preventDefault();
      }
    };

    // 3. Disable Drag and Drop of text and images
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (!isInput) {
        e.preventDefault();
      }
    };

    // 4. Console Protection & Warning Trap
    const printConsoleWarning = () => {
      if (typeof window !== "undefined" && window.console) {
        console.clear();
        console.log(
          "%c⛔ تنبيه أمني مشدد (ZAITX MEDIA)%c\n\nيمنع منعاً باتاً محاولة سحب أو نسخ محتوى الموقع أو فحص الأكواد التفاعلية. جميع أنشطة المتصفح المحمية مسجلة ومؤمنة.",
          "color: #ef4444; font-size: 20px; font-weight: bold; background: #0f172a; padding: 10px; border-radius: 8px;",
          "color: #38bdf8; font-size: 14px; font-weight: bold;"
        );
      }
    };

    printConsoleWarning();
    const interval = setInterval(printConsoleWarning, 4000);

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      clearInterval(interval);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, [isAdmin]);

  return null;
}
