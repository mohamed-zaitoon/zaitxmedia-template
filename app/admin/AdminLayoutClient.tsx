"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import PasskeyButton from "@/app/components/PasskeyButton";
import {
  Settings, DollarSign, Wallet, Users, Package,
  Calculator, Zap, TrendingUp, ShieldAlert, Menu, BarChart3, LogOut
} from "lucide-react";

const tabs = [
  { id: "/", label: "الرئيسية", icon: <BarChart3 size={16} /> },
  { id: "/settings", label: "الإعدادات", icon: <Settings size={16} /> },
  { id: "/pricing", label: "الأسعار", icon: <DollarSign size={16} /> },
  { id: "/wallets", label: "المحافظ", icon: <Wallet size={16} /> },
  { id: "/users", label: "المستخدمون", icon: <Users size={16} /> },
  { id: "/orders", label: "الطلبات", icon: <Package size={16} /> },
  { id: "/calculator", label: "حاسبة الأرباح", icon: <Calculator size={16} /> },
  { id: "/recharges", label: "طلبات الشحن", icon: <DollarSign size={16} /> },
  { id: "/manual_svcs", label: "الخدمات اليدوية", icon: <Zap size={16} /> },
  { id: "/financial", label: "المالية والتغطية", icon: <TrendingUp size={16} /> },
];

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && result.success) {
          setIsAdmin(true);
          setAdminEmail(result.admin?.email || "");
        } else {
          if (response.status === 401) {
            window.location.replace("/login?mode=admin");
            return;
          }
          setAccessError(
            response.status === 403
              ? "هذا الحساب لا يمتلك صلاحيات الإدارة."
              : "تعذر التحقق من جلسة الإدارة. سجّل الدخول مجددًا.",
          );
        }
      })
      .catch(() => {
        if (active) setAccessError("تعذر الاتصال بخدمة التحقق من الصلاحيات.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checking)
    return (
      <div className="premium-loader-container">
        <span className="premium-loader-text">جاري التحقق...</span>
      </div>
    );

  if (!isAdmin)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fff",
        }}
        dir="rtl"
      >
        <div style={{ background: "#111", padding: 40, borderRadius: 20, border: "1px solid #262626", textAlign: "center", maxWidth: 440, width: "90%", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
          <ShieldAlert size={48} color="#fb7185" style={{ marginBottom: 20 }} />
          <h2 style={{ color: "#fff", marginBottom: 10 }}>الوصول غير مسموح</h2>
          <p style={{ color: "#999", lineHeight: 1.8, marginBottom: 24 }}>{accessError}</p>
          <button onClick={() => router.push("/")} style={{ width: "100%", padding: 12, background: "#38bdf8", color: "#03131b", fontWeight: 800, borderRadius: 10, border: "none", cursor: "pointer" }}>
            العودة إلى المتجر
          </button>
        </div>
      </div>
    );

  return (
    <div className="admin-shell" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-[99] bg-black/65 backdrop-blur-sm"
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`admin-sidebar ${mobileMenuOpen ? "open" : ""}`}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-14 h-1.5 rounded-full bg-amber-500/40 mx-auto my-2 shrink-0 md:hidden animate-pulse" />

        <div className="mb-4 border-b border-white/[0.07] px-3 pb-5">
            <div className="flex items-center gap-3">
              <img
                src="/admin-logo.png"
                alt="ZAITX MEDIA"
                className="h-11 w-11 rounded-xl border border-primary/20 object-cover"
              />
              <div>
                <h2 className="m-0 text-lg font-black text-white">ZAITX MEDIA</h2>
                <span className="text-[11px] font-semibold text-muted-foreground">مركز إدارة العمليات</span>
              </div>
            </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-1">
          {tabs.map((tab) => {
            // pathname from usePathname() returns internal path e.g. /admin/orders
            // tab.id uses short path e.g. /orders — normalize for comparison
            const normalizedPath = pathname.replace(/^\/admin/, "") || "/";
            const isActive = normalizedPath === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.id}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex h-11 w-full items-center gap-3 rounded-xl border px-3.5 text-sm transition ${
                  isActive
                    ? "border-primary/20 bg-primary/10 font-bold text-primary shadow-sm shadow-primary/5"
                    : "border-transparent font-medium text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.035] hover:text-white"
                }`}
              >
                {tab.icon} {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-white/[0.07] px-2 pt-4">
          <div className="mb-3 truncate rounded-lg bg-white/[0.035] px-3 py-2 text-[11px] text-slate-500" dir="ltr">
            {adminEmail}
          </div>
          <button
            onClick={async () => {
              const response = await fetch("/api/admin/push-enrollment", {
                credentials: "include",
                cache: "no-store",
              });
              const result = await response.json().catch(() => ({}));
              if (response.ok && result.url) window.open(result.url, "_blank", "noopener,noreferrer");
            }}
            className="mb-2 h-10 w-full rounded-xl border border-primary/20 bg-primary/[0.08] text-xs font-bold text-primary hover:bg-primary/[0.14]"
          >
            🔔 تفعيل إشعارات الإدارة
          </button>
          <div className="mb-2">
            <PasskeyButton userId={adminEmail || "admin"} userRole="admin" />
          </div>
          <button
            onClick={async () => {
              await fetch("/api/admin/session", {
                method: "DELETE",
                credentials: "include",
              });
              window.location.replace("/login?mode=admin");
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] text-xs font-bold text-red-400 hover:bg-red-500/[0.14]"
          >
            <LogOut size={16} /> تسجيل خروج
          </button>
        </div>
      </div>

      <div className="admin-workspace">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          style={{ position: "fixed", top: 16, right: 16, background: "#101a2d", border: "1px solid #1b2a43", color: "#fff", zIndex: 90, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Menu size={24} />
        </button>
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
