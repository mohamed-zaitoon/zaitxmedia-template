"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { MAX_WALLET_BALANCE_EGP, grossDepositRequiredForNet } from "@/lib/money/wallet";
import GenericCustomSelect from "../components/GenericCustomSelect";
import { toast } from "sonner";

import { db } from "../lib/firebase";

import {
  setDoc,
  getDoc,
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  onSnapshot,
  where,
  limit,
} from "firebase/firestore";
import {
  LogOut,
  Save,
  Settings,
  Package,
  Users,
  Layers,
  DollarSign,
  Phone,
  Wallet,
  TrendingUp,
  Shield,
  ShieldAlert,
  X,
  Plus,
  Trash2,
  BarChart3,
  Bell,
  Clock,
  CheckCircle,
  Globe,
  ShieldCheck,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Home,
  Zap,
  Ban,
  UserCheck,
  Key,
  Mail,
  Database,
  Calculator,
  Edit3,
  Filter,
  EyeOff,
  Menu,
} from "lucide-react";
import Swal from "sweetalert2";
import { FinancialTab } from "./FinancialTab";
import { SecurityTab } from "./SecurityTab";
import { calculateTikTokPriceEgp, calculateTikTokOriginalPriceEgp, ceilTo2Decimals, type TikTokPricingTier } from "@/lib/pricing/tiktok";
import { calculateManualServicePriceEgp, getManualServicePriceUsd, calculateManualServiceOriginalPriceEgp } from "@/lib/pricing/manual-service";
import { isGlobalUsdDiscountActive } from "@/lib/pricing/pricing-discount";

function calculateExactRemainingTimeText(expiresAt?: string | null): string {
  if (!expiresAt) return "فترة محدودة";
  const expireTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expireTime)) return "فترة محدودة";
  const diffMs = expireTime - Date.now();
  if (diffMs <= 0) return "فترة محدودة";

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / (3600 * 24));
  const hours = Math.floor((totalSecs % (3600 * 24)) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (mins > 0 || (days === 0 && hours === 0)) parts.push(`${mins} دقيقة`);

  return parts.join(" و ");
}

const tabs = [
  { id: "dashboard", label: "الرئيسية", icon: <BarChart3 size={16} /> },
  { id: "settings", label: "الإعدادات", icon: <Settings size={16} /> },
  { id: "security", label: "حماية النظام", icon: <ShieldCheck size={16} /> },
  { id: "pricing", label: "الأسعار", icon: <DollarSign size={16} /> },
  { id: "wallets", label: "المحافظ", icon: <Wallet size={16} /> },
  { id: "users", label: "المستخدمون", icon: <Users size={16} /> },
  { id: "orders", label: "الطلبات", icon: <Package size={16} /> },
  { id: "calculator", label: "حاسبة الأرباح", icon: <Calculator size={16} /> },
  { id: "recharges", label: "طلبات الشحن", icon: <DollarSign size={16} /> },
  { id: "sms_review", label: "مراجعة SMS", icon: <Phone size={16} /> },
  { id: "manual_svcs", label: "الخدمات اليدوية", icon: <Zap size={16} /> },
  { id: "financial", label: "المالية والتغطية", icon: <TrendingUp size={16} /> },
];

async function fetchAdminData(resource: string) {
  const response = await fetch(
    `/api/admin/data?resource=${encodeURIComponent(resource)}`,
    { credentials: "include", cache: "no-store" },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result?.error?.message || result?.error || "تعذر تحميل البيانات");
  }
  return result;
}

async function writeAdminData(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result?.error?.message || result?.error || "تعذر حفظ البيانات");
  }
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsAdmin(user?.role === "admin");
    setChecking(false);
  }, [user]);

  const handleLogin = (e: any) => {
    e.preventDefault();
    router.push("/login");
  };

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
        <form onSubmit={handleLogin} style={{ background: "#111", padding: 40, borderRadius: 16, border: "1px solid #222", textAlign: "center", maxWidth: 400, width: "90%" }}>
          <Shield size={48} color="#38bdf8" style={{ marginBottom: 20 }} />
          <h2 style={{ color: "#fff", marginBottom: 20 }}>تسجيل دخول الإدارة</h2>
          <input 
            type="password" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)} 
            placeholder="أدخل رمز المرور (PIN)" 
            style={{ width: "100%", padding: 12, borderRadius: 8, background: "#1a1a1a", color: "#fff", border: "1px solid #333", marginBottom: 20, textAlign: "center", letterSpacing: 4 }}
          />
          <button type="submit" style={{ width: "100%", padding: 12, background: "#38bdf8", color: "#000", fontWeight: "bold", borderRadius: 8, border: "none", cursor: "pointer" }}>
            دخول
          </button>
        </form>
      </div>
    );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#060812] via-[#090d1a] to-[#04060d] text-slate-100 flex font-sans"
      dir="rtl"
    >
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[80] md:hidden animate-in fade-in duration-200"
        />
      )}
      
      {/* Sidebar - Desktop relative sidebar & Mobile Floating Bottom Sheet Drawer */}
      <div
        className={`bg-[#0a0f1d]/98 border-amber-500/30 py-3.5 flex flex-col shrink-0 z-[100] backdrop-blur-2xl transition-all duration-300 ${
          mobileMenuOpen
            ? "fixed bottom-3 left-5 right-5 w-[calc(100%-40px)] max-h-[68vh] rounded-[2rem] border border-amber-500/40 shadow-[0_15px_50px_rgba(0,0,0,0.95)] animate-in slide-in-from-bottom duration-300 md:hidden font-sans overflow-hidden"
            : "hidden md:flex relative top-0 bottom-0 w-64 border-l"
        }`}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-10 h-1 rounded-full bg-amber-500/50 mx-auto mb-1.5 shrink-0 md:hidden" />

        {/* Brand Header */}
        <div className="px-4 pb-2.5 border-b border-slate-800/80 mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 text-base font-black flex items-center gap-2">
              <Zap size={18} className="text-amber-400 fill-amber-400/20" /> ZAITX MEDIA
            </h2>
            <span className="text-[10px] text-amber-400/80 font-bold mt-0.5 block">
              لوحة التحكم الاحترافية — VIP Admin
            </span>
          </div>
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-7 h-7 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Server Status Badge */}
        <div className="px-4 mb-2">
          <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-[10px] text-emerald-400 font-extrabold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>السيرفر متصل ويعمل بكفاءة 🟢</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="px-3 flex-1 overflow-y-auto space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-h-[48vh] md:max-h-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className={`w-full px-4 py-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 text-xs md:text-sm font-black cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-transparent border-amber-500/80 text-amber-300 shadow-lg shadow-amber-500/15 scale-[1.01]"
                    : "bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                }`}
              >
                <div className={`p-2 rounded-xl ${isActive ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400"}`}>
                  {tab.icon}
                </div>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Badge & Logout */}
        <div className="p-4 border-t border-slate-800/80 mt-2 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 truncate font-mono font-bold">
            {user?.email}
          </div>
          <button
            onClick={async () => {
              await signOutUser();
            }}
            className="w-full py-3 px-4 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto w-full pb-36 md:pb-48">
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-8 bg-slate-950/80 border border-cyan-500/20 p-4 rounded-2xl backdrop-blur-xl shadow-xl flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-xl bg-slate-900 text-cyan-400 border border-cyan-500/30 cursor-pointer"
                aria-label="القائمة"
              >
                <Menu size={20} />
              </button>
              <h1 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-3 m-0">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {tabs.find((t) => t.id === activeTab)?.icon}
                </div>
                <span>{tabs.find((t) => t.id === activeTab)?.label}</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-black border border-cyan-500/30 transition-all flex items-center gap-2 no-underline"
              >
                <Home size={15} /> العودة للمتجر
              </a>
              <button
                onClick={async () => {
                  await signOutUser();
                }}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                aria-label="خروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>



        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "pricing" && <PricingTab />}
        {activeTab === "wallets" && <WalletsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "calculator" && <CalculatorTab />}
        {activeTab === "recharges" && <RechargesTab />}
        {activeTab === "sms_review" && <SmsReviewTab />}
        {activeTab === "manual_svcs" && <ManualServicesTab />}
        {activeTab === "financial" && <FinancialTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function DashboardTab() {
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    admins: 0,
    pending: 0,
  });
  const [statsError, setStatsError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/dashboard", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result?.error?.message || result?.error || "تعذر تحميل الإحصائيات");
        }
        if (active) setStats(result.stats);
      })
      .catch((error) => {
        if (active) {
          setStatsError(
            error instanceof Error ? error.message : "تعذر تحميل الإحصائيات",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-bold text-amber-400">مركز العمليات والرصد المباشر</span>
          <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">مرحبًا بك في لوحة تحكم ZAITX MEDIA</h1>
          <p className="mt-2 text-sm text-slate-400">رصد شامل للمستخدمين، الطلبات، الإيداعات، وإعدادات الأسعار والعملات.</p>
        </div>
        <div className="w-fit rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-400 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>النظام يعمل بكفاءة 100% 🟢</span>
        </div>
      </div>

      {statsError && <p className="mb-4 text-red-400 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{statsError}</p>}

      {/* Primary Statistics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {[
          {
            label: "المستخدمون المسجلون",
            value: stats.users,
            icon: <Users size={24} />,
            color: "#fbbf24",
            bg: "rgba(251,191,36,0.1)",
          },
          {
            label: "إجمالي الطلبات",
            value: stats.orders,
            icon: <Package size={24} />,
            color: "#38bdf8",
            bg: "rgba(56,189,248,0.1)",
          },
          {
            label: "طلبات شحن معلقة",
            value: stats.pending,
            icon: <Clock size={24} />,
            color: "#f87171",
            bg: "rgba(248,113,113,0.1)",
          },
          {
            label: "حسابات الإدارة (Admins)",
            value: stats.admins,
            icon: <Shield size={24} />,
            color: "#34d399",
            bg: "rgba(52,211,153,0.1)",
          },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              background: "linear-gradient(145deg, rgba(15,25,43,.95), rgba(8,14,26,.98))",
              padding: 24,
              borderRadius: 20,
              border: "1px solid rgba(245,158,11,0.2)",
              boxShadow: "0 18px 45px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  color: c.color,
                  background: c.bg,
                  padding: 12,
                  borderRadius: 14,
                }}
              >
                {c.icon}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#ffffff" }}>{c.value}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4, fontWeight: 700 }}>
                  {c.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Control Hub */}
      <div className="rounded-3xl border border-amber-500/25 bg-[#0a0f1d]/95 p-6 md:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-xl font-black text-white flex items-center gap-3">
            <Zap size={24} className="text-amber-400 fill-amber-400/20" /> اختصارات التحكم والوصول السريع
          </h2>
          <span className="text-xs text-amber-400 font-extrabold px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">لوحة التحكم المركزية ⚡</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 via-slate-900/50 to-transparent flex flex-col justify-between gap-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <DollarSign size={22} />
                </div>
                <h3 className="font-black text-white text-lg">💰 إعدادات الأسعار والريال والخصومات</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2">
                التحكم المباشر بسعر صرف الريال السعودي، التخفيضات العامة، تكلفة 1000 تيك توك، وتعديل أسعار الشرائح فورياً.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const btn = document.querySelector('button[key="pricing"]') || document.querySelectorAll('nav button')[2];
                if (btn) (btn as HTMLElement).click();
              }}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm md:text-base text-center border border-amber-300/40 hover:scale-[1.01] active:scale-95 transition-all duration-200 cursor-pointer shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>التحكم في الأسعار والشرائح ⚡</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl border border-sky-500/25 bg-gradient-to-b from-sky-500/10 via-slate-900/50 to-transparent flex flex-col justify-between gap-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    <Wallet size={22} />
                  </div>
                  <h3 className="font-black text-white text-lg">💳 طلبات شحن المحفظة</h3>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-black border border-sky-500/30">
                  معلقة: {stats.pending}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2">
                مراجعة وتأكيد إيداعات الحسابات عبر فودافون كاش، انستاباي، تحويل برق، والإيداعات البنكية المباشرة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const btn = document.querySelectorAll('nav button')[7];
                if (btn) (btn as HTMLElement).click();
              }}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-600 text-slate-950 font-black text-sm md:text-base text-center border border-sky-300/40 hover:scale-[1.01] active:scale-95 transition-all duration-200 cursor-pointer shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2"
            >
              <span>مراجعة طلبات الشحن 💳</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 via-slate-900/50 to-transparent flex flex-col justify-between gap-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Globe size={22} />
                </div>
                <h3 className="font-black text-white text-lg">🌍 إدارة الدول والعملات المخصصة</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2">
                تفعيل وإلغاء الدول المتاحة للمستخدمين، وتخصيص العملات التلقائية لكل دولة (الريال السعودي 🇸🇦 والجنيه المصري 🇪🇬).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const btn = document.querySelectorAll('nav button')[1];
                if (btn) (btn as HTMLElement).click();
              }}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 text-slate-950 font-black text-sm md:text-base text-center border border-emerald-300/40 hover:scale-[1.01] active:scale-95 transition-all duration-200 cursor-pointer shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <span>إدارة الدول وطرق الدفع 🌍</span>
            </button>
          </div>

          <div 
            onClick={() => {
              const securityTabBtn = document.querySelector('[data-tab="security"]') as HTMLElement;
              if (securityTabBtn) {
                securityTabBtn.click();
              } else {
                const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes("حماية النظام"));
                btn?.click();
              }
            }}
            className="p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-500/15 via-slate-900/60 to-slate-900/90 flex flex-col justify-between gap-6 shadow-xl hover:border-purple-500/60 transition-all cursor-pointer group"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={22} />
                </div>
                <h3 className="font-black text-white text-lg">🛡️ حماية النظام والتدقيق المباشر</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2">
                فحص التوقيعات المشفرة لرسائل الـ SMS، تتبع تشفير HMAC، ومراقبة أمان الحسابات بنظام الحماية الفائق.
              </p>
            </div>
            <button
              type="button"
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 text-white font-black text-sm md:text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 group-hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <ShieldCheck size={18} />
              <span>فتح مركز الحماية والتدقيق المباشر 🚀</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function isoToDatetimeLocal(isoStr?: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function datetimeLocalToIso(localStr: string): string {
  if (!localStr) return "";
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

function getRemainingTimeString(isoStr?: string | null): string {
  if (!isoStr) return "";
  const expireTime = new Date(isoStr).getTime();
  if (isNaN(expireTime)) return "";
  const diffMs = expireTime - Date.now();
  if (diffMs <= 0) return "منتهي الآن ⚠️";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} دقيقة`);

  return `متبقي: ${parts.join(" و ")}`;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function SettingsTab() {
  const [form, setForm] = useState({
    whatsapp: "",
    usdRate: "55",
    tiktokCostUsd: "10.3",
    minCoins: "30",
    maxCoins: "2500000",
    depositFeePercent: "0.57",
    walletFeePercent: "0.57",
    instapayFeePercent: "0.57",
    bankFeePercent: "0.57",
    barqFeePercent: "0.57",
    depositFeeMinEgp: "0.5",
    depositFeeMaxEgp: "20",
    maxWalletBalanceUsd: "20000",
    globalUsdDiscountEnabled: false,
    globalUsdDiscountPercent: "10",
    globalUsdDiscountMaxAmount: "0",
    globalUsdDiscountExpiresAt: "",
    sarRateOverride: "13.33",
    sarDeduction: "0.20",
    sarMinDeposit: "10",
    sarMaxDeposit: "10000",
    sarDepositFeeMin: "0",
    sarDepositFeeMax: "0",
    symbolEgp: "£",
    symbolSar: "﷼",
    symbolUsd: "$",
    supportedCountries: ["EG", "SA", "AE", "KW", "QA", "GLOBAL"],
    defaultUiStyle: "glass",
    defaultUiTheme: "cyber",
    defaultFloatingBar: true,
  });
  const [customCountries, setCustomCountries] = useState<any[]>([
    { code: "AE", name: "الإمارات", currency: "AED", flag: "🇦🇪" },
    { code: "KW", name: "الكويت", currency: "KWD", flag: "🇰🇼" },
    { code: "QA", name: "قطر", currency: "QAR", flag: "🇶🇦" },
    { code: "OM", name: "عُمان", currency: "OMR", flag: "🇴🇲" },
    { code: "BH", name: "البحرين", currency: "BHD", flag: "🇧🇭" },
  ]);
  const [newCountry, setNewCountry] = useState({ name: "", code: "", currency: "", flag: "🌍" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [siteEnabled, setSiteEnabled] = useState(true);
  const [siteToggleBusy, setSiteToggleBusy] = useState(false);

  useEffect(() => {
    fetchAdminData("settings/pricing").then((result) => {
      if (result.exists) {
        const v = result.data;
        const cs = v.currency_symbols || v.currencySymbols || {};
        if (Array.isArray(v.custom_countries) && v.custom_countries.length > 0) {
          setCustomCountries(v.custom_countries);
        }
        setForm((f) => ({
          ...f,
          usdRate: String(v.usd_rate || v.tiktok_usd_rate || "55"),
          tiktokCostUsd: String(v.tiktok_cost_usd || "10.3"),
          minCoins: String(v.tiktok_min_coins || "30"),
          maxCoins: String(v.tiktok_max_coins || "2500000"),
          depositFeePercent: String(v.deposit_fee_percent ?? v.depositFeePercent ?? 0.57),
          walletFeePercent: String(v.wallet_fee_percent ?? v.walletFeePercent ?? v.vodafone_fee_percent ?? v.deposit_fee_percent ?? v.depositFeePercent ?? 0.57),
          instapayFeePercent: String(v.instapay_fee_percent ?? v.instapayFeePercent ?? v.deposit_fee_percent ?? v.depositFeePercent ?? 0.57),
          bankFeePercent: String(v.bank_fee_percent ?? v.bankFeePercent ?? v.deposit_fee_percent ?? v.depositFeePercent ?? 0.57),
          barqFeePercent: String(v.barq_fee_percent ?? v.barqFeePercent ?? v.deposit_fee_percent ?? v.depositFeePercent ?? 0.57),
          depositFeeMinEgp: String(v.deposit_fee_min_egp ?? v.depositFeeMinEgp ?? 0.5),
          depositFeeMaxEgp: String(v.deposit_fee_max_egp ?? v.depositFeeMaxEgp ?? 20),
          maxWalletBalanceUsd: String(v.max_wallet_balance_usd ?? v.maxWalletBalanceUsd ?? 20000),
          sarRateOverride: String(v.sar_rate_override || "13.33"),
          sarDeduction: String(v.sar_deduction ?? v.sarDeduction ?? "0.20"),
          sarMinDeposit: String(v.sar_min_deposit || "10"),
          sarMaxDeposit: String(v.sar_max_deposit || "10000"),
          sarDepositFeeMin: String(v.sar_deposit_fee_min ?? v.sarDepositFeeMin ?? "0"),
          sarDepositFeeMax: String(v.sar_deposit_fee_max ?? v.sarDepositFeeMax ?? "0"),
          symbolEgp: cs.egp || cs.EGP || "£",
          symbolSar: cs.sar || cs.SAR || "﷼",
          symbolUsd: cs.usd || cs.USD || "$",
          supportedCountries: Array.isArray(v.supported_countries) ? v.supported_countries : ["EG", "SA", "AE", "KW", "QA", "GLOBAL"],
          globalUsdDiscountEnabled: Boolean(v.global_usd_discount_enabled ?? v.globalUsdDiscountEnabled ?? false),
          globalUsdDiscountPercent: String(v.global_usd_discount_percent ?? v.globalUsdDiscountPercent ?? 10),
          globalUsdDiscountMaxAmount: String(v.global_usd_discount_max_amount ?? v.globalUsdDiscountMaxAmount ?? 0),
          globalUsdDiscountExpiresAt: String(v.global_usd_discount_expires_at ?? v.globalUsdDiscountExpiresAt ?? ""),
        }));
      }
    }).catch(console.error);
    fetchAdminData("settings/site").then((result) => {
      if (result.exists) {
        const v = result.data;
        setForm((f) => ({
          ...f,
          whatsapp: v.whatsapp || "",
          defaultUiStyle: v.defaultUiStyle || v.default_ui_style || "glass",
          defaultUiTheme: v.defaultUiTheme || v.default_ui_theme || "cyber",
          defaultFloatingBar: v.defaultFloatingBar !== false,
        }));
        setSiteEnabled(v.site_enabled !== false);
      }
    }).catch(console.error);
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg("");
    const feePercent = Number(form.depositFeePercent);
    const walletFee = Number(form.walletFeePercent);
    const instapayFee = Number(form.instapayFeePercent);
    const bankFee = Number(form.bankFeePercent);
    const barqFee = Number(form.barqFeePercent);
    const feeMin = Number(form.depositFeeMinEgp);
    const feeMax = Number(form.depositFeeMaxEgp);
    const maxBalanceUsd = Number(form.maxWalletBalanceUsd);

    if (isNaN(feePercent) || feePercent < 0) {
      setMsg("❌ نسبة رسوم الإيداع يجب أن تكون رقم أكبر من أو يساوي 0");
      setBusy(false);
      return;
    }
    if (isNaN(feeMin) || feeMin < 0) {
      setMsg("❌ الحد الأدنى لخصم الرسوم يجب أن يكون رقم أكبر من أو يساوي 0");
      setBusy(false);
      return;
    }
    if (isNaN(feeMax) || feeMax < 0) {
      setMsg("❌ الحد الأقصى لخصم الرسوم يجب أن يكون رقم أكبر من أو يساوي 0");
      setBusy(false);
      return;
    }
    if (feeMax > 0 && feeMax < feeMin) {
      setMsg("❌ الحد الأقصى يجب أن يكون أكبر من أو يساوي الحد الأدنى (أو 0 بدون حد أقصى)");
      setBusy(false);
      return;
    }
    if (isNaN(maxBalanceUsd) || maxBalanceUsd <= 0) {
      setMsg("❌ الحد الأقصى لرصيد المحفظة يجب أن يكون رقم أكبر من 0");
      setBusy(false);
      return;
    }

    const pricing = {
      usd_rate: +form.usdRate,
      tiktok_cost_usd: +form.tiktokCostUsd,
      tiktok_min_coins: +form.minCoins,
      tiktok_max_coins: +form.maxCoins,
      deposit_fee_percent: feePercent,
      wallet_fee_percent: Number.isFinite(walletFee) && walletFee >= 0 ? walletFee : feePercent,
      walletFeePercent: Number.isFinite(walletFee) && walletFee >= 0 ? walletFee : feePercent,
      instapay_fee_percent: Number.isFinite(instapayFee) && instapayFee >= 0 ? instapayFee : feePercent,
      instapayFeePercent: Number.isFinite(instapayFee) && instapayFee >= 0 ? instapayFee : feePercent,
      bank_fee_percent: Number.isFinite(bankFee) && bankFee >= 0 ? bankFee : feePercent,
      bankFeePercent: Number.isFinite(bankFee) && bankFee >= 0 ? bankFee : feePercent,
      barq_fee_percent: Number.isFinite(barqFee) && barqFee >= 0 ? barqFee : feePercent,
      barqFeePercent: Number.isFinite(barqFee) && barqFee >= 0 ? barqFee : feePercent,
      deposit_fee_min_egp: feeMin,
      deposit_fee_max_egp: feeMax,
      max_wallet_balance_usd: maxBalanceUsd,
      maxWalletBalanceUsd: maxBalanceUsd,
      global_usd_discount_enabled: form.globalUsdDiscountEnabled,
      global_usd_discount_percent: Number(form.globalUsdDiscountPercent) || 0,
      global_usd_discount_max_amount: Number(form.globalUsdDiscountMaxAmount) || 0,
      global_usd_discount_expires_at: form.globalUsdDiscountExpiresAt || null,
      sar_deduction: Number(form.sarDeduction) || 0,
      sarDeduction: Number(form.sarDeduction) || 0,
      sar_rate_override: Number(form.sarRateOverride) || Math.round((((Number(form.usdRate) || 50.0) / 3.75) - (Number(form.sarDeduction) || 0)) * 100) / 100,
      sar_min_deposit: Number(form.sarMinDeposit) || 10,
      sar_max_deposit: Number(form.sarMaxDeposit) || 10000,
      sar_deposit_fee_min: Number(form.sarDepositFeeMin) || 0,
      sarDepositFeeMin: Number(form.sarDepositFeeMin) || 0,
      sar_deposit_fee_max: Number(form.sarDepositFeeMax) || 0,
      sarDepositFeeMax: Number(form.sarDepositFeeMax) || 0,
      currency_symbols: {
        egp: form.symbolEgp.trim() || "£",
        sar: form.symbolSar.trim() || "﷼",
        usd: form.symbolUsd.trim() || "$",
      },
      supported_countries: form.supportedCountries,
      custom_countries: customCountries,
    };
    const site = {
      whatsapp: form.whatsapp.trim(),
      defaultUiStyle: form.defaultUiStyle,
      default_ui_style: form.defaultUiStyle,
      defaultUiTheme: form.defaultUiTheme,
      default_ui_theme: form.defaultUiTheme,
      defaultFloatingBar: form.defaultFloatingBar,
      default_floating_bar: form.defaultFloatingBar,
    };
    await Promise.all([
      writeAdminData({ action: "setDocument", resource: "settings/pricing", data: pricing }),
      writeAdminData({ action: "setDocument", resource: "settings/site", data: site }),
    ]);
    setMsg("✅ تم الحفظ");
    setBusy(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const toggleSite = async () => {
    const nextEnabled = !siteEnabled;
    const { isConfirmed } = await Swal.fire({
      title: nextEnabled ? "تشغيل الموقع للمستخدمين؟" : "إيقاف الموقع للمستخدمين؟",
      text: nextEnabled
        ? "سيتمكن المستخدمون من فتح الموقع وتنفيذ طلبات جديدة."
        : "ستظهر شاشة الصيانة ولن يتم قبول طلبات أو عمليات شحن جديدة.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: nextEnabled ? "تشغيل الموقع" : "إيقاف الموقع",
      cancelButtonText: "إلغاء",
      background: "#111827",
      color: "#fff",
      confirmButtonColor: nextEnabled ? "#10b981" : "#ef4444",
    });
    if (!isConfirmed) return;
    setSiteToggleBusy(true);
    try {
      await writeAdminData({
        action: "setDocument",
        resource: "settings/site",
        data: { site_enabled: nextEnabled },
      });
      setSiteEnabled(nextEnabled);
      setMsg(nextEnabled ? "✅ تم تشغيل الموقع للمستخدمين" : "✅ تم إيقاف الموقع للمستخدمين");
    } finally {
      setSiteToggleBusy(false);
    }
  };

  return (
    <div style={{ width: "100%" }} className="pb-32">
      <Card title="🛠️ حالة الموقع للمستخدمين">
        <div className={`mb-4 rounded-2xl border p-4 text-center font-bold ${siteEnabled ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-red-500/25 bg-red-500/10 text-red-400"}`}>
          {siteEnabled ? "الموقع يعمل حاليًا للمستخدمين" : "الموقع متوقف حاليًا وتظهر شاشة الصيانة"}
        </div>
        <button
          type="button"
          onClick={toggleSite}
          disabled={siteToggleBusy}
          className={`h-12 w-full rounded-xl font-black text-white disabled:opacity-50 ${siteEnabled ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
        >
          {siteToggleBusy ? "جاري التنفيذ..." : siteEnabled ? "⛔ إيقاف الموقع للمستخدمين" : "✅ تشغيل الموقع للمستخدمين"}
        </button>
      </Card>



      <Card title="📱 معلومات التواصل">
        <div>
          <label style={lbl}>رقم الواتساب</label>
          <input
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            style={inp}
            placeholder="2010xxxxxxx"
            dir="ltr"
          />
        </div>
      </Card>

      <Card title="💵 أسعار الدولار ورسوم الإيداع والحد الأقصى">
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
      {[
        ["🌐 سعر الدولار الرئيسي للموقع (ج.م)", "usdRate"],
        ["🎞️ تكلفة 1000 تيك توك ($)", "tiktokCostUsd"],
        ["📱 نسبة رسوم المحافظ / فودافون كاش (%)", "walletFeePercent"],
        ["⚡ نسبة رسوم انستاباي InstaPay (%)", "instapayFeePercent"],
        ["🏦 نسبة رسوم التحويل البنكي (%)", "bankFeePercent"],
        ["🇸🇦 نسبة رسوم تحويل برق (Barq) (%)", "barqFeePercent"],
        ["💸 نسبة رسوم الإيداع العامة (افتراضي %)", "depositFeePercent"],
        ["🔻 الحد الأدنى لخصم الرسوم (ج.م)", "depositFeeMinEgp"],
        ["🔺 الحد الأقصى لخصم الرسوم (ج.م)", "depositFeeMaxEgp"],
        ["💰 الحد الأقصى لرصيد المحفظة لكل مستخدم ($)", "maxWalletBalanceUsd"],
      ].map(([l, k]) => (
            <div key={k}>
              <label style={lbl}>{l}</label>
              <input
                type="number"
                step="0.01"
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                style={inp}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border/50">
          <h4 className="text-xs font-black text-cyan-400 mb-3 flex items-center gap-2">
            🔣 التحكم الإداري بخصائص ورموز العملات (Custom Currency Symbols)
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>🇪🇬 رمز الجنيه المصري (EGP Symbol)</label>
              <input
                type="text"
                value={form.symbolEgp}
                onChange={(e) => setForm({ ...form, symbolEgp: e.target.value })}
                style={inp}
                placeholder="مثال: £"
              />
            </div>
            <div>
              <label style={lbl}>🇸🇦 رمز الريال السعودي (SAR Symbol)</label>
              <input
                type="text"
                value={form.symbolSar}
                onChange={(e) => setForm({ ...form, symbolSar: e.target.value })}
                style={inp}
                placeholder="مثال: ﷼"
              />
            </div>
            <div>
              <label style={lbl}>🇺🇸 رمز الدولار الأمريكي (USD Symbol)</label>
              <input
                type="text"
                value={form.symbolUsd}
                onChange={(e) => setForm({ ...form, symbolUsd: e.target.value })}
                style={inp}
                placeholder="مثال: $"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="mb-4 bg-gradient-to-r from-emerald-950/20 via-slate-900/40 to-slate-900/40 p-4.5 rounded-2xl border border-emerald-500/30 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-4 justify-start flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => {
                    const nextEnabled = !f.globalUsdDiscountEnabled;
                    const defaultExpiry = nextEnabled && !f.globalUsdDiscountExpiresAt
                      ? new Date(Date.now() + 24 * 3600 * 1000).toISOString()
                      : f.globalUsdDiscountExpiresAt;
                    return {
                      ...f,
                      globalUsdDiscountEnabled: nextEnabled,
                      globalUsdDiscountExpiresAt: defaultExpiry,
                    };
                  })
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 shadow-md cursor-pointer shrink-0 ${
                  form.globalUsdDiscountEnabled
                    ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-400/40 hover:brightness-110 active:scale-95"
                    : "bg-slate-800/80 text-slate-400 border border-slate-700 hover:bg-slate-700/80 hover:text-slate-200 active:scale-95"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${form.globalUsdDiscountEnabled ? "bg-slate-950 animate-pulse" : "bg-slate-500"}`} />
                {form.globalUsdDiscountEnabled ? "✅ الخصم العام مفعل" : "❌ الخصم العام معطل"}
              </button>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-foreground flex items-center gap-2">
                  <span>🔥 تفعيل الخصم العام على أسعار الدولار (Global USD Discount)</span>
                </div>
                <div className="text-xs text-muted-foreground/80 mt-0.5">
                  تطبيق نسبة خصم عامة على الخدمات والسلع بقيمة 10$ دولار (أو ما يعادلها بالجنيه/الريال) فأكثر
                </div>
              </div>
            </div>
          </div>

          {form.globalUsdDiscountEnabled && (
            <div className="space-y-4">
              <div>
                <label style={lbl}>نسبة الخصم العامة على أسعار الدولار (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.globalUsdDiscountPercent}
                  onChange={(e) => setForm({ ...form, globalUsdDiscountPercent: e.target.value })}
                  style={inp}
                  placeholder="10"
                />
              </div>

              <div>
                <label style={lbl}>🛑 الحد الأقصى لمبلغ الخصم بالدولار ($) [0 تعني بدون حد أقصى]</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.globalUsdDiscountMaxAmount}
                  onChange={(e) => setForm({ ...form, globalUsdDiscountMaxAmount: e.target.value })}
                  style={inp}
                  placeholder="مثال: 20 (أو 0 لعدم التحديد)"
                />
              </div>

              <div>
                <label style={lbl}>⏳ مدة وتوقيت الخصم المؤقت (تاريخ وساعة الانتهاء تلقائياً)</label>
                <div className="flex items-center gap-2 flex-wrap mb-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, globalUsdDiscountExpiresAt: "" }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      !form.globalUsdDiscountExpiresAt
                        ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    ♾️ خصم دائم (بدون انتهاء)
                  </button>
                  {[
                    ["⏱️ ساعة 1", 1],
                    ["⏱️ 6 ساعات", 6],
                    ["⏱️ 12 ساعة", 12],
                    ["⏱️ 24 ساعة (يوم)", 24],
                    ["⏱️ 48 ساعة (يومان)", 48],
                    ["⏱️ 72 ساعة (3 أيام)", 72],
                    ["⏱️ 7 أيام (أسبوع)", 168],
                    ["⏱️ 30 يوم (شهر)", 720],
                  ].map(([label, hours]) => {
                    const targetTime = new Date(Date.now() + (hours as number) * 3600 * 1000).toISOString();
                    return (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, globalUsdDiscountExpiresAt: targetTime }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap bg-background/60 p-3 rounded-xl border border-border">
                  <div className="flex-1 min-w-[220px]">
                    <span className="block text-xs text-muted-foreground mb-1 font-bold">📅 تحديد التاريخ والوقت المخصص:</span>
                    <input
                      type="datetime-local"
                      value={isoToDatetimeLocal(form.globalUsdDiscountExpiresAt)}
                      onChange={(e) => setForm({ ...form, globalUsdDiscountExpiresAt: datetimeLocalToIso(e.target.value) })}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  {form.globalUsdDiscountExpiresAt && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, globalUsdDiscountExpiresAt: "" })}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
                      >
                        🗑️ إلغاء التوقيت
                      </button>
                    </div>
                  )}
                </div>

                {form.globalUsdDiscountExpiresAt && (
                  <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex items-center justify-between flex-wrap gap-2 mt-3">
                    <span>⏳ سينتهي الخصم تلقائياً في: <strong>{new Date(form.globalUsdDiscountExpiresAt).toLocaleString("ar-EG")}</strong></span>
                    <span className="font-mono bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-300">
                      {getRemainingTimeString(form.globalUsdDiscountExpiresAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="🎯 حدود تيك توك">
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <div>
            <label style={lbl}>الحد الأدنى</label>
            <input
              type="number"
              value={form.minCoins}
              onChange={(e) => setForm({ ...form, minCoins: e.target.value })}
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>الحد الأقصى</label>
            <input
              type="number"
              value={form.maxCoins}
              onChange={(e) => setForm({ ...form, maxCoins: e.target.value })}
              style={inp}
            />
          </div>
        </div>
      </Card>

      {(() => {
        const usdNum = Number(form.usdRate) || 50.0;
        const googleSarBase = usdNum / 3.75;
        const sarDeductionNum = Number(form.sarDeduction) || 0;
        const autoCalculatedSar = Math.max(0.1, googleSarBase - sarDeductionNum);

        return (
          <Card title="🇸🇦 إعدادات المملكة العربية السعودية والتحكم التلقائي بسعر الريال">
            <p className="text-xs text-muted-foreground mb-4">
              اكتب قيمة التخفيض المطلوبة من سعر الريال المرجعي من جوجل، وسيتم حساب وإظهار السعر النهائي التلقائي فورياً للمستخدمين دون حاجة للتعديل اليدوي:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={lbl}>🌐 سعر الريال المرجعي المباشر من جوجل (ج.م / 1 ر.س)</label>
                <input
                  type="number"
                  step="0.01"
                  value={googleSarBase.toFixed(2)}
                  disabled
                  style={{ ...inp, opacity: 0.8, background: "rgba(255,255,255,0.03)", color: "#38bdf8", fontWeight: "bold" }}
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">محسوب تلقائياً من سعر الدولار ({usdNum} ج.م ÷ 3.75)</span>
              </div>
              <div>
                <label style={lbl}>🔻 قيمة التخفيض المطلوبة من سعر الريال (ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.sarDeduction}
                  onChange={(e) => {
                    const val = e.target.value;
                    const deductionVal = Number(val) || 0;
                    const newAutoSar = Math.max(0.1, googleSarBase - deductionVal);
                    setForm({ ...form, sarDeduction: val, sarRateOverride: newAutoSar.toFixed(2) });
                  }}
                  style={{ ...inp, border: "1px solid #f59e0b", color: "#f59e0b", fontWeight: "bold" }}
                  placeholder="0.20"
                />
                <span className="text-[10px] text-amber-400 mt-1 block">المبلغ الذي ينقص من سعر جوجل لتخفيض الريال للمستخدمين</span>
              </div>
              <div>
                <label style={lbl}>⚡ السعر المباشر النهائي للريال (تلقائي 100%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={autoCalculatedSar.toFixed(2)}
                  disabled
                  style={{ ...inp, opacity: 0.9, background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", color: "#34d399", fontWeight: "bold" }}
                />
                <span className="text-[10px] text-emerald-400 mt-1 block">السعر الذي يتم تطبيقه وحسابه فورياً للمستخدمين</span>
              </div>
              <div>
                <label style={lbl}>🇸🇦 سعر صرف الدولار بالريال الثابت (ر.س / 1$)</label>
                <input
                  type="number"
                  step="0.01"
                  value="3.75"
                  disabled
                  style={{ ...inp, opacity: 0.7 }}
                />
              </div>
              <div>
                <label style={lbl}>🔻 الحد الأدنى للشحن بالريال (ر.س)</label>
                <input
                  type="number"
                  value={form.sarMinDeposit}
                  onChange={(e) => setForm({ ...form, sarMinDeposit: e.target.value })}
                  style={inp}
                  placeholder="10"
                />
              </div>
              <div>
                <label style={lbl}>🔻 الحد الأدنى لخصم الرسوم بالريال (ر.س - يدوياً)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.sarDepositFeeMin}
                  onChange={(e) => setForm({ ...form, sarDepositFeeMin: e.target.value })}
                  style={inp}
                  placeholder="0 (تلقائي حسب الصرف)"
                />
              </div>
              <div>
                <label style={lbl}>🔺 الحد الأقصى لخصم الرسوم بالريال (ر.س - يدوياً)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.sarDepositFeeMax}
                  onChange={(e) => setForm({ ...form, sarDepositFeeMax: e.target.value })}
                  style={inp}
                  placeholder="0 (تلقائي حسب الصرف)"
                />
              </div>
              <div className="col-span-2 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex flex-wrap items-center justify-between gap-3 mt-1">
                <div>
                  <span className="text-xs text-muted-foreground block font-extrabold text-emerald-400">
                    🟢 السعر النهائي المحسوب والفعلي للريال في الموقع حالياً:
                  </span>
                  <strong className="text-2xl text-emerald-300 font-mono font-black mt-1 block">
                    {autoCalculatedSar.toFixed(2)} ج.م / 1 ر.س
                  </strong>
                </div>
                <div className="text-xs text-slate-300 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-700">
                  <span>سعر جوجل المرجعي: <strong>{googleSarBase.toFixed(2)} ج.م</strong></span>
                  <span className="mx-2 text-amber-400"> - </span>
                  <span>قيمة التخفيض: <strong>{sarDeductionNum.toFixed(2)} ج.م</strong></span>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      <Card
        title="🌍 إدارة الدول وطرق الدفع والعملات المخصصة (Country Manager)"
      >
        <p className="text-xs text-muted-foreground mb-4">
          اختر الدول المفعلة لتظهر للمستخدمين، أو أضف دولة جديدة مخصصة بالكامل مع عملتها وطرق الدفع الخاصة بها من النموذج أدناه:
        </p>

        {/* Dynamic List of Active/Custom Countries */}
        <div className="flex flex-wrap gap-2.5 mb-6">
          {[
            { code: "EG", name: "🇪🇬 مصر (EGP)" },
            { code: "SA", name: "🇸🇦 السعودية (SAR)" },
            ...customCountries.map((c) => ({ code: c.code, name: `${c.flag || "🌍"} ${c.name} (${c.currency || c.code})` })),
            { code: "GLOBAL", name: "🌐 باقي دول العالم (USD)" },
          ].map((country) => {
            const isSelected = form.supportedCountries.includes(country.code);
            return (
              <button
                type="button"
                key={country.code}
                onClick={() => {
                  setForm((f) => {
                    const exists = f.supportedCountries.includes(country.code);
                    const next = exists
                      ? f.supportedCountries.filter((c) => c !== country.code)
                      : [...f.supportedCountries, country.code];
                    return { ...f, supportedCountries: next };
                  });
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm"
                    : "bg-slate-900/60 text-slate-400 border-slate-700 hover:bg-slate-800"
                }`}
              >
                {isSelected ? "✅ " : "➕ "}{country.name}
              </button>
            );
          })}
        </div>

        {/* Currency Symbols Configuration Box */}
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-right space-y-3 mb-5">
          <h4 className="text-xs font-extrabold text-amber-400 flex items-center gap-2">
            <span>🔣 التحكم الإداري برموز وشكل العملات (رموز الجنيه والريال والدولار):</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label style={lbl}>🇪🇬 رمز الجنيه المصري (EGP Symbol)</label>
              <input
                type="text"
                value={form.symbolEgp || "£"}
                onChange={(e) => setForm({ ...form, symbolEgp: e.target.value })}
                style={inp}
                placeholder="مثال: £ أو ج.م"
              />
            </div>
            <div>
              <label style={lbl}>🇸🇦 رمز الريال السعودي (SAR Symbol)</label>
              <input
                type="text"
                value={form.symbolSar || "﷼"}
                onChange={(e) => setForm({ ...form, symbolSar: e.target.value })}
                style={inp}
                placeholder="مثال: ﷼ أو ر.س"
              />
            </div>
            <div>
              <label style={lbl}>🇺🇸 رمز الدولار الأمريكي (USD Symbol)</label>
              <input
                type="text"
                value={form.symbolUsd || "$"}
                onChange={(e) => setForm({ ...form, symbolUsd: e.target.value })}
                style={inp}
                placeholder="مثال: $"
              />
            </div>
          </div>
        </div>

        {/* Add New Custom Country Form */}
        <div id="add-country-section" className="p-6 rounded-3xl border border-cyan-500/35 bg-gradient-to-b from-cyan-500/10 via-slate-900/60 to-slate-900/90 text-right space-y-4 shadow-xl">
          <h4 className="text-sm font-black text-cyan-400 flex items-center gap-2">
            <span>➕ إضافة دولة جديدة مخصصة للموقع:</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">اسم الدولة</label>
              <input
                type="text"
                placeholder="مثال: الإمارات"
                value={newCountry.name}
                onChange={(e) => setNewCountry({ ...newCountry, name: e.target.value })}
                className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-semibold text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">رمز الدولة (ISO Code)</label>
              <input
                type="text"
                placeholder="مثال: AE"
                value={newCountry.code}
                onChange={(e) => setNewCountry({ ...newCountry, code: e.target.value.toUpperCase().trim() })}
                className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-semibold text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">رمز العملة</label>
              <input
                type="text"
                placeholder="مثال: AED"
                value={newCountry.currency}
                onChange={(e) => setNewCountry({ ...newCountry, currency: e.target.value.toUpperCase().trim() })}
                className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-semibold text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">علم الدولة (Emoji Flag)</label>
              <input
                type="text"
                placeholder="مثال: 🇦🇪"
                value={newCountry.flag}
                onChange={(e) => setNewCountry({ ...newCountry, flag: e.target.value.trim() })}
                className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-semibold text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!newCountry.name || !newCountry.code) return;
              const exists = customCountries.some((c) => c.code === newCountry.code);
              if (exists) return;
              const updated = [...customCountries, newCountry];
              setCustomCountries(updated);
              setForm((f) => ({
                ...f,
                supportedCountries: Array.from(new Set([...f.supportedCountries, newCountry.code])),
              }));
              setNewCountry({ name: "", code: "", currency: "", flag: "🌍" });
            }}
            className="h-14 px-8 w-full sm:w-auto rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 text-slate-950 font-black text-base shadow-xl shadow-cyan-500/25 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            <Plus size={20} />
            <span>إضافة دولة مخصصة جديدة 🌍</span>
          </button>
        </div>
      </Card>

      <FloatingSaveBar onClick={save} busy={busy} label="حفظ جميع الإعدادات" msg={msg} />
    </div>
  );
}

// ─── Pricing Tiers ───────────────────────────────────────────────────────────

export function PricingTab() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [usdRate, setUsdRate] = useState(0);
  const [symbolEgp, setSymbolEgp] = useState("£");
  const [symbolSar, setSymbolSar] = useState("﷼");
  const [symbolUsd, setSymbolUsd] = useState("$");
  const [symbolsBusy, setSymbolsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAdminData("tiers"),
      fetchAdminData("settings/pricing"),
    ]).then(([tiersResult, pricingResult]) => {
      const rate = Number(
        pricingResult.data?.usd_rate || pricingResult.data?.tiktok_usd_rate || 0,
      );
      setUsdRate(rate);

      const cs = pricingResult.data?.currency_symbols || pricingResult.data?.currencySymbols || {};
      setSymbolEgp(cs.egp || cs.EGP || "£");
      setSymbolSar(cs.sar || cs.SAR || "﷼");
      setSymbolUsd(cs.usd || cs.USD || "$");

      const data: any[] = (tiersResult.items || []).map((tier: any) => ({
        ...tier,
        pricePer1000Usd:
          tier.price_per_1000_usd
          ?? (rate > 0 ? Number(tier.price_per_1000 || 0) / rate : ""),
      }));
      data.sort((a, b) => Number(a.min) - Number(b.min));
      setTiers(data);
    }).catch(console.error);
  }, []);

  const saveCurrencySymbols = async () => {
    setSymbolsBusy(true);
    try {
      await writeAdminData({
        action: "savePricingSettings",
        settings: {
          currency_symbols: {
            egp: symbolEgp.trim() || "£",
            sar: symbolSar.trim() || "﷼",
            usd: symbolUsd.trim() || "$",
          },
        },
      });
      toast.success("تم حفظ رموز العملات بنجاح 📋");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء حفظ رموز العملات");
    } finally {
      setSymbolsBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    await writeAdminData({ action: "saveTiers", tiers });
    const result = await fetchAdminData("tiers");
    const data: any[] = (result.items || []).map((tier: any) => ({
      ...tier,
      pricePer1000Usd: tier.price_per_1000_usd,
    }));
    data.sort((a, b) => Number(a.min) - Number(b.min));
    setTiers(data);
    setMsg("✅ تم حفظ الشرائح");
    setBusy(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleDelete = async (i: number, id: string) => {
    const { isConfirmed } = await Swal.fire({
      title: "تأكيد الحذف",
      text: "هل أنت متأكد من حذف هذه الشريحة؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، احذف",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#ff4444"
    });
    if (isConfirmed) {
      if (id) {
        setBusy(true);
        await writeAdminData({ action: "deleteTier", id });
        setBusy(false);
      }
      setTiers(tiers.filter((_, idx) => idx !== i));
    }
  };

  const handleExportTikTokPriceList = async () => {
    let depositFeePercent = 0.57;
    let minFeeEgp = 0.57;
    let maxFeeEgp = 180;
    let globalDiscountConfig: any = null;
    try {
      const pSnap = await getDoc(doc(db, "settings", "pricing"));
      if (pSnap.exists()) {
        const d = pSnap.data();
        const f = Number(d?.deposit_fee_percent ?? d?.depositFeePercent ?? d?.feePercent);
        if (Number.isFinite(f) && f >= 0) depositFeePercent = f;
        const minF = Number(d?.minDepositFee ?? d?.minFeeEgp);
        if (Number.isFinite(minF) && minF >= 0) minFeeEgp = minF;
        const maxF = Number(d?.maxDepositFee ?? d?.maxFeeEgp);
        if (Number.isFinite(maxF) && maxF > 0) maxFeeEgp = maxF;
        globalDiscountConfig = {
          enabled: Boolean(d?.global_usd_discount_enabled ?? d?.globalUsdDiscountEnabled),
          discountPercent: Number(d?.global_usd_discount_percent ?? d?.globalUsdDiscountPercent ?? 0),
          maxDiscountUsd: Number(d?.global_usd_discount_max_amount ?? d?.globalUsdDiscountMaxAmount ?? d?.max_discount_usd ?? d?.maxDiscountUsd ?? 0),
          expiresAt: d?.global_usd_discount_expires_at ?? d?.globalUsdDiscountExpiresAt ?? null,
        };
      }
    } catch (e) {
      console.error(e);
    }

    const today = new Date();
    const d = String(today.getDate()).padStart(2, "0");
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const y = today.getFullYear();
    const hh = String(today.getHours()).padStart(2, "0");
    const mm = String(today.getMinutes()).padStart(2, "0");
    const ss = String(today.getSeconds()).padStart(2, "0");
    const dateStr = `${d}/${m}/${y} ${hh}:${mm}:${ss}`;

    const coinAmounts = [
      30, 50, 70, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000,
      2150, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
      15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000,
      60000, 70000, 80000, 90000, 100000,
      200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000,
      1500000, 2000000, 2500000
    ];

    const roundTo0Or5 = (price: number): number => {
      if (!Number.isFinite(price) || price <= 0) return 0;
      const intVal = Math.ceil(price);
      const rem = intVal % 10;
      let rounded = intVal;
      if (rem === 1) rounded = intVal - 1;
      else if (rem === 2) rounded = intVal - 2;
      else if (rem === 3) rounded = intVal + 2;
      else if (rem === 4) rounded = intVal + 1;
      else if (rem === 6) rounded = intVal - 1;
      else if (rem === 7) rounded = intVal - 2;
      else if (rem === 8) rounded = intVal + 2;
      else if (rem === 9) rounded = intVal + 1;
      return Math.max(5, rounded);
    };

    const generateText = (includeFee: boolean) => {
      let text = `قائمة أسعار عملات تيك توك\n📅 الأسعار بتاريخ: ${dateStr}\n\n`;
      if (isGlobalUsdDiscountActive(globalDiscountConfig)) {
        const durationText = calculateExactRemainingTimeText(globalDiscountConfig.expiresAt);
        const capNote = globalDiscountConfig.maxDiscountUsd && globalDiscountConfig.maxDiscountUsd > 0
          ? ` (بحد أقصى ${globalDiscountConfig.maxDiscountUsd}$ خصم)`
          : "";
        text += `🔥 عرض خاص: خصم ${globalDiscountConfig.discountPercent}% متاح لمدة ${durationText}!${capNote}\n(على جميع الخدمات التي بقيمة 10$ او اكثر)\n\n`;
      }
      text += `⚠️ ملاحظة:\nالأسعار الموضحة أدناه سارية بتاريخ اليوم فقط، وقد ترتفع أو تنخفض في أي وقت حسب تغير سعر الصرف وتكلفة الشحن.\n\n`;

      const lines = coinAmounts.map((coins) => {
        const origNetEgp = calculateTikTokOriginalPriceEgp(coins, tiers, usdRate);
        const discNetEgp = calculateTikTokPriceEgp(coins, tiers, usdRate, globalDiscountConfig);

        const calcGross = (net: number) => {
          if (includeFee) {
            const rawFee = net * (depositFeePercent / 100);
            const clampedFee = Math.max(minFeeEgp, Math.min(maxFeeEgp, rawFee));
            return Math.ceil(net + clampedFee);
          }
          return Math.ceil(net);
        };

        const origGross = calcGross(origNetEgp);
        const discGross = calcGross(discNetEgp);
        const hasDiscount = isGlobalUsdDiscountActive(globalDiscountConfig) && origGross > discGross;

        const formattedCoins = coins >= 1000 ? coins.toLocaleString("en-US") : String(coins);
        const formattedDisc = discGross.toLocaleString("en-US");
        const formattedOrig = origGross.toLocaleString("en-US");

        if (hasDiscount) {
          return `${formattedCoins} = ${formattedDisc} ج (بدلاً من ~${formattedOrig} ج~) 🔥`;
        }
        return `${formattedCoins} = ${formattedDisc} ج`;
      });

      let fullText = text + lines.join("\n");
      fullText += `\n\n🔗 ملاحظة هامة:\nتعتبر هذه القائمة لفترة مؤقتة، ونرجو منكم التعامل المباشر عبر موقعنا الرسمي لسهولة وسرعة الطلب والمتابعة:\n🌐 https://zaitxmedia.com`;
      return fullText;
    };

    const textWithFee = generateText(true);
    const htmlWithFeePreview = textWithFee.replace(/~([^~]+)~/g, '<s style="text-decoration: line-through; color: #ef4444; font-weight: bold;">$1</s>');

    const sample1kOrigNet = calculateTikTokOriginalPriceEgp(1000, tiers, usdRate);
    const sample1kDiscNet = calculateTikTokPriceEgp(1000, tiers, usdRate, globalDiscountConfig);
    const calcSampleGross = (net: number) => {
      const rawFee = net * (depositFeePercent / 100);
      const clampedFee = Math.max(minFeeEgp, Math.min(maxFeeEgp, rawFee));
      return Math.ceil(net + clampedFee);
    };
    const sample1kOrigGross = calcSampleGross(sample1kOrigNet);
    const sample1kDiscGross = calcSampleGross(sample1kDiscNet);

    const isDisc = isGlobalUsdDiscountActive(globalDiscountConfig) && sample1kOrigGross > sample1kDiscGross;
    const sampleHeaderNote = isDisc
      ? `(1000 عملة = ${sample1kDiscGross.toLocaleString("en-US")} ج بعد الخصم / بدلاً من ${sample1kOrigGross.toLocaleString("en-US")} ج)`
      : `(1000 عملة = ${sample1kOrigGross.toLocaleString("en-US")} ج)`;

    const { isConfirmed } = await Swal.fire({
      title: "📋 قائمة أسعار عملات تيك توك (شاملة رسوم التحويل والخصم)",
      showCloseButton: true,
      html: `
        <div style="text-align: right; direction: rtl; margin-bottom: 10px; font-size: 13px; color: #38bdf8;">
          ✨ الأسعار أدناه شاملة رسوم التحويل الإيداع (${depositFeePercent}%) ومطابقة 100% لمبلغ التحويل من المحفظة ${sampleHeaderNote}.
        </div>
        <div style="width: 100%; height: 340px; background: #070d18; color: #4ade80; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 13px; direction: rtl; text-align: right; white-space: pre-wrap; line-height: 1.6; overflow-y: auto;">${htmlWithFeePreview}</div>
      `,
      showCancelButton: false,
      confirmButtonText: "📋 نسخ القائمة الحالية للحافظة",
      background: "#0c1322",
      color: "#fff",
      confirmButtonColor: "#38bdf8",
    });

    if (isConfirmed) {
      navigator.clipboard.writeText(textWithFee);
      Swal.fire({
        icon: "success",
        title: "تم نسخ قائمة الأسعار بنجاح! 📋",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2500,
        background: "#0c1322",
        color: "#fff",
      });
    }
  };

  return (
    <div style={{ width: "100%" }} className="pb-32 space-y-6">
      {/* 🔣 التحكم الإداري برموز وشكل العملات */}
      <Card title="🔣 التحكم الإداري برموز وشكل العملات (رموز الجنيه والريال والدولار)">
        <p className="text-xs text-muted-foreground mb-4">
          يمكنك تغيير الرمز أو الكلمة التي تظهر بجانب كل عملة في جميع صفحات الموقع (مثلاً: £ أو ج.م للجنيه المصري، ﷼ أو ر.س للريال السعودي):
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">🇪🇬 رمز الجنيه المصري (EGP Symbol)</label>
            <input
              type="text"
              value={symbolEgp}
              onChange={(e) => setSymbolEgp(e.target.value)}
              className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-bold text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
              placeholder="مثال: £ أو ج.م"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">🇸🇦 رمز الريال السعودي (SAR Symbol)</label>
            <input
              type="text"
              value={symbolSar}
              onChange={(e) => setSymbolSar(e.target.value)}
              className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-bold text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
              placeholder="مثال: ﷼ أو ر.س"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">🇺🇸 رمز الدولار الأمريكي (USD Symbol)</label>
            <input
              type="text"
              value={symbolUsd}
              onChange={(e) => setSymbolUsd(e.target.value)}
              className="h-13 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-sm font-bold text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
              placeholder="مثال: $"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={symbolsBusy}
          onClick={saveCurrencySymbols}
          className="h-14 px-8 w-full sm:w-auto rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/25 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {symbolsBusy ? "جاري الحفظ..." : "💾 حفظ رموز العملات"}
        </button>
      </Card>

      <Card
        title="📊 شرائح أسعار تيك توك"
      action={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleExportTikTokPriceList}
            style={{
              ...addBtn,
              background: "linear-gradient(135deg, #059669, #10b981)",
              color: "#fff",
              border: "1px solid #059669",
            }}
          >
            📋 استخراج قائمة الأسعار
          </button>
          <button
            onClick={() =>
              setTiers([...tiers, { min: "", max: "", pricePer1000Usd: "" }])
            }
            style={addBtn}
          >
            <Plus size={14} /> إضافة
          </button>
        </div>
      }
    >
      <div
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 10,
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.18)",
          color: "#7dd3fc",
          fontSize: 13,
        }}
      >
        سعر الصرف المستخدم تلقائيًا: 1 USD = {usdRate || "—"} EGP
      </div>
      {tiers.map((t, i) => (
        <div
          key={i}
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 12,
              alignItems: "center",
              flexWrap: "wrap",
              background: "rgba(255,255,255,0.02)",
              padding: 16,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 150 }}>
              <span style={{ color: "#888", fontSize: 13, fontWeight: 600 }}>من</span>
              <input
                type="number"
                inputMode="numeric"
                value={t.min}
                onChange={(e) => {
                  const n = [...tiers];
                  n[i].min = e.target.value;
                  setTiers(n);
                }}
                style={{ ...inp, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 150 }}>
              <span style={{ color: "#888", fontSize: 13, fontWeight: 600 }}>إلى</span>
              <input
                type="number"
                inputMode="numeric"
                value={t.max}
                onChange={(e) => {
                  const n = [...tiers];
                  n[i].max = e.target.value;
                  setTiers(n);
                }}
                style={{ ...inp, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 240 }}>
              <span style={{ color: "#888", fontSize: 13, fontWeight: 600 }}>سعر/1000 USD:</span>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={t.pricePer1000Usd ?? ""}
                onChange={(e) => {
                  const n = [...tiers];
                  n[i].pricePer1000Usd = e.target.value;
                  setTiers(n);
                }}
                style={{ ...inp, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 230 }}>
              <span style={{ color: "#888", fontSize: 13, fontWeight: 600 }}>بالجنيه:</span>
              <div
                style={{
                  ...inp,
                  flex: 1,
                  color: "#34d399",
                  background: "rgba(16,185,129,0.08)",
                  cursor: "not-allowed",
                }}
              >
                {usdRate > 0 && Number(t.pricePer1000Usd) > 0
                  ? `${ceilTo2Decimals(Number(t.pricePer1000Usd) * usdRate)} EGP`
                  : "—"}
              </div>
              <button
                onClick={() => handleDelete(i, t.id)}
                style={{ ...delBtn, padding: "14px 16px" }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      <FloatingSaveBar onClick={save} busy={busy} label="حفظ جدول الشرائح" msg={msg} />
    </Card>
    </div>
  );
}

// ─── Wallets ─────────────────────────────────────────────────────────────────

export function WalletsTab() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedInstructionMethod, setSelectedInstructionMethod] = useState("vodafone");
  const [methodInstructions, setMethodInstructions] = useState<Record<string, string[]>>({
    vodafone: [
      "ارسل المبلغ أولا",
      "اكتب المبلغ الذي قمت بتحويله في الخانه المطلوبه",
      "قم بكتابه الرقم الخاص بك الذي قمت بالتحويل لنا من خلاله في الخانه المطلوبه",
      "اضغط على تأكيد الايداع",
    ],
    instapay: [
      "أرسل المبلغ إلى حسابنا البنكي عبر InstaPay",
      "اكتب المبلغ الذي أرسلته بالجنيه المصري",
      "اكتب الرقم المرجعي للتحويل من رسالة SMS",
      "اضغط على تأكيد الايداع",
    ],
    barq: [
      "أرسل المبلغ إلى حسابنا في تطبيق برق (Barq)",
      "اكتب المبلغ بالريال السعودي",
      "اكتب اسم المحول باللغة الإنجليزية كما هو في التطبيق",
      "اضغط على تأكيد الايداع",
    ],
    bank: [
      "أرسل المبلغ إلى حسابنا البنكي المعروض",
      "اكتب المبلغ الإجمالي المحول",
      "ارفع صورة إيصال التحويل البنكي بوضوح",
      "اضغط على تأكيد الايداع",
    ],
    binance_pay: [
      "أرسل المبلغ بالدولار الأمريكي (USD) عبر Binance Pay",
      "اكتب المبلغ المطلوب بالدولار في الخانة المخصصة",
      "انسخ Binance ID الخاص بحسابنا (405960486) وقم بالتحويل من تطبيق Binance",
      "اضغط على تأكيد الإيداع لمتابعة حالة الطلب",
    ],
  });
  const [availableCountries, setAvailableCountries] = useState<any[]>([
    { id: "EG", label: "🇪🇬 مصر (EGP)" },
    { id: "SA", label: "🇸🇦 السعودية (SAR)" },
    { id: "AE", label: "🇦🇪 الإمارات (AED)" },
    { id: "KW", label: "🇰🇼 الكويت (KWD)" },
    { id: "QA", label: "🇶🇦 قطر (QAR)" },
    { id: "GLOBAL", label: "🌐 متاحة لكل الدول (عامة)" },
  ]);

  useEffect(() => {
    fetchAdminData("settings/site").then((result) => {
      if (result.exists) {
        try {
          if (result.data.methodInstructions && typeof result.data.methodInstructions === "object") {
            const loadedInstr: Record<string, string[]> = { ...result.data.methodInstructions };
            Object.keys(loadedInstr).forEach((k) => {
              const list = [...(loadedInstr[k] || [])];
              if (list.length >= 3) {
                const s1 = list[1] || "";
                const s2 = list[2] || "";
                const isS1Ref = /رقم|الرقم|مرجعي|اسم|إيصال|ايصال/i.test(s1);
                const isS2Amount = /مبلغ|المبلغ/i.test(s2);
                if (isS1Ref && isS2Amount) {
                  list[1] = s2;
                  list[2] = s1;
                  loadedInstr[k] = list;
                }
              }
            });
            setMethodInstructions((prev) => ({ ...prev, ...loadedInstr }));
          }
          const raw = result.data.wallets || [];
          const normalized = raw.map((w: any) => ({
            ...w,
            countryCode: w.countryCode || (w.type === "barq" ? "SA" : (w.type === "bank" || w.type === "binance_pay" || w.type === "binance") ? "GLOBAL" : "EG"),
          }));

          // Ensure Barq (SA), Bank (GLOBAL), and Binance Pay (GLOBAL) exist!
          const hasBarq = normalized.some((w: any) => w.type === "barq");
          const hasBank = normalized.some((w: any) => w.type === "bank");
          const hasBinancePay = normalized.some((w: any) => w.type === "binance_pay" || w.type === "binance");

          if (!hasBarq) {
            normalized.push({
              type: "barq",
              countryCode: "SA",
              number: "تطبيق برق",
              name: "تحويل برق (السعودية)",
              min: 10,
              max: 10000,
              isActive: true,
            });
          }

          if (!hasBank) {
            normalized.push({
              type: "bank",
              countryCode: "GLOBAL",
              number: "059102533916",
              holderName: "مستفيد التحويل البنكي",
              bankName: "البنك الأهلي / الراجحي",
              min: 10,
              max: 50000,
              isActive: true,
            });
          }

          if (!hasBinancePay) {
            normalized.push({
              type: "binance_pay",
              countryCode: "GLOBAL",
              number: "405960486",
              name: "Binance Pay",
              min: 1,
              max: 10000,
              isActive: true,
            });
          }

          setWallets(normalized);
        } catch {}
      }
    }).catch(console.error);

    fetchAdminData("settings/pricing").then((res) => {
      if (res.exists && Array.isArray(res.data.custom_countries) && res.data.custom_countries.length > 0) {
        const list = res.data.custom_countries.map((c: any) => ({
          id: c.code,
          label: `${c.flag || "🌍"} ${c.name} (${c.currency || c.code})`,
        }));
        setAvailableCountries([
          { id: "EG", label: "🇪🇬 مصر (EGP)" },
          { id: "SA", label: "🇸🇦 السعودية (SAR)" },
          ...list,
          { id: "GLOBAL", label: "🌐 متاحة لكل الدول (عامة)" },
        ]);
      }
    }).catch(console.error);
  }, []);

  const [countryFilter, setCountryFilter] = useState("ALL");

  const save = async () => {
    setBusy(true);
    await writeAdminData({
      action: "setDocument",
      resource: "settings/site",
      data: { wallets, methodInstructions },
    });
    setMsg("✅ تم الحفظ");
    setBusy(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const add = () =>
    setWallets([
      ...wallets,
      { type: "vodafone", countryCode: countryFilter === "SA" ? "SA" : countryFilter === "ALL" ? "EG" : countryFilter, number: "", name: "", min: 0, max: 100000, isActive: true },
    ]);
  const upd = (i: number, f: string, v: any) => {
    const w = [...wallets];
    w[i] = { ...w[i], [f]: v };
    setWallets(w);
  };
  const del = (i: number) => setWallets(wallets.filter((_, idx) => idx !== i));

  const filteredWallets = wallets.filter((w) => {
    if (countryFilter === "ALL") return true;
    const c = w.countryCode || (w.type === "barq" ? "SA" : w.type === "bank" ? "GLOBAL" : "EG");
    return c === countryFilter;
  });

  return (
    <div className="pb-32">
    <Card
      title="💳 المحافظ وحسابات البنوك حسب الدولة"
      action={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-12 px-7 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-500 text-slate-950 font-black text-sm md:text-base shadow-xl shadow-cyan-500/30 hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2.5 border border-cyan-300/50 cursor-pointer disabled:opacity-50"
          >
            <Save size={20} className={busy ? "animate-spin" : ""} />
            <span>{busy ? "جاري الحفظ..." : "💾 حفظ التغييرات"}</span>
          </button>
          <button onClick={add} style={addBtn}>
            <Plus size={14} /> إضافة حساب جديد
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-muted-foreground font-bold">تصفية حسب الدولة:</span>
        {[{ id: "ALL", label: "🌐 جميع الدول" }, ...availableCountries].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setCountryFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              countryFilter === f.id
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 border-slate-700 hover:bg-slate-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredWallets.map((w, i) => {
        const actualIndex = wallets.indexOf(w);
        return (
        <div
          key={actualIndex}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "center",
            flexWrap: "wrap",
            background: "#0a0a0a",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <GenericCustomSelect
            value={w.countryCode || (w.type === "barq" ? "SA" : w.type === "bank" ? "GLOBAL" : "EG")}
            title="اختر الدولة المتاحة"
            options={availableCountries.map((c) => ({ value: c.id, label: c.label }))}
            onChange={(val) => upd(actualIndex, "countryCode", val)}
            className="w-48 shrink-0"
          />

          <GenericCustomSelect
            value={w.type || "vodafone"}
            title="اختر وسيلة الدفع"
            options={[
              { value: "vodafone", label: "فودافون كاش / محفظه الكترونية" },
              { value: "instapay", label: "انستاباي (InstaPay)" },
              { value: "barq", label: "برق (Barq - السعودية)" },
              { value: "binance_pay", label: "🟡 Binance Pay" },
              { value: "bank", label: "حساب بنكي (Bank Transfer)" },
              { value: "custom", label: "➕ طريقة دفع مخصصة جديدة" },
            ]}
            onChange={(val) => upd(actualIndex, "type", val)}
            className="flex-1 min-w-[180px]"
          />
          {w.type === "custom" && (
            <input
              value={w.customName || w.title || ""}
              onChange={(e) => {
                upd(actualIndex, "customName", e.target.value);
                upd(actualIndex, "title", e.target.value);
              }}
              style={{ ...inp, flex: 2, minWidth: 160, border: "1px solid #38bdf8", color: "#38bdf8", fontWeight: "bold" }}
              placeholder="اسم طريقة الدفع (مثال: STC Pay / زين كاش)"
            />
          )}
          <input
            value={w.number}
            onChange={(e) => upd(actualIndex, "number", e.target.value)}
            style={{ ...inp, flex: 2, minWidth: w.type === "bank" ? 150 : 180 }}
            placeholder={w.type === "bank" ? "رقم الحساب" : w.type === "instapay" ? "رقم الهاتف / الحساب" : "الرقم / الحساب / التتعليمات"}
            dir="ltr"
          />
          {w.type === "instapay" && (
            <input
              value={w.username || w.ipa || ""}
              onChange={(e) => upd(actualIndex, "username", e.target.value)}
              style={{ ...inp, flex: 2, minWidth: 180 }}
              placeholder="اسم المستخدم IPA (مثال: name@instapay)"
              dir="ltr"
            />
          )}
          {w.type === "bank" ? (
            <>
              <input
                value={w.bankName || ""}
                onChange={(e) => upd(actualIndex, "bankName", e.target.value)}
                style={{ ...inp, flex: 2, minWidth: 120 }}
                placeholder="اسم البنك"
              />
              <input
                value={w.holderName || ""}
                onChange={(e) => upd(actualIndex, "holderName", e.target.value)}
                style={{ ...inp, flex: 2, minWidth: 120 }}
                placeholder="اسم صاحب الحساب"
              />
            </>
          ) : (
            <input
              value={w.name || ""}
              onChange={(e) => upd(actualIndex, "name", e.target.value)}
              style={{ ...inp, flex: 2, minWidth: 150 }}
              placeholder="اسم صاحب الحساب / المستفيد"
            />
          )}
          <input
            value={w.link || ""}
            onChange={(e) => upd(actualIndex, "link", e.target.value)}
            style={{ ...inp, flex: 2, minWidth: 150 }}
            placeholder={w.type === "bank" ? "رقم الحساب الدولي (IBAN)" : "رابط التحويل المباشر"}
            dir="ltr"
          />
          {w.type === "bank" && (
            <input
              value={w.swift || ""}
              onChange={(e) => upd(actualIndex, "swift", e.target.value)}
              style={{ ...inp, flex: 1.5, minWidth: 120 }}
              placeholder="السويفت كود (Swift Code)"
              dir="ltr"
            />
          )}
          {(w.type === "instapay" || w.type === "vodafone" || w.type === "custom") && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 180, flex: 2 }}>
              <input
                type="text"
                value={w.qr || ""}
                onChange={(e) => upd(actualIndex, "qr", e.target.value)}
                style={{ ...inp, flex: 1, minWidth: 100 }}
                placeholder="رابط الـ QR أو ارفع ملف"
              />
              <label style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: "bold",
                whiteSpace: "nowrap",
                border: "1px solid #444",
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}>
                📁 رفع ملف
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      upd(actualIndex, "qr", "جاري الرفع...");
                      const formData = new FormData();
                      formData.append("file", file);
                      
                      const response = await fetch("/api/admin/upload", {
                        method: "POST",
                        body: formData,
                      });
                      
                      if (!response.ok) {
                        throw new Error(await response.text());
                      }
                      
                      const res = await response.json();
                      if (res.success && res.url) {
                        upd(actualIndex, "qr", res.url);
                      } else {
                        throw new Error(res.error || "Failed upload");
                      }
                    } catch (err) {
                      console.error(err);
                      upd(actualIndex, "qr", "");
                      alert("فشل رفع الملف");
                    }
                  }}
                />
              </label>
            </div>
          )}
          <input
            type="number"
            value={w.min}
            onChange={(e) => upd(actualIndex, "min", +e.target.value)}
            style={{ ...inp, flex: 1, minWidth: 100 }}
            placeholder="الحد الأدنى"
          />
          <input
            type="number"
            value={w.max}
            onChange={(e) => upd(actualIndex, "max", +e.target.value)}
            style={{ ...inp, flex: 1, minWidth: 100 }}
            placeholder="الأقصى"
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              minWidth: 80,
              color: w.isActive ? "#00ff80" : "#ff4444",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ width: 18, height: 18, accentColor: "#38bdf8" }}
              checked={w.isActive !== false}
              onChange={(e) => upd(actualIndex, "isActive", e.target.checked)}
            />
            {w.isActive !== false ? "مفعل" : "معطل"}
          </label>
          <button onClick={() => del(actualIndex)} style={{ ...delBtn, padding: "14px 16px" }}>
            <Trash2 size={16} />
          </button>
        </div>
      );
      })}
      <FloatingAddButton onClick={add} label="إضافة طريقة دفع / محفظة جديدة ➕" />
      <FloatingSaveBar onClick={save} busy={busy} label="حفظ المحافظ ووسائل الإيداع" msg={msg} />
    </Card>

    {/* 📋 قسم التحكم في تعليمات الإيداع لكل وسيلة دفع */}
    <div className="mt-6">
      <Card title="📋 التحكم في تعليمات الإيداع التي تظهر للعميل لكل وسيلة دفع">
        <div className="space-y-4">
          <p className="text-xs text-slate-400 font-semibold">
            اختر وسيلة الدفع أدناه لتعديل أو إضافة الخطوات والتعليمات التي تظهر في المربع المنبثق للعميل عند فتح الإيداع:
          </p>
          
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: "vodafone", label: "📱 فودافون كاش / المحافظ" },
              { id: "instapay", label: "⚡ انستاباي InstaPay" },
              { id: "barq", label: "✨ برق Barq" },
              { id: "binance_pay", label: "🟡 Binance Pay" },
              { id: "bank", label: "🏦 تحويل بنكي Bank" },
              ...Array.from(new Set(wallets.map(w => w.type).filter(t => !["vodafone", "instapay", "barq", "binance_pay", "binance", "bank"].includes(t)))).map(t => ({ id: t, label: `💳 ${t}` }))
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedInstructionMethod(m.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  selectedInstructionMethod === m.id
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm"
                    : "bg-slate-900/60 text-slate-400 border-slate-700 hover:bg-slate-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-200">
                خطوات تعليمات ({selectedInstructionMethod}):
              </h4>
              <button
                type="button"
                onClick={() => {
                  const currentArr = methodInstructions[selectedInstructionMethod] || [];
                  setMethodInstructions({ ...methodInstructions, [selectedInstructionMethod]: [...currentArr, "خطوة جديدة..."] });
                }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-xl border border-cyan-500/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>إضافة خطوة جديدة</span>
              </button>
            </div>

            {(methodInstructions[selectedInstructionMethod] || [
              "ارسل المبلغ أولا",
              "اكتب المبلغ الذي قمت بتحويله في الخانه المطلوبه",
              "قم بكتابه الرقم الخاص بك الذي قمت بالتحويل لنا من خلاله في الخانه المطلوبه",
              "اضغط على تأكيد الايداع",
            ]).map((stepText, sIdx) => (
              <div key={sIdx} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 text-xs font-mono font-black flex items-center justify-center shrink-0 border border-cyan-500/30">
                  {sIdx + 1}
                </span>
                <input
                  type="text"
                  value={stepText}
                  onChange={(e) => {
                    const newArr = [...(methodInstructions[selectedInstructionMethod] || [])];
                    newArr[sIdx] = e.target.value;
                    setMethodInstructions({ ...methodInstructions, [selectedInstructionMethod]: newArr });
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl outline-none focus:border-cyan-500"
                  placeholder={`الخطوة رقم ${sIdx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newArr = (methodInstructions[selectedInstructionMethod] || []).filter((_, idx) => idx !== sIdx);
                    setMethodInstructions({ ...methodInstructions, [selectedInstructionMethod]: newArr });
                  }}
                  className="p-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                  title="حذف الخطوة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
    </div>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  useEffect(() => {
    let active = true;
    setLoadingUsers(true);
    setUsersError("");
    fetch("/api/admin/users", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result?.error?.message || result?.error || "تعذر تحميل المستخدمين");
        }
        if (active) setUsers(Array.isArray(result.users) ? result.users : []);
      })
      .catch((error) => {
        if (active) {
          setUsersError(
            error instanceof Error ? error.message : "تعذر تحميل المستخدمين",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const filtered = users.filter(
    (u) => (u.email || "").includes(search) || (u.name || "").includes(search),
  );

  const ban = async (u: any) => {
    const { value: reason } = await Swal.fire({
      title: "سبب الحظر",
      input: "text",
      background: "#111",
      color: "#fff",
      showCancelButton: true,
      confirmButtonText: "تأكيد الحظر",
    });
    if (reason === undefined) return;
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, banned: !u.banned, ban_reason: reason }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Swal.fire({ icon: "error", title: "تعذر التعديل", text: result.error || "حدث خطأ", background: "#111", color: "#fff" });
    }
    setRefresh((r) => r + 1);
  };

  const setRole = async (u: any) => {
    const { value: role } = await Swal.fire({
      title: "تغيير الدور",
      input: "select",
      inputOptions: { user: "مستخدم", admin: "مدير", finance: "مالية" },
      inputValue: u.role || "user",
      background: "#111",
      color: "#fff",
      showCancelButton: true,
    });
    if (!role || role === u.role) return;
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Swal.fire({ icon: "error", title: "تعذر تغيير الدور", text: result.error || "حدث خطأ", background: "#111", color: "#fff" });
    }
    setRefresh((r) => r + 1);
  };

  const editBalance = async (u: any) => {
    const { value: formValues } = await Swal.fire({
      title: "💰 تعديل رصيد الحساب",
      html: `
        <div class="text-right text-sm space-y-3 mb-3" dir="rtl">
          <div><strong class="text-primary">المستخدم:</strong> ${u.name || u.email}</div>
          <div><strong class="text-emerald-400">الرصيد الحالي:</strong> $${ceilTo2Decimals(Number(u.balance || 0))} USD</div>
          <div class="mt-3">
            <label class="block text-xs font-bold text-slate-300 mb-1">نوع الإجراء:</label>
            <select id="swal-balance-action" class="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm outline-none">
              <option value="add_balance">➕ إضافة رصيد للرصيد الحالي</option>
              <option value="deduct_balance">➖ خصم مبلغ من الرصيد الحالي</option>
              <option value="set_balance">🎯 تحديد رصيد جديد ثابت</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">المبلغ بالدولار ($ USD):</label>
            <input id="swal-balance-amount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">سبب التعديل:</label>
            <input id="swal-balance-reason" type="text" placeholder="مثال: تسوية رصيد / شحن مباشر من الإدارة" class="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm outline-none" />
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "تأكيد وتحديث الرصيد",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#10b981",
      preConfirm: () => {
        const action = (document.getElementById("swal-balance-action") as HTMLSelectElement)?.value;
        const amount = Number((document.getElementById("swal-balance-amount") as HTMLInputElement)?.value);
        const reason = (document.getElementById("swal-balance-reason") as HTMLInputElement)?.value;
        if (!Number.isFinite(amount) || amount <= 0) {
          Swal.showValidationMessage("يرجى إدخال مبلغ صحيح أكبر من 0");
          return false;
        }
        return { action, amount, reason };
      },
    });

    if (!formValues) return;
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: u.id,
          balance_action: formValues.action,
          amountUsd: formValues.amount,
          reason: formValues.reason,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "تعذر تعديل الرصيد");
      }
      await Swal.fire({
        icon: "success",
        title: "تم تعديل رصيد حساب المستخدم بنجاح ✅",
        timer: 1500,
        showConfirmButton: false,
        background: "#111",
        color: "#fff",
      });
      setRefresh((r) => r + 1);
    } catch (err: any) {
      await Swal.fire({
        icon: "error",
        title: "تعذر تعديل الرصيد",
        text: err.message || "حدث خطأ أثناء تعديل الرصيد",
        background: "#111",
        color: "#fff",
      });
    }
  };

  const banIp = async (u: any) => {
    const defaultIp = u.last_ip || u.banned_ip || u.ip || "";
    const { value: ip, isConfirmed } = await Swal.fire({
      title: "🌐 حظر عنوان IP للمستخدم",
      text: defaultIp
        ? `عنوان الـ IP المسجّل للجهاز هو (${defaultIp}). تأكيد حظر هذا الـ IP وتجميد حسابه:`
        : "أدخل عنوان الـ IP لحظره وتجميد الحساب ومنعه نهائياً من دخول الموقع:",
      input: "text",
      inputValue: defaultIp,
      inputPlaceholder: "مثال: 197.35.42.100",
      showCancelButton: true,
      confirmButtonText: "حظر الـ IP والتجميد فوراً",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#ef4444",
      inputValidator: (val) => {
        if (!val || !val.trim()) return "يرجى كتابة عنوان IP صحيح";
      },
    });

    if (!isConfirmed || !ip) return;
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: u.id,
          ban_ip: ip.trim(),
          ban_reason: `حظر IP للمستخدم ${u.name || u.email}`,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر حظر IP");
      await Swal.fire({
        icon: "success",
        title: `تم حظر IP (${ip.trim()}) وحسابه بنجاح ✅`,
        timer: 1500,
        showConfirmButton: false,
        background: "#111",
        color: "#fff",
      });
      setRefresh((r) => r + 1);
    } catch (err: any) {
      await Swal.fire({
        icon: "error",
        title: "تعذر حظر الـ IP",
        text: err.message || "حدث خطأ أثناء حظر الـ IP",
        background: "#111",
        color: "#fff",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card title={`👥 المستخدمون (${users.length})`}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inp, paddingRight: 36 }}
              placeholder="بحث باسم أو بريد..."
            />
            <Search
              size={16}
              color="#666"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
          </div>
          <button onClick={() => setRefresh((r) => r + 1)} style={btnSm}>
            <RefreshCw size={14} />
          </button>
        </div>
        {loadingUsers && <p className="mb-4 text-muted-foreground">جاري تحميل المستخدمين...</p>}
        {usersError && <p className="mb-4 text-red-400">{usersError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/5">
                {[
                  "المستخدم",
                  "البريد",
                  "الدولة",
                  "الواتساب",
                  "عنوان IP المسجّل",
                  "الدور",
                  "الرصيد ($)",
                  "الحالة",
                  "إجراءات التحكم",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-4 text-right text-muted-foreground font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border/30 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-foreground">
                    {u.name || "—"}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground font-mono text-right" dir="ltr">
                    {u.email}
                  </td>
                  <td className="p-4">
                    {u.country_code === "SA"
                      ? "🇸🇦"
                      : u.country_code === "EG"
                        ? "🇪🇬"
                        : "—"}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground font-mono text-right" dir="ltr">
                    {u.whatsapp
                      ? (u.country_code === "SA" ? "+966" : "+20") + u.whatsapp
                      : "—"}
                  </td>
                  <td className="p-4 text-xs font-mono text-purple-400 text-right" dir="ltr">
                    {u.last_ip || u.banned_ip || u.ip ? (
                      <span className="bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-md font-bold">
                        {u.last_ip || u.banned_ip || u.ip}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-sans text-[11px]">لم يُسجّل بعد</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                        u.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : u.role === "finance"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {u.role || "user"}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-emerald-400 font-mono text-right" dir="ltr">
                    ${ceilTo2Decimals(Number(u.balance || 0))}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                        u.banned
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}
                    >
                      {u.banned ? "محظور" : "نشط"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => editBalance(u)}
                        title="تعديل الرصيد المباشر"
                        className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <DollarSign size={13} /> الرصيد
                      </button>
                      <button
                        onClick={() => banIp(u)}
                        title="حظر IP المستخدم"
                        className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldAlert size={13} /> حظر IP
                      </button>
                      <button
                        onClick={() => setRole(u)}
                        title="تغيير الدور"
                        className="bg-white/5 hover:bg-white/10 text-muted-foreground border border-border p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Key size={14} />
                      </button>
                      <button
                        onClick={() => ban(u)}
                        title={u.banned ? "إلغاء الحظر" : "حظر الحساب"}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          u.banned
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20"
                            : "bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/20"
                        }`}
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <BannedIpsCard />
    </div>
  );
}

function BannedIpsCard() {
  const [bannedIps, setBannedIps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchIps = () => {
    setLoading(true);
    fetch("/api/admin/banned-ips", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBannedIps(data.ips || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIps();
  }, []);

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/banned-ips", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: newIp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "تعذر حظر الـ IP");
      await Swal.fire({
        icon: "success",
        title: data.message || "تم حظر IP بنجاح ✅",
        timer: 1500,
        showConfirmButton: false,
        background: "#111",
        color: "#fff",
      });
      setNewIp("");
      fetchIps();
    } catch (err: any) {
      await Swal.fire({
        icon: "error",
        title: "تعذر حظر IP",
        text: err.message || "حدث خطأ",
        background: "#111",
        color: "#fff",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveIp = async (ip: string) => {
    try {
      const res = await fetch(`/api/admin/banned-ips?ip=${encodeURIComponent(ip)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "تعذر إلغاء الحظر");
      await Swal.fire({
        icon: "success",
        title: data.message || "تم إلغاء حظر IP بنجاح ✅",
        timer: 1500,
        showConfirmButton: false,
        background: "#111",
        color: "#fff",
      });
      fetchIps();
    } catch (err: any) {
      await Swal.fire({
        icon: "error",
        title: "تعذر إلغاء حظر IP",
        text: err.message || "حدث خطأ",
        background: "#111",
        color: "#fff",
      });
    }
  };

  return (
    <Card title={`🛡️ عناوين الـ IP المحظورة من الموقع (${bannedIps.length})`}>
      <p className="text-xs text-muted-foreground mb-4">
        العناوين المسجلة هنا يُحظر دخول أصحابها للموقع أو تنفيذ أي عمليات أو فتح أي صفحات.
      </p>

      <form onSubmit={handleAddIp} className="flex gap-3 mb-5">
        <input
          type="text"
          value={newIp}
          onChange={(e) => setNewIp(e.target.value)}
          placeholder="إضافة IP جديد للحظر (مثال: 197.35.42.100)..."
          className="flex-1 h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none"
        />
        <button
          type="submit"
          disabled={adding || !newIp.trim()}
          className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white text-sm disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <ShieldAlert size={16} /> حظر IP جديد
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-muted-foreground">جاري تحميل القائمة...</p>
      ) : bannedIps.length === 0 ? (
        <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
          ✅ لا توجد عناوين IP محظورة حالياً.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {bannedIps.map((ip) => (
            <div key={ip} className="flex items-center justify-between p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs font-mono">
              <span className="font-bold text-rose-300" dir="ltr">{ip}</span>
              <button
                type="button"
                onClick={() => handleRemoveIp(ip)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-[11px] font-bold transition-all cursor-pointer"
              >
                إلغاء الحظر
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refresh, setRefresh] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  useEffect(() => {
    let active = true;
    setLoadingOrders(true);
    setOrdersError("");
    fetch("/api/admin/orders", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result?.error?.message || result?.error || "تعذر تحميل الطلبات");
        }
        if (active) setOrders(Array.isArray(result.orders) ? result.orders : []);
      })
      .catch((error) => {
        if (active) {
          setOrdersError(error instanceof Error ? error.message : "تعذر تحميل الطلبات");
        }
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (
      search &&
      !(o.service_name || "").includes(search) &&
      !(o.user_id || "").includes(search)
    )
      return false;
    return true;
  });

  const notifyOrderUser = async (orderId: string, email: string, status: string, serviceName: string) => {
    if (!email) return;
    try {
      await fetch("/api/admin/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, orderId, status, serviceName })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateOrderViaApi = async (
    id: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, any> | null> => {
    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(id)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        const rawMessage = result?.error?.message || result?.error;
        const message =
          rawMessage === "INSUFFICIENT_BALANCE"
            ? "رصيد العميل غير كافٍ لإكمال الطلب"
            : rawMessage === "ORDER_NOT_FOUND"
              ? "الطلب غير موجود"
              : rawMessage || "تعذر تحديث الطلب";
        throw new Error(message);
      }
      return result.update || {};
    } catch (error) {
      await Swal.fire({
        title: "تعذر تحديث الطلب",
        text: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        icon: "error",
        background: "#111",
        color: "#fff",
      });
      return null;
    }
  };

  const update = async (id: string, status: string, currentOrder?: any) => {
    if (status === "provide_link") {
      const requestedChoice = currentOrder?.options?.tiktokChoice;
      const needsQr = requestedChoice === "qr";
      const { value: formValues } = await Swal.fire({
        title: needsQr ? 'رفع رمز QR للعميل' : 'إرسال رابط الشحن للعميل',
        html: `
          <div style="text-align: right; direction: rtl;">
            <div style="margin-bottom: 14px; color: #38bdf8; font-weight: 700;">
              طريقة التنفيذ التي اختارها العميل: ${needsQr ? "QR Code" : "رابط شحن"}
            </div>
            <label style="display: block; margin-bottom: 8px;">رابط التسليم</label>
            <input id="swal-input-link" class="swal2-input" placeholder="رابط الدخول..." ${needsQr ? 'style="display:none"' : ""}>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #333;">
            <label style="display: block; margin-bottom: 8px;">صورة QR</label>
            <input type="file" id="swal-input-file" class="swal2-file" accept="image/*" ${needsQr ? "" : 'style="display:none"'}>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'إرسال',
        cancelButtonText: 'إلغاء',
        background: '#1a1a1a',
        color: '#fff',
        preConfirm: () => {
          const linkVal = (document.getElementById('swal-input-link') as HTMLInputElement).value;
          const fileInput = document.getElementById('swal-input-file') as HTMLInputElement;
          const file = fileInput.files?.[0];
          if ((needsQr && !file) || (!needsQr && !linkVal.trim())) {
            Swal.showValidationMessage(needsQr ? "ارفع صورة QR أولاً" : "أدخل رابط التسليم أولاً");
            return false;
          }
          return { link: linkVal, file };
        }
      });

      if (!formValues) return;
      
      let updateData: any = {};
      if (formValues.link) {
        updateData.delivered_link = formValues.link;
        updateData.authLink = formValues.link;
      }
      
      if (formValues.file) {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(formValues.file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        }).then((base64) => {
          updateData.qr_image = base64;
          updateData.qr_expires_at = Date.now() + 30000;
        });
      }

      if (Object.keys(updateData).length > 0) {
        updateData.fulfillmentStatus = "delivered";
        const savedUpdate = await updateOrderViaApi(id, {
          status: "provide_link",
          delivery: updateData,
        });
        if (!savedUpdate) return;
        setOrders((previous) => previous.map((order) => (
          order.id === id ? { ...order, ...updateData, ...savedUpdate } : order
        )));
        toast.success("تم إرسال البيانات للمستخدم بنجاح 💾");
        await notifyOrderUser(id, currentOrder?.user_email, "provide_link", currentOrder?.service_name || "خدمة");
      } else {
        Swal.fire({ title: 'خطأ', text: 'لم تقم بإدخال رابط أو رفع صورة!', icon: 'error', background: '#1a1a1a', color: '#fff' });
      }
      return;
    }

    if (status === "completed") {
      const { value: supplierPrice, isConfirmed: costConfirmed } = await Swal.fire({
        title: "سعر المورد (بالدولار)",
        input: 'number',
        inputAttributes: { step: '0.0001', min: '0' },
        text: "أدخل سعر المورد الفعلي. سيحسب النظام إجمالي التكلفة والربح ويثبتهما على الطلب.",
        showCancelButton: true,
        confirmButtonText: "إكمال الطلب",
        cancelButtonText: "إلغاء",
        background: "#111",
        color: "#fff",
        confirmButtonColor: "#10b981"
      });

      if (!costConfirmed) return;
      
      const price = Number(supplierPrice);
      if (!Number.isFinite(price) || price < 0) return;
      if (currentOrder?.status === "pending_action" && !currentOrder.balance_deducted) {
        const { isConfirmed: deductConfirmed } = await Swal.fire({
          title: "تنبيه",
          text: "هذا الطلب لم يتم خصم رصيده مسبقاً. هل تريد خصم الرصيد الآن وتحويله إلى مكتمل؟",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "نعم، خصم وإكمال",
          cancelButtonText: "إلغاء",
          background: "#111",
          color: "#fff",
          confirmButtonColor: "#38bdf8"
        });
        if (!deductConfirmed) return;
      }

      const savedUpdate = await updateOrderViaApi(id, {
        status: "completed",
        supplierPriceUsd: price,
      });
      if (!savedUpdate) return;
      setOrders((prev) => prev.map((o) => (
        o.id === id ? { ...o, ...savedUpdate } : o
      )));
      await Swal.fire({
        title: "تم!",
        text: "تم قبول الطلب وإكماله بنجاح",
        icon: "success",
        background: "#111",
        color: "#fff",
      });
      await notifyOrderUser(id, currentOrder?.user_email, status, currentOrder?.service_name || "خدمة");
      return;
    }

    if (status === "rejected") {
      const { value: formValues, isConfirmed } = await Swal.fire({
        title: "رفض الطلب",
        html: `
          <div style="text-align: right; direction: rtl;">
            <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 600;">سبب الرفض</label>
            <textarea id="swal-reject-reason" class="swal2-textarea" placeholder="أدخل سبب رفض الطلب..." style="min-height: 100px; text-align: right;"></textarea>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "نعم، ارفض",
        cancelButtonText: "إلغاء",
        background: "#111",
        color: "#fff",
        confirmButtonColor: "#ff4444",
        preConfirm: () => {
          const reason = (document.getElementById('swal-reject-reason') as HTMLTextAreaElement).value.trim();
          if (!reason) {
            Swal.showValidationMessage('يجب إدخال سبب رفض الطلب');
            return false;
          }
          return { reason };
        }
      });
      if (!isConfirmed || !formValues) return;

      try {
        const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            reason: formValues.reason,
          })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(
            (typeof result?.error === "string" ? result.error : result?.error?.message)
              || "تعذر رفض الطلب"
          );
        }
        setOrders((prev) => prev.map((o) => (
          o.id === id
            ? {
                ...o,
                status: "rejected",
                rejection_reason: formValues.reason,
                refunded: Number(result.refundedUsd) > 0,
              }
            : o
        )));
        toast.success("تم رفض الطلب بنجاح 💾");
        await notifyOrderUser(id, currentOrder?.user_email, "rejected", currentOrder?.service_name || "خدمة");
      } catch (networkErr: any) {
        const msg = typeof networkErr?.message === "string" ? networkErr.message : "تعذر رفض الطلب";
        await Swal.fire({ title: "تعذر رفض الطلب", text: msg, icon: "error", background: "#111", color: "#fff" });
      }
      return;
    }

    if (status === "cancelled") {
      const { isConfirmed } = await Swal.fire({
        title: "تأكيد الإلغاء",
        text: "هل أنت متأكد من إلغاء الطلب؟",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "نعم، ألغِ",
        cancelButtonText: "إلغاء",
        background: "#111",
        color: "#fff",
        confirmButtonColor: "#ff4444"
      });
      if (!isConfirmed) return;
      const savedUpdate = await updateOrderViaApi(id, { status: "cancelled" });
      if (!savedUpdate) return;
      setOrders((prev) => prev.map((o) => (
        o.id === id ? { ...o, ...savedUpdate } : o
      )));
      await notifyOrderUser(id, currentOrder?.user_email, "cancelled", currentOrder?.service_name || "خدمة");
      return;
    }

    const savedUpdate = await updateOrderViaApi(id, { status });
    if (!savedUpdate) return;
    setOrders((prev) => prev.map((o) => (
      o.id === id ? { ...o, ...savedUpdate } : o
    )));
    await notifyOrderUser(id, currentOrder?.user_email, status, currentOrder?.service_name || "خدمة");
  };

  const showDetails = (o: any) => {
    const choiceLabels: Record<string, string> = {
      link: "رابط شحن",
      qr: "QR Code",
      userpass: "يوزر وباسورد",
    };
    let text = `الرابط / آيدي اللاعب: ${o.link || "لا يوجد"}\n`;
    if (o.whatsapp) text += `واتساب: ${o.whatsapp}\n`;
    if (o.options) {
      if (o.options.tiktokChoice) text += `طريقة الشحن: ${choiceLabels[o.options.tiktokChoice] || o.options.tiktokChoice}\n`;
      if (o.options.username) text += `اليوزر: ${o.options.username}\n`;
      if (o.options.password) text += `كلمة السر: ${o.options.password}\n`;
      if (o.options.googleAccount) text += `حساب جوجل: ${o.options.googleAccount}\n`;
      if (o.options.verificationCode) text += `رمز التحقق: ${o.options.verificationCode}\n`;
      if (o.options.whatsapp && o.options.whatsapp !== o.whatsapp) {
        text += `واتساب QR: ${o.options.whatsapp}\n`;
      }
    }

    if (o.service_name?.includes("Telegram") || o.service_name?.includes("تليجرام")) {
      const is1Yr = o.service_name?.includes("1") || o.service_id?.includes("1yr");
      const is6Mo = o.service_name?.includes("6") || o.service_id?.includes("6mo");
      const rawUsdCost = is1Yr ? 28.99 : is6Mo ? 15.99 : 11.99;
      const estTon = (rawUsdCost / 3.30).toFixed(2);
      text += `\n💎 تكلفة الشحن بمحفظة TON للآدمن:\n• تكلفة تليجرام بالدولار: $${rawUsdCost}\n• سعر صرف 1 TON التقريبي: $3.30 USD\n• الكمية المطلوبة بالتحويل من محفظة TON: ~${estTon} TON\n`;
    }
    Swal.fire({
      title: "تفاصيل الطلب",
      text,
      icon: "info",
      background: "#111",
      color: "#fff",
      confirmButtonText: "حسناً",
      confirmButtonColor: "#38bdf8"
    });
  };

  return (
    <Card title={`📦 الطلبات (${filtered.length})`}>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 150 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inp, paddingRight: 36 }}
            placeholder="بحث..."
          />
          <Search
            size={16}
            color="#666"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
        </div>
        <GenericCustomSelect
          value={filter}
          title="تصفية الطلبات"
          options={[
            { value: "all", label: "الكل" },
            { value: "pending", label: "معلق" },
            { value: "pending_action", label: "بانتظار إجراء" },
            { value: "completed", label: "مكتمل" },
            { value: "rejected", label: "مرفوض" },
          ]}
          onChange={(val) => setFilter(val)}
          className="w-36 shrink-0"
        />
        <button onClick={() => setRefresh((r) => r + 1)} style={btnSm}>
          <RefreshCw size={14} />
        </button>
      </div>
      {loadingOrders && <p className="mb-4 text-muted-foreground">جاري تحميل الطلبات...</p>}
      {ordersError && <p className="mb-4 text-red-400">{ordersError}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/5">
              {[
                "الخدمة",
                "المستخدم",
                "المبلغ",
                "الكمية",
                "الحالة",
                "الدفع",
                "التاريخ",
                "إجراء",
              ].map((h) => (
                <th
                  key={h}
                  className="p-4 text-right text-muted-foreground font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-border/30 hover:bg-white/5 transition-colors">
                <td className="p-4 max-w-[140px] truncate whitespace-nowrap text-foreground">
                  {o.service_name}
                </td>
                <td className="p-4 text-xs text-muted-foreground font-mono text-right" dir="ltr">
                  {o.user_id?.slice(0, 8)}
                </td>
                <td className="p-4 font-bold text-primary text-right whitespace-nowrap" dir="ltr">
                  {o.price} {o.currency}
                </td>
                <td className="p-4 text-foreground font-mono">{o.quantity}</td>
                <td className="p-4">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                      o.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : o.status === "rejected"
                          ? "bg-destructive/10 text-destructive"
                          : o.status === "pending_action"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-primary/10 text-primary"
                    }`}
                  >
                    {o.status === "completed"
                      ? "مكتمل"
                      : o.status === "rejected"
                        ? "مرفوض"
                        : o.status === "pending_action"
                          ? "إجراء مطلوب"
                          : "معلق"}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                      o.paymentStatus === "paid"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : o.paymentStatus === "verifying"
                          ? "bg-blue-500/10 text-blue-500"
                          : o.paymentStatus === "awaiting_payment"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-gray-500/10 text-gray-500"
                    }`}
                  >
                    {o.paymentStatus === "paid"
                      ? "مدفوع"
                      : o.paymentStatus === "verifying"
                        ? "جاري التحقق"
                        : o.paymentStatus === "awaiting_payment"
                          ? "بانتظار الدفع"
                          : "محفظة/مسبق"}
                  </span>
                  <VerificationCountdown item={o} />
                </td>
                <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                  {o.created_at
                    ? new Date(
                      typeof o.created_at === "object" && o.created_at._seconds
                        ? o.created_at._seconds * 1000
                        : o.created_at,
                    ).toLocaleDateString("en-US")
                    : "—"}
                </td>
                <td className="p-4">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => showDetails(o)}
                        className="bg-white/5 hover:bg-white/10 text-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        تفاصيل
                      </button>

                      {o.status === "pending_action" && !o.authLink && !o.qr_image && (
                        <button
                          onClick={() => update(o.id, "provide_link", o)}
                          className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          🔗 ضع الرابط / الصورة
                        </button>
                      )}

                      {o.status !== "completed" && o.status !== "rejected" && (
                        <>
                        <button
                          onClick={() => update(o.id, "completed", o)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          ✅ قبول
                        </button>
                        <button
                          onClick={() => update(o.id, "rejected", o)}
                          className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          ❌ رفض
                        </button>
                        </>
                      )}
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Calculator Tab ──────────────────────────────────────────────────────────

export function CalculatorTab() {
  const [costUsd, setCostUsd] = useState("10.3");
  const [usdRate, setUsdRate] = useState("55");
  const [coins, setCoins] = useState("1000");
  const [tiers, setTiers] = useState<any[]>([]);

  useEffect(() => {
    fetchAdminData("settings/pricing").then((result) => {
      if (result.exists) {
        const v = result.data;
        setCostUsd(String(v.tiktok_cost_usd || "10.3"));
        setUsdRate(String(v.usd_rate || "55"));
      }
    }).catch(console.error);
    fetchAdminData("tiers").then((result) => {
      const data: any[] = result.items || [];
      data.sort((a, b) => Number(a.min) - Number(b.min));
      setTiers(data);
    }).catch(console.error);
  }, []);

  const cost = ceilTo2Decimals(
    (((+coins || 0) * (+costUsd || 0)) / 1000) * (+usdRate || 0),
  );

  let suggestedPrice = cost;
  let profit = 0;
  
  if (tiers.length > 0) {
    const cNum = +coins || 0;
    suggestedPrice = calculateTikTokPriceEgp(cNum, tiers, Number(usdRate));
    profit = ceilTo2Decimals(suggestedPrice - cost);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Card title="🧮 حاسبة أرباح تيك توك">
        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <div>
              <label style={lbl}>تكلفة الألف ($)</label>
              <input
                type="number"
                step="0.01"
                value={costUsd}
                onChange={(e) => setCostUsd(e.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>سعر الدولار (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                style={inp}
              />
            </div>
          </div>
          <div>
            <label style={lbl}>عدد العملات للعميل</label>
            <input
              type="number"
              value={coins}
              onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
              onChange={(e) => {
                let val = e.target.value;
                if (val.includes('.')) {
                  val = val.split('.')[0];
                  e.target.value = val;
                }
                setCoins(val);
              }}
              style={{ ...inp, fontSize: 18, fontWeight: 'bold' }}
            />
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.05)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
          >
            <div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 4 }}>
                التكلفة بالدولار
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8" }}>
                ≈ {ceilTo2Decimals((((+coins || 0) * (+costUsd || 0)) / 1000))} $
              </div>
            </div>
            <div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 4 }}>التكلفة بالجنيه</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#ff4444" }}>
                {cost} ج.م
              </div>
            </div>
            <div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 4 }}>
                السعر المقترح (حسب الشريحة)
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#00ff80" }}>
                {tiers.length > 0 ? `${suggestedPrice} ج.م` : "لا توجد شرائح أسعار"}
              </div>
            </div>
            <div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 4 }}>الربح المتوقع</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24" }}>
                {tiers.length > 0 ? `${profit} ج.م` : "-"}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── External Customer Calculator ─────────────────────────────────────

export function ExternalCustomerCalculatorTab() {
  const [coins, setCoins] = useState("1000");
  const [selectedServiceId, setSelectedServiceId] = useState("tiktok_coins");
  const [services, setServices] = useState<any[]>([]);
  const [usdRate, setUsdRate] = useState(0);
  const [smmRate, setSmmRate] = useState(0);
  const [tiers, setTiers] = useState<TikTokPricingTier[]>([]);
  const [depositFeePercent, setDepositFeePercent] = useState(0.75);
  const [loading, setLoading] = useState(true);
  const [priceTable, setPriceTable] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAdminData("settings/pricing"),
      fetchAdminData("tiers"),
      fetchAdminData("settings/manual_services"),
      fetchAdminData("calculator_services"),
    ]).then(([pricingResult, tiersResult, manualSettingsResult, calculatorServicesResult]) => {
      const pricing = pricingResult.data || {};
      const currentUsdRate = Number(pricing.usd_rate || pricing.tiktok_usd_rate || 0);
      setUsdRate(currentUsdRate);
      setSmmRate(Number(pricing.smm_usd_rate || 0));
      const configuredFee = Number(pricing.deposit_fee_percent ?? pricing.depositFeePercent ?? 0.75);
      setDepositFeePercent(Number.isFinite(configuredFee) && configuredFee >= 0 ? configuredFee : 0.75);
      const loadedTiers = (tiersResult.items || []).sort(
        (a: TikTokPricingTier, b: TikTokPricingTier) => Number(a.min) - Number(b.min),
      );
      setTiers(loadedTiers);

      const configuredManual = Array.isArray(manualSettingsResult.data?.services)
        ? manualSettingsResult.data.services
        : [];
      const defaultManual = [
        { id: "tiktok_promo", name: "ترويج تيك توك", price: 0.5, min: 10, max: 50_000 },
        { id: "instagram_promo", name: "ترويج انستجرام", price: 0.5, min: 10, max: 50_000 },
        { id: "facebook_promo", name: "ترويج فيسبوك", price: 0.5, min: 10, max: 50_000 },
        { id: "tiktok_superfan", name: "اشتراك سوبر فان - شهري", price: 150, min: 1, max: 1 },
        { id: "tiktok_hidden_w", name: "اشتراك مخفي - اسبوعي", price: 0, min: 1, max: 1 },
        { id: "tiktok_hidden_m", name: "اشتراك مخفي - شهري", price: 0, min: 1, max: 1 },
      ];
      const mergedManual = Array.from(new Map(
        [...defaultManual, ...configuredManual].map((service: any) => [String(service.id), service]),
      ).values());
      const fixedServices = mergedManual.map((service: any) => {
        const linkedCoinQuantity = service.id === "tiktok_hidden_w"
          ? 13_000
          : service.id === "tiktok_hidden_m"
            ? 26_000
            : 0;
        const initialUsdPrice = service.priceUsd ?? service.price_usd ?? (service.price && currentUsdRate > 0 ? (Number(service.price) / currentUsdRate).toFixed(2) : "0");
        return {
          ...service,
          service: service.id,
          category: service.category || "الخدمات اليدوية",
          isManual: true,
          priceUsd: String(initialUsdPrice),
          price_usd: String(initialUsdPrice),
          price: linkedCoinQuantity > 0
            ? calculateTikTokPriceEgp(linkedCoinQuantity, loadedTiers, currentUsdRate)
            : Number(initialUsdPrice) > 0 && currentUsdRate > 0
              ? Math.round(Number(initialUsdPrice) * currentUsdRate * 100) / 100
              : Number(service.price || 0),
        };
      });
      const firestoreServices = (calculatorServicesResult.manualItems || []).map((data: any) => {
        return {
          id: data.id,
          ...data,
          service: data.service || data.id,
          isManual: true,
        };
      });
      const allServices = [
        { service: "tiktok_coins", name: "شحن عملات تيك توك", category: "تيك توك", min: 1, max: 1_000_000, isTikTokCoins: true },
        ...fixedServices,
        ...firestoreServices,
      ];
      setServices(Array.from(new Map(allServices.map((service: any) => [String(service.service), service])).values()));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const quantity = Math.max(0, Math.trunc(Number(coins) || 0));
  const selectedService = services.find((service) => String(service.service) === selectedServiceId);
  const isTikTokCoins = selectedServiceId === "tiktok_coins";
  const matchingTier = isTikTokCoins
    ? tiers.find((tier) => quantity >= Number(tier.min) && quantity <= Number(tier.max))
    : undefined;
  const serviceMin = Number(selectedService?.min || 1);
  const serviceMax = Number(selectedService?.max || 1_000_000);
  const validQuantity = quantity >= serviceMin && quantity <= serviceMax;
  const serviceUnitPrice = selectedService?.isManual
    ? Number(selectedService.price || 0)
    : Number(selectedService?.rate || 0) * (usdRate + 4) * 1.005;
  let sitePrice = 0;
  if (quantity > 0 && validQuantity) {
    if (isTikTokCoins && matchingTier) {
      sitePrice = calculateTikTokPriceEgp(quantity, tiers, usdRate);
    } else if (selectedService?.isManual || selectedService?.type === "Package") {
      sitePrice = ceilTo2Decimals(quantity * serviceUnitPrice);
    } else {
      sitePrice = ceilTo2Decimals((quantity * serviceUnitPrice) / 1000);
    }
  }
  const outsidePrice = ceilTo2Decimals(sitePrice * (1 + depositFeePercent / 100));
  const addedAmount = outsidePrice - sitePrice;

  const randomUniqueQuantities = (min: number, max: number, count: number) => {
    const values = new Set<number>();
    while (values.size < count) {
      values.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(values).sort((a, b) => a - b);
  };

  const generatePriceTable = () => {
    const groups = [
      { title: "فئة 30 إلى 99", min: 30, max: 99, count: 5 },
      { title: "فئة 100", min: 100, max: 249, count: 10 },
      { title: "فئة 250", min: 250, max: 499, count: 10 },
      { title: "فئة 500", min: 500, max: 999, count: 10 },
      { title: "فئة 1000 إلى 2.5 مليون", min: 1000, max: 2_500_000, count: 35 },
    ];

    const lines = [
      `جدول أسعار عملاء خارج الموقع (+${depositFeePercent}%)`,
      "عدد العملات | السعر بالجنيه",
      "-----------------------------",
    ];

    for (const group of groups) {
      lines.push("", `【 ${group.title} 】`);
      for (const amount of randomUniqueQuantities(group.min, group.max, group.count)) {
        const tier = tiers.find(
          (item) => amount >= Number(item.min) && amount <= Number(item.max),
        );
        if (!tier) continue;
        const customerPrice = calculateTikTokPriceEgp(amount, tiers, usdRate);
        const externalPrice = ceilTo2Decimals(customerPrice * (1 + depositFeePercent / 100));
        lines.push(`${amount} عملة | ${externalPrice} ج.م`);
      }
    }

    setPriceTable(lines.join("\n"));
    setCopyMessage("");
  };

  const copyPriceTable = async () => {
    if (!priceTable) return;
    await navigator.clipboard.writeText(priceTable);
    setCopyMessage("✅ تم نسخ جدول الأسعار");
    window.setTimeout(() => setCopyMessage(""), 2500);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Card title="🧮 حاسبة كل خدمات الموقع لعملاء الخارج">
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <label style={lbl}>الخدمة</label>
            <select
              value={selectedServiceId}
              onChange={(event) => {
                setSelectedServiceId(event.target.value);
                const service = services.find((item) => String(item.service) === event.target.value);
                setCoins(String(Math.max(1, Number(service?.min || 1))));
              }}
              style={inp}
            >
              {services.map((service) => (
                <option key={String(service.service)} value={String(service.service)}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>{isTikTokCoins ? "عدد العملات" : "الكمية"}</label>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={coins}
              onKeyDown={(event) => {
                if (event.key === "." || event.key === "," || event.key === "-") event.preventDefault();
              }}
              onChange={(event) => setCoins(event.target.value.replace(/\D/g, ""))}
              style={{ ...inp, fontSize: 18, fontWeight: 800 }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">سعر عميل الموقع</div>
              <div className="text-2xl font-black text-sky-400">{sitePrice} ج.م</div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">زيادة عميل الخارج ({depositFeePercent}%)</div>
              <div className="text-2xl font-black text-amber-400">+{addedAmount} ج.م</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">السعر المطلوب</div>
              <div className="text-2xl font-black text-emerald-400">{outsidePrice} ج.م</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            {loading
              ? "جاري تحميل خدمات وأسعار الموقع..."
              : !validQuantity || (isTikTokCoins && !matchingTier)
                ? `الكمية المسموحة من ${serviceMin} إلى ${serviceMax}.`
                : isTikTokCoins && matchingTier
                  ? `الشريحة المستخدمة: من ${matchingTier.min} إلى ${matchingTier.max} عملة. كل النتائج بالجنيه مقربة لأعلى لأقرب جنيه.`
                  : `سعر خدمة «${selectedService?.name || "-"}» محسوب بنفس تسعير الموقع ومقرب لأعلى لأقرب جنيه.`}
          </div>
        </div>
      </Card>

      <Card title="📋 مولّد جدول أسعار عملاء الخارج">
        <div style={{ display: "grid", gap: 16 }}>
          <p className="m-0 text-sm leading-7 text-muted-foreground">
            ينشئ 60 سعرًا عشوائيًا: 10 من فئة 100، و10 من فئة 250،
            و10 من فئة 500، و30 من فئة 1000 حتى مليون عملة.
            جميع الأسعار تشمل زيادة {depositFeePercent}% ومقربة لأعلى لأقرب جنيه.
          </p>
          <div>
            <button
              type="button"
              onClick={generatePriceTable}
              disabled={loading || tiers.length === 0 || usdRate <= 0}
              style={saveBtn}
            >
              <RefreshCw size={16} /> توليد جدول عشوائي جديد
            </button>
            <button
              type="button"
              onClick={copyPriceTable}
              disabled={!priceTable}
              style={{
                ...saveBtn,
                background: priceTable ? "#10b981" : "#334155",
                color: "#fff",
              }}
            >
              نسخ الجدول كنص
            </button>
          </div>

          <textarea
            readOnly
            dir="rtl"
            value={priceTable}
            placeholder="اضغط «توليد جدول عشوائي جديد» لعرض الأسعار هنا..."
            style={{
              ...inp,
              minHeight: 560,
              resize: "vertical",
              fontFamily: "monospace",
              lineHeight: 1.9,
              whiteSpace: "pre",
            }}
          />
          {copyMessage && <StatusMsg msg={copyMessage} />}
        </div>
      </Card>
    </div>
  );
}

// ─── TikTok Services ─────────────────────────────────────────────────────────

export function ManualServicesTab() {
  const [svcs, setSvcs] = useState<any[]>([]);
  const [usdRate, setUsdRate] = useState(0);
  const [depositFeePercent, setDepositFeePercent] = useState(0.5);
  const [tiers, setTiers] = useState<TikTokPricingTier[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    Promise.all([
      fetchAdminData("settings/manual_services"),
      fetchAdminData("settings/pricing"),
      fetchAdminData("tiers"),
    ]).then(([servicesResult, pricingResult, tiersResult]) => {
      const rate = Number(
        pricingResult.data?.usd_rate || pricingResult.data?.tiktok_usd_rate || 0,
      );
      setUsdRate(rate);
      const feeP = Number(pricingResult.data?.deposit_fee_percent ?? pricingResult.data?.depositFeePercent ?? 0.5);
      if (Number.isFinite(feeP) && feeP >= 0) setDepositFeePercent(feeP);
      setTiers((tiersResult.items || []).sort(
        (a: TikTokPricingTier, b: TikTokPricingTier) => Number(a.min) - Number(b.min),
      ));
      const services =
        servicesResult.exists && servicesResult.data.services
          ? servicesResult.data.services
          : [
          {
            id: "tiktok_promo",
            name: "ترويج تيك توك",
            price: "0.5",
            min: "10",
            max: "50000",
            desc: "سعر ترويج تيك توك",
          },
          {
            id: "instagram_promo",
            name: "ترويج انستجرام",
            price: "0.5",
            min: "10",
            max: "50000",
            desc: "سعر ترويج انستجرام",
          },
          {
            id: "facebook_promo",
            name: "ترويج فيسبوك",
            price: "0.5",
            min: "10",
            max: "50000",
            desc: "سعر ترويج فيسبوك",
          },
          {
            id: "tiktok_superfan",
            name: "سوبر فان - شهري",
            price: "150",
            min: "1",
            max: "1",
            desc: "سعر الاشتراك الشهري",
          },
          {
            id: "tiktok_hidden_w",
            name: "اشتراك مخفي - اسبوعي",
            price: "30",
            min: "1",
            max: "1",
            desc: "سعر الاشتراك الاسبوعي",
          },
          {
            id: "tiktok_hidden_m",
            name: "اشتراك مخفي - شهري",
            price: "100",
            min: "1",
            max: "1",
            desc: "سعر الاشتراك الشهري",
          },
        ];
      setSvcs(services.map((service: any) => ({
        ...service,
        price: service.price || (rate > 0 && service.price_usd ? Math.ceil(((Number(service.price_usd) * rate) - 1e-9) * 100) / 100 : ""),
        // Keep legacy packages tied to their original USD value, using the
        // rate stored when they were created rather than today's rate.
        priceUsd: getManualServicePriceUsd(service) || "",
      })));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    // Keep the admin price preview in sync with any USD rate change.
    const pricingRef = doc(db, "settings", "pricing");
    return onSnapshot(pricingRef, (snapshot) => {
      const pricing = snapshot.data() as Record<string, unknown> | undefined;
      const rate = Number(pricing?.usd_rate || pricing?.tiktok_usd_rate || 0);
      if (Number.isFinite(rate) && rate > 0) setUsdRate(rate);
    }, console.error);
  }, []);

  const addGameCategory = async () => {
    const { value: gameName } = await Swal.fire({
      title: "🕹️ إضافة لعبة / قسم جديد",
      input: "text",
      inputLabel: "أدخل اسم اللعبة أو القسم الجديد",
      inputPlaceholder: "مثال: PUBG MOBILE أو Honor of Kings",
      showCancelButton: true,
      confirmButtonText: "إضافة اللعبة",
      cancelButtonText: "إلغاء",
      background: "#0c1322",
      color: "#fff",
      confirmButtonColor: "#38bdf8",
      inputValidator: (val) => {
        if (!val || !val.trim()) return "يرجى كتابة اسم اللعبة أو القسم!";
      },
    });

    if (gameName && gameName.trim()) {
      addManualPackage(gameName.trim(), "الباقة الأولى (مثال: 60 شدة)");
    }
  };

  const addManualPackage = (presetCategory?: string, presetName?: string) => {
    const newId = `manual_pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setSvcs((prev) => [
      ...prev,
      {
        id: newId,
        name: presetName || "خدمة / اشتراك جديد",
        category: presetCategory || "أخرى",
        price: "100",
        priceUsd: usdRate > 0 ? (Math.round((100 / usdRate) * 100) / 100).toString() : "2",
        min: "1",
        max: "1",
        desc: "خدمة أو اشتراك يدوي",
      },
    ]);
  };

  const removeManualPackage = (index: number) => {
    setSvcs((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setBusy(true);
    const sanitizedServices = svcs.map((s) => {
      const linkedCoins = s.id === "tiktok_hidden_w" ? 13_000 : s.id === "tiktok_hidden_m" ? 26_000 : 0;
      const automaticEgp = linkedCoins > 0 && tiers.length > 0
        ? calculateTikTokPriceEgp(linkedCoins, tiers, usdRate)
        : 0;

      const isAutoLocked = linkedCoins > 0 && tiers.length > 0;

      if (isAutoLocked) {
        return {
          ...s,
          price: automaticEgp.toString(),
          price_usd: usdRate > 0 ? (automaticEgp / usdRate).toFixed(2) : "0",
        };
      }

      const usdPrice = Number(s.priceUsd ?? s.price_usd ?? 0);
      const discountPercent = usdPrice > 10 ? Math.min(100, Math.max(0, Number(s.discountPercent || 0))) : 0;
      const computedEgp = usdRate > 0 && usdPrice > 0 ? Math.round(usdPrice * usdRate * 100) / 100 : Number(s.price || 0);
      const usdStr = usdPrice ? usdPrice.toString() : String(s.priceUsd || s.price_usd || "0");
      const minVal = Number(s.min || s.min_quantity || 1);
      const maxVal = Number(s.max || s.max_quantity || 1);
      return {
        ...s,
        min: minVal.toString(),
        max: maxVal.toString(),
        min_quantity: minVal,
        max_quantity: maxVal,
        price: computedEgp ? computedEgp.toString() : s.price || "0",
        priceUsd: usdStr,
        price_usd: usdStr,
        discountPercent: discountPercent > 0 ? discountPercent.toString() : "",
      };
    });

    await writeAdminData({
      action: "saveManualServices",
      services: sanitizedServices,
    });
    setSvcs(sanitizedServices.map((s) => ({
      ...s,
      priceUsd: s.price_usd || s.priceUsd,
    })));
    setMsg("✅ تم حفظ باقات الألعاب والخدمات اليدوية بنجاح");
    setBusy(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleExportSingleService = (serviceItem: any) => {
    handleExportItemsList(serviceItem.name || "خدمة يدوية", [serviceItem]);
  };

  const handleExportItemsList = async (categoryTitle: string, items: any[]) => {
    if (!items || items.length === 0) {
      Swal.fire({
        title: "تنبيه",
        text: "لا توجد خدمات متاحة لاستخراج أسعارها.",
        icon: "warning",
        background: "#111",
        color: "#fff",
      });
      return;
    }

    let depositFeePercent = 0.57;
    let minFeeEgp = 0.57;
    let maxFeeEgp = 180;
    let globalDiscountConfig: any = null;
    try {
      const pSnap = await getDoc(doc(db, "settings", "pricing"));
      if (pSnap.exists()) {
        const d = pSnap.data();
        const f = Number(d?.deposit_fee_percent ?? d?.depositFeePercent ?? d?.feePercent);
        if (Number.isFinite(f) && f >= 0) depositFeePercent = f;
        const minF = Number(d?.minDepositFee ?? d?.minFeeEgp);
        if (Number.isFinite(minF) && minF >= 0) minFeeEgp = minF;
        const maxF = Number(d?.maxDepositFee ?? d?.maxFeeEgp);
        if (Number.isFinite(maxF) && maxF > 0) maxFeeEgp = maxF;
        globalDiscountConfig = {
          enabled: Boolean(d?.global_usd_discount_enabled ?? d?.globalUsdDiscountEnabled),
          discountPercent: Number(d?.global_usd_discount_percent ?? d?.globalUsdDiscountPercent ?? 0),
          maxDiscountUsd: Number(d?.global_usd_discount_max_amount ?? d?.globalUsdDiscountMaxAmount ?? d?.max_discount_usd ?? d?.maxDiscountUsd ?? 0),
          expiresAt: d?.global_usd_discount_expires_at ?? d?.globalUsdDiscountExpiresAt ?? null,
        };
      }
    } catch (e) {
      console.error(e);
    }

    const roundTo0Or5 = (price: number): number => {
      if (!Number.isFinite(price) || price <= 0) return 0;
      const intVal = Math.ceil(price);
      const rem = intVal % 10;
      let rounded = intVal;
      if (rem === 1) rounded = intVal - 1;
      else if (rem === 2) rounded = intVal - 2;
      else if (rem === 3) rounded = intVal + 2;
      else if (rem === 4) rounded = intVal + 1;
      else if (rem === 6) rounded = intVal - 1;
      else if (rem === 7) rounded = intVal - 2;
      else if (rem === 8) rounded = intVal + 2;
      else if (rem === 9) rounded = intVal + 1;
      return Math.max(5, rounded);
    };

    const calcExportGross = (netEgp: number): number => {
      if (!Number.isFinite(netEgp) || netEgp <= 0) return 0;
      const rawFee = netEgp * (depositFeePercent / 100);
      const clampedFee = Math.max(minFeeEgp, Math.min(maxFeeEgp, rawFee));
      const gross = Math.ceil(netEgp + clampedFee);
      return roundTo0Or5(gross);
    };

    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const todayStr = `${d}/${m}/${y} ${hh}:${mm}:${ss}`;

    let listText = `📅 الأسعار بتاريخ: ${todayStr}\n📌 الخدمة: ${categoryTitle}\n\n`;
    if (isGlobalUsdDiscountActive(globalDiscountConfig)) {
      const durationText = calculateExactRemainingTimeText(globalDiscountConfig.expiresAt);
      const capNote = globalDiscountConfig.maxDiscountUsd && globalDiscountConfig.maxDiscountUsd > 0
        ? ` (بحد أقصى ${globalDiscountConfig.maxDiscountUsd}$ خصم)`
        : "";
      listText += `🔥 عرض خاص: خصم ${globalDiscountConfig.discountPercent}% متاح لمدة ${durationText}!${capNote}\n(على جميع الخدمات التي بقيمة 10$ او اكثر)\n\n`;
    }
    listText += `⚠️ ملاحظة:\nالأسعار الموضحة أدناه سارية بتاريخ اليوم فقط، وقد ترتفع أو تنخفض في أي وقت حسب تغير سعر الصرف وتكلفة الشحن.\n\n`;

    let count = 0;
    items.forEach((s: any) => {
      const isTgStars = s.id === "tg_stars_custom" || s.name?.includes("نجوم تليجرام") || s.name?.includes("Telegram Stars");

      if (isTgStars) {
        listText += `\n⭐ أسعار نجوم تليجرام (Telegram Stars):\n`;
        const starQuantities: number[] = [
          50, 60, 70, 80, 90,
          100, 200, 300, 400, 500, 600, 700, 800, 900,
          1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
          10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000,
          100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000,
          1000000
        ];

        starQuantities.forEach((q) => {
          const usd = (q / 50) * 0.92;
          const sellingEgp = Math.ceil(((usd * usdRate) - 1e-9) * 100) / 100;
          const finalPriceEgp = calcExportGross(sellingEgp);

          const formattedQ = q >= 1000 ? q.toLocaleString("en-US") : String(q);
          const formattedPrice = finalPriceEgp.toLocaleString("en-US");
          listText += `✨ ${formattedQ} نجمة تليجرام = ${formattedPrice} ج\n`;
          count++;
        });
        return;
      }

      const sellingEgp = calculateManualServicePriceEgp(s, usdRate, globalDiscountConfig);
      if (sellingEgp <= 0) return;

      const originalSellingEgp = calculateManualServiceOriginalPriceEgp(s, usdRate);
      const hasDiscount = originalSellingEgp > sellingEgp;

      const rawName = String(s.name || s.id);
      let cleanName = rawName.replace(/\s*\([^)]*من[^)]*إلى[^)]*\)/g, "").trim();

      if (cleanName.includes("ChatGPT")) {
        cleanName = "اشتراك شهر ChatGPT Plus";
      } else if (cleanName.includes("Telegram Premium") && (cleanName.includes("3") || cleanName.includes("ثلاثة"))) {
        cleanName = "اشتراك 3 أشهر Telegram Premium";
      }
      const minQ = Number(s.min || s.min_quantity || 1);
      const maxQ = Number(s.max || s.max_quantity || 1);

      if (maxQ > 1 || minQ > 1) {
        const minNetOriginal = minQ * originalSellingEgp;
        const maxNetOriginal = maxQ * originalSellingEgp;
        const minGrossOriginal = calcExportGross(minNetOriginal);
        const maxGrossOriginal = calcExportGross(maxNetOriginal);

        const minNetDiscounted = minQ * sellingEgp;
        const maxNetDiscounted = maxQ * sellingEgp;
        const minGrossDiscounted = calcExportGross(minNetDiscounted);
        const maxGrossDiscounted = calcExportGross(maxNetDiscounted);

        if (hasDiscount) {
          listText += `${cleanName} = من ${minGrossDiscounted.toLocaleString("en-US")} ج إلى ${maxGrossDiscounted.toLocaleString("en-US")} ج (بدلاً من ~من ${minGrossOriginal.toLocaleString("en-US")} ج إلى ${maxGrossOriginal.toLocaleString("en-US")} ج~) 🔥\n`;
        } else {
          listText += `${cleanName} = من ${minGrossDiscounted.toLocaleString("en-US")} ج إلى ${maxGrossDiscounted.toLocaleString("en-US")} ج\n`;
        }
      } else {
        const originalGross = calcExportGross(originalSellingEgp);
        const discountedGross = calcExportGross(sellingEgp);
        if (hasDiscount) {
          listText += `${cleanName} = ${discountedGross.toLocaleString("en-US")} ج (بدلاً من ~${originalGross.toLocaleString("en-US")} ج~) 🔥\n`;
        } else {
          listText += `${cleanName} = ${discountedGross.toLocaleString("en-US")} ج\n`;
        }
      }
      count++;
    });

    if (count === 0) {
      Swal.fire({
        title: "تنبيه",
        text: "لم يتم العثور على أسعار صالحة للخدمات المختارة.",
        icon: "warning",
        background: "#111",
        color: "#fff",
      });
      return;
    }

    listText += `\n🔗 ملاحظة هامة:\nتعتبر هذه القائمة لفترة مؤقتة، ونرجو منكم التعامل المباشر عبر موقعنا الرسمي لسهولة وسرعة الطلب والمتابعة:\n🌐 https://zaitxmedia.com`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(listText).catch(console.error);
    }

    const htmlServicesPreview = listText.replace(/~([^~]+)~/g, '<s style="text-decoration: line-through; color: #ef4444; font-weight: bold;">$1</s>');

    Swal.fire({
      title: `📋 قائمة أسعار (${categoryTitle}) لعملاء الخارج`,
      showCloseButton: true,
      html: `
        <div style="text-align: right; font-family: Cairo, sans-serif; font-size: 13px; line-height: 1.8; color: #fff; background: #0a0a0a; padding: 14px; border-radius: 10px; max-height: 320px; overflow-y: auto; white-space: pre-wrap;" dir="rtl">
          ${htmlServicesPreview}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #10b981; font-weight: bold;">
          ✅ تم نسخ قائمة الأسعار إلى الحافظة تلقائياً!
        </div>
      `,
      icon: "success",
      background: "#111",
      color: "#fff",
      confirmButtonText: "نسخ مجدداً 📋",
      confirmButtonColor: "#38bdf8",
    }).then((res) => {
      if (res.isConfirmed && navigator.clipboard) {
        navigator.clipboard.writeText(listText);
      }
    });
  };

  const promptCategoryExport = () => {
    const cats = Array.from(new Set(svcs.map((s) => s.category || "أخرى")));
    if (cats.length === 0) return;

    let inputOptions: Record<string, string> = { all: "🌐 جميع الخدمات اليدوية" };
    cats.forEach((c) => {
      inputOptions[c] = `📌 قسم: ${c}`;
    });

    Swal.fire({
      title: "استخراج أسعار قسم لعملاء الخارج",
      text: "اختر القسم المطلوب استخراج قائمة أسعار خدماته شاملاً رسوم الإيداع والتقريب لأقرب 5 ج.م:",
      input: "select",
      inputOptions,
      showCancelButton: true,
      confirmButtonText: "استخراج 📋",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#38bdf8",
    }).then((res) => {
      if (res.isConfirmed && res.value) {
        const selected = res.value;
        if (selected === "all") {
          handleExportItemsList("جميع الخدمات اليدوية", svcs);
        } else {
          const filtered = svcs.filter((s) => (s.category || "أخرى") === selected);
          handleExportItemsList(selected, filtered);
        }
      }
    });
  };

function TonPriceTrackerCard({ usdRate }: { usdRate: number }) {
  const [gramUsd, setGramUsd] = useState<number>(3.30);
  const [customUsdInput, setCustomUsdInput] = useState<string>("28.99");
  const [loadingGram, setLoadingGram] = useState<boolean>(false);

  const fetchGramPrice = useCallback(async () => {
    setLoadingGram(true);
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd");
      const data = await res.json();
      const rawPrice = Number(data?.["the-open-network"]?.usd);
      if (Number.isFinite(rawPrice) && rawPrice > 0) {
        setGramUsd(rawPrice);
      }
    } catch (e) {
      console.error("GRAM price fetch error:", e);
    } finally {
      setLoadingGram(false);
    }
  }, []);

  useEffect(() => {
    fetchGramPrice();
    const interval = setInterval(fetchGramPrice, 60000);
    return () => clearInterval(interval);
  }, [fetchGramPrice]);

  const gramUsdWithFee = gramUsd * 1.0001; // +0.01% over official price
  const usdNum = Number(customUsdInput) || 0;
  const gramRequired = gramUsdWithFee > 0 && usdNum > 0 ? (usdNum / gramUsdWithFee).toFixed(4) : "0";

  return (
    <div style={{ background: "linear-gradient(135deg, #0c182b 0%, #12233f 100%)", border: "1px solid rgba(56,189,248,0.3)", padding: 18, borderRadius: 16, marginBottom: 20, textAlign: "right" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          💎 متابعة سعر عملة GRAM وحاسبة الدفع مقابل الدولار ($USD)
        </div>
        <button
          type="button"
          onClick={fetchGramPrice}
          style={{ background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc", padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          {loadingGram ? "جاري التحديث..." : "🔄 تحديث سعر GRAM الفوري"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#0a1120", padding: 12, borderRadius: 10, border: "1px solid #1e2d4a" }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>سعر 1 GRAM بالدولار الرسمي</div>
          <div style={{ color: "#94a3b8", fontWeight: "bold", fontFamily: "monospace", fontSize: 15 }} dir="ltr">
            1 GRAM = ${gramUsd.toFixed(4)} USD
          </div>
        </div>

        <div style={{ background: "#0a1120", padding: 12, borderRadius: 10, border: "1px solid rgba(56,189,248,0.4)" }}>
          <div style={{ color: "#38bdf8", fontSize: 11, marginBottom: 4, fontWeight: "bold" }}>سعر 1 GRAM بالدولار مع (+0.01%)</div>
          <div style={{ color: "#38bdf8", fontWeight: "bold", fontFamily: "monospace", fontSize: 17 }} dir="ltr">
            1 GRAM = ${gramUsdWithFee.toFixed(4)} USD
          </div>
        </div>
      </div>

      <div style={{ background: "#091322", padding: 12, borderRadius: 12, border: "1px solid rgba(56,189,248,0.2)" }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: "bold", marginBottom: 8 }}>
          🧮 حاسبة كمية GRAM المطلوبة بـ ($USD):
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>أدخل المبلغ بالدولار ($USD):</label>
            <input
              type="number"
              step="0.01"
              value={customUsdInput}
              onChange={(e) => setCustomUsdInput(e.target.value)}
              style={{ width: "100%", height: 38, padding: "0 12px", background: "#111b2e", border: "1px solid #263b5f", borderRadius: 8, color: "#fff", fontFamily: "monospace", fontWeight: "bold", fontSize: 14 }}
              dir="ltr"
              placeholder="28.99"
            />
          </div>
          <div style={{ flex: 1, minWidth: 180, background: "rgba(56,189,248,0.1)", padding: 8, borderRadius: 8, border: "1px solid rgba(56,189,248,0.3)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#7dd3fc", marginBottom: 2 }}>المبلغ المطلوب بـ GRAM (شاملاً +0.01%):</div>
            <div style={{ color: "#38bdf8", fontWeight: "bold", fontFamily: "monospace", fontSize: 18 }} dir="ltr">
              ≈ {gramRequired} GRAM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div style={{ maxWidth: 720 }}>
      <TonPriceTrackerCard usdRate={usdRate} />

      <Card title="⚡ أسعار وباقات الألعاب والخدمات اليدوية">
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            background: "rgba(56,189,248,0.08)",
            border: "1px solid rgba(56,189,248,0.18)",
            color: "#7dd3fc",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>سعر الصرف الحالي: <strong>1 USD = {usdRate || "—"} EGP</strong></span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={promptCategoryExport}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(245,158,11,0.2)",
                border: "1px solid rgba(245,158,11,0.4)",
                color: "#fbbf24",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📋 استخراج أسعار خدمة كاملة (اختر من القائمة)
            </button>
            <button
              type="button"
              onClick={addGameCategory}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(16,185,129,0.2)",
                border: "1px solid rgba(16,185,129,0.4)",
                color: "#34d399",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + إضافة لعبة / قسم جديد 🕹️
            </button>
            <button
              type="button"
              onClick={() => addManualPackage("أخرى", "اشتراك جديد (مثل ChatGPT)")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(168,85,247,0.2)",
                border: "1px solid rgba(168,85,247,0.4)",
                color: "#c084fc",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + إضافة اشتراك / خدمة (أخرى) 📦
            </button>
            <button
              type="button"
              onClick={() => addManualPackage()}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(56,189,248,0.2)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#38bdf8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + إضافة باقة جديدة ⚡
            </button>
          </div>
        </div>

        {/* Categories Grouped Rendering */}
        {(() => {
          const grouped: Record<string, { service: any; index: number }[]> = {};
          svcs.forEach((s, idx) => {
            const catName = (s.category || "أخرى").trim();
            if (!grouped[catName]) grouped[catName] = [];
            grouped[catName].push({ service: s, index: idx });
          });

          return Object.entries(grouped).map(([catName, items]) => {
            const isCatDisabled = items.every(({ service: s }) => s.disabled);
            return (
              <div key={catName} style={{ marginBottom: 24 }}>
                {/* Category Header Banner with Service Price Export and Toggle */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #09172c 0%, #0d2242 100%)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    padding: "10px 16px",
                    borderRadius: 12,
                    marginBottom: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    📌 خدمة: <span style={{ color: "#fff" }}>{catName}</span> ({items.length} باقة)
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const n = [...svcs];
                        const targetDisabledState = !isCatDisabled;
                        items.forEach(({ index }) => {
                          n[index].disabled = targetDisabledState;
                        });
                        setSvcs(n);
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 10,
                        background: isCatDisabled ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                        border: isCatDisabled ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(239,68,68,0.4)",
                        color: isCatDisabled ? "#34d399" : "#f87171",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isCatDisabled ? "🟢 تفعيل القسم بالكامل" : "⏸️ تعطيل القسم مؤقتاً"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportItemsList(`خدمة ${catName}`, items.map((i) => i.service))}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #059669, #10b981)",
                        color: "#fff",
                        border: "1px solid #059669",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(16,185,129,0.2)",
                      }}
                    >
                      📋 استخراج أسعار خدمة {catName} بالكامل
                    </button>
                  </div>
                </div>

                {/* Items in Category */}
                {items.map(({ service: s, index: i }) => {
                  const linkedCoins = s.id === "tiktok_hidden_w" ? 13_000 : s.id === "tiktok_hidden_m" ? 26_000 : 0;
                  const automaticEgp = linkedCoins > 0 && tiers.length > 0
                    ? calculateTikTokPriceEgp(linkedCoins, tiers, usdRate)
                    : 0;

                  const isAutoLocked = linkedCoins > 0 && tiers.length > 0;

                  const displayEgp = isAutoLocked
                    ? automaticEgp
                    : calculateManualServicePriceEgp(s, usdRate);
                  const displayUsd = isAutoLocked ? (usdRate > 0 ? (automaticEgp / usdRate).toFixed(2) : "0") : (s.priceUsd || "0");
                  const displaySar = isAutoLocked ? (usdRate > 0 ? ((automaticEgp / usdRate) * 3.75).toFixed(2) : "0") : (Number(s.priceUsd) > 0 ? (Number(s.priceUsd) * 3.75).toFixed(2) : "0");

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        marginBottom: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                        background: s.disabled ? "#1a0f14" : "#0c1424",
                        border: s.disabled
                          ? "1px solid rgba(239,68,68,0.4)"
                          : isAutoLocked
                            ? "1px solid rgba(56,189,248,0.3)"
                            : "1px solid #1e2d4a",
                        padding: 12,
                        borderRadius: 12,
                        opacity: s.disabled ? 0.75 : 1,
                      }}
                    >
                      <div style={{ flex: 1.5, minWidth: 160 }}>
                        {s.id === "tiktok_hidden_w" || s.id === "tiktok_hidden_m" || s.id === "tiktok_superfan" ? (
                          <>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 2 }}>
                              {s.name} {s.disabled && <span style={{ color: "#f87171", fontSize: 11 }}>(معطلة مؤقتاً ⏸️)</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>
                              {s.category || "خدمات تيك توك"}
                            </div>
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={s.name || ""}
                              onChange={(e) => {
                                const n = [...svcs];
                                n[i].name = e.target.value;
                                setSvcs(n);
                              }}
                              style={{ ...inp, width: "100%", fontWeight: 700, fontSize: 13, marginBottom: 4 }}
                              placeholder="اسم الباقة (مثال: 60 شدة)"
                            />
                            <input
                              type="text"
                              value={s.category || ""}
                              onChange={(e) => {
                                const n = [...svcs];
                                n[i].category = e.target.value;
                                setSvcs(n);
                              }}
                              style={{ ...inp, width: "100%", fontSize: 11, color: "#888" }}
                              placeholder="اسم اللعبة / القسم (مثال: PUBG MOBILE)"
                            />
                          </>
                        )}
                        {isAutoLocked && (
                          <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, marginTop: 4 }}>
                            🔒 تسعير تلقائي من نظام العملات (غير قابل للتعديل اليدوي)
                          </div>
                        )}
                        {s.disabled && !isAutoLocked && (
                          <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, marginTop: 4 }}>
                            ⏸️ هذه الباقة معطلة مؤقتاً ولن تظهر للعملاء في الصفحة الرئيسية
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ color: "#aaa", fontSize: 11, marginBottom: 4 }}>
                          السعر بالدولار ($)
                        </div>
                        {isAutoLocked ? (
                          <div
                            style={{
                              ...inp,
                              width: "100%",
                              color: "#38bdf8",
                              fontWeight: 700,
                              background: "rgba(56,189,248,0.08)",
                              cursor: "not-allowed",
                            }}
                          >
                            ${displayUsd}
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={s.priceUsd ?? ""}
                            onChange={(e) => {
                              const n = [...svcs];
                              const newPriceUsd = e.target.value;
                              n[i].priceUsd = newPriceUsd;
                              n[i].price_usd = newPriceUsd;
                              if (usdRate > 0 && Number(newPriceUsd) > 0) {
                                n[i].price = (Math.round(Number(newPriceUsd) * usdRate * 100) / 100).toFixed(2);
                              }
                              setSvcs(n);
                            }}
                            style={{ ...inp, width: "100%", color: "#38bdf8", fontWeight: 700 }}
                            placeholder="السعر $"
                          />
                        )}
                      </div>

                      {Number(displayUsd) > 10 && (
                        <div style={{ flex: 0.6, minWidth: 80 }}>
                          <div style={{ color: "#fb7185", fontSize: 11, marginBottom: 4 }}>
                            الخصم % (فوق $10 فقط)
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={s.discountPercent ?? ""}
                            onChange={(e) => {
                              const n = [...svcs];
                              n[i].discountPercent = e.target.value;
                              setSvcs(n);
                            }}
                            style={{ ...inp, width: "100%", color: "#fb7185", fontWeight: 700 }}
                            placeholder="0%"
                          />
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>
                          التحويل التلقائي (جنيه / ريال)
                        </div>
                        <div
                          style={{
                            ...inp,
                            fontSize: 11,
                            color: "#34d399",
                            background: "rgba(52,211,153,0.06)",
                            cursor: "default",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{displayEgp} ج.م</span>
                          <span style={{ color: "#fbbf24" }}>{displaySar} ر.س</span>
                        </div>
                      </div>

                      <div style={{ flex: 0.8, minWidth: 95 }}>
                        <div style={{ color: "#aaa", fontSize: 11, marginBottom: 4 }}>
                          الحد الأدنى (Min)
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={s.min ?? s.min_quantity ?? 1}
                          onChange={(e) => {
                            const n = [...svcs];
                            const v = e.target.value;
                            n[i].min = v;
                            n[i].min_quantity = Number(v);
                            setSvcs(n);
                          }}
                          style={{ ...inp, width: "100%", color: "#f8fafc", fontWeight: 700 }}
                          placeholder="الأدنى"
                        />
                      </div>

                      <div style={{ flex: 0.8, minWidth: 95 }}>
                        <div style={{ color: "#aaa", fontSize: 11, marginBottom: 4 }}>
                          الحد الأقصى (Max)
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={s.max ?? s.max_quantity ?? 1}
                          onChange={(e) => {
                            const n = [...svcs];
                            const v = e.target.value;
                            n[i].max = v;
                            n[i].max_quantity = Number(v);
                            setSvcs(n);
                          }}
                          style={{ ...inp, width: "100%", color: "#f8fafc", fontWeight: 700 }}
                          placeholder="الأقصى"
                        />
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const n = [...svcs];
                            n[i].disabled = !n[i].disabled;
                            setSvcs(n);
                          }}
                          style={{
                            background: s.disabled ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.15)",
                            border: s.disabled ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.3)",
                            color: s.disabled ? "#f87171" : "#34d399",
                            borderRadius: 8,
                            padding: "0 10px",
                            height: 34,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title={s.disabled ? "انقر لتفعيل هذه الباقة" : "انقر لتعطيل هذه الباقة مؤقتاً"}
                        >
                          {s.disabled ? "⏸️ معطلة" : "🟢 نشطة"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeManualPackage(i)}
                          style={{
                            background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            color: "#f87171",
                            borderRadius: 8,
                            width: 34,
                            height: 34,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                          title="حذف الباقة"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}

        <FloatingAddButton onClick={() => addManualPackage()} label="إضافة باقة جديدة ➕" />
        <FloatingSaveBar onClick={save} busy={busy} label="حفظ الخدمات اليدوية والباقات" msg={msg} />
      </Card>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-950/90 border border-cyan-500/25 p-6 md:p-8 rounded-3xl mb-7 shadow-2xl backdrop-blur-2xl overflow-hidden transition-all hover:border-cyan-500/40">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
        <h3 className="text-cyan-400 m-0 text-lg md:text-xl font-extrabold flex items-center gap-2.5">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function FloatingAddButton({
  onClick,
  label = "إضافة جديدة ➕",
}: {
  onClick: () => void;
  label?: string;
}) {
  return null;
}

export function FloatingSaveBar({
  onClick,
  busy,
  label = "حفظ جميع الإعدادات 💾",
  msg = "",
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
  msg?: string;
}) {
  useEffect(() => {
    if (!msg) return;
    if (msg.includes("❌")) {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  }, [msg]);

  return (
    <div className="sticky top-2 z-[999] my-4 w-full rounded-2xl border border-amber-500/30 bg-[#0a0f1d]/95 p-3.5 px-6 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2.5 text-white font-bold text-sm">
        <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
        <span>هل انتهيت من التعديلات؟ لا تنس الحفظ</span>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="h-14 px-8 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-base md:text-lg shadow-xl shadow-amber-500/30 hover:brightness-110 hover:scale-[1.03] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 border border-amber-300/60 cursor-pointer disabled:opacity-50"
      >
        <Save size={22} className={busy ? "animate-spin" : ""} />
        <span>{busy ? "جاري الحفظ..." : label}</span>
      </button>
    </div>
  );
}

function StatusMsg({ msg }: { msg: string }) {
  const isSuccess = msg.includes("✅");
  return (
    <div className={`mt-4 p-3 rounded-xl text-center font-bold text-sm border ${isSuccess ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
      {msg}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid rgba(245, 158, 11, 0.25)",
  background: "#060a12",
  color: "#ffffff",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
  width: "100%",
  transition: "all 0.2s",
};
const lbl: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "rgba(255, 255, 255, 0.75)",
  fontSize: 14,
  fontWeight: 700,
};
const saveBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px 28px",
  borderRadius: 16,
  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
  color: "#000000",
  border: "1px solid rgba(254, 240, 138, 0.4)",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 4,
  boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.35)",
  transition: "all 0.2s ease-in-out",
};
const addBtn: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 16,
  background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
  color: "#000000",
  border: "1px solid rgba(254, 240, 138, 0.3)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 8px 20px -4px rgba(245, 158, 11, 0.35)",
  transition: "all 0.2s ease-in-out",
};
const delBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 14,
  background: "rgba(239, 68, 68, 0.12)",
  color: "#f87171",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  transition: "all 0.2s",
};
const btnSm: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 14,
  background: "#0a0f1d",
  color: "#ffffff",
  border: "1px solid rgba(245, 158, 11, 0.3)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 8,
  transition: "all 0.2s",
};
const actionBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 14,
  background: "rgba(56, 189, 248, 0.12)",
  color: "#38bdf8",
  border: "1px solid rgba(56, 189, 248, 0.3)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

export function VerificationCountdown({ item }: { item: any }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const calculateSeconds = () => {
      let deadlineMillis = 0;
      if (item.verificationDeadline) {
        deadlineMillis = new Date(item.verificationDeadline).getTime();
      } else if (item.verificationStartedAt) {
        const started =
          typeof item.verificationStartedAt === "object" && item.verificationStartedAt?._seconds
            ? item.verificationStartedAt._seconds * 1000
            : new Date(item.verificationStartedAt).getTime();
        deadlineMillis = started + 5 * 60 * 1000;
      }
      if (!deadlineMillis || isNaN(deadlineMillis)) return null;
      return Math.max(0, Math.ceil((deadlineMillis - Date.now()) / 1000));
    };

    setSecondsLeft(calculateSeconds());
    const timer = setInterval(() => {
      setSecondsLeft(calculateSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, [item.verificationDeadline, item.verificationStartedAt]);

  if (secondsLeft === null) return null;

  const isVerifying = item.status === "matching" || item.paymentStatus === "verifying";
  if (!isVerifying && secondsLeft <= 0) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (secondsLeft > 0 && isVerifying) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 mt-1.5 whitespace-nowrap animate-pulse">
        <Clock size={11} className="animate-spin text-amber-400" />
        <span>عداد التحقق: {formatted}</span>
      </div>
    );
  }

  if (secondsLeft === 0 && isVerifying) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/30 mt-1.5 whitespace-nowrap">
        <AlertCircle size={11} />
        <span>انتهى العداد (مراجعة مطلوبة)</span>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════
// SMS Manual Review Tab
// ═══════════════════════════════════════════════
export function SmsReviewTab() {
  const [smsList, setSmsList] = useState<any[]>([]);
  const [pendingRecharges, setPendingRecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState("");
  // For the link modal
  const [selectedSms, setSelectedSms] = useState<any | null>(null);
  const [selectedRechargeId, setSelectedRechargeId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/sms-review", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "تعذر تحميل البيانات");
      setSmsList(Array.isArray(data.smsList) ? data.smsList : []);
      setPendingRecharges(Array.isArray(data.pendingRecharges) ? data.pendingRecharges : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleIgnore = async (smsId: string) => {
    const { isConfirmed } = await Swal.fire({
      title: "تجاهل الرسالة",
      text: "هل تريد تجاهل هذه الرسالة؟ لن يتم ربطها بأي طلب شحن.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، تجاهل",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#888",
    });
    if (!isConfirmed) return;
    setProcessingId(smsId);
    try {
      const res = await fetch("/api/admin/sms-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsId, action: "ignore" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.error || "تعذر تجاهل الرسالة");
      setSmsList((prev) => prev.filter((s) => s.id !== smsId));
      toast.success("تم التجاهل 💾");
    } catch (err) {
      await Swal.fire({ icon: "error", title: "خطأ", text: err instanceof Error ? err.message : "حدث خطأ", background: "#111", color: "#fff" });
    } finally {
      setProcessingId("");
    }
  };

  const handleLinkAndApprove = async () => {
    if (!selectedSms || !selectedRechargeId) {
      await Swal.fire({ icon: "warning", title: "يرجى اختيار طلب شحن", background: "#111", color: "#fff" });
      return;
    }
    const { isConfirmed } = await Swal.fire({
      title: "تأكيد الربط والموافقة",
      text: "هل تريد ربط هذه الرسالة بطلب الشحن المختار وإضافة الرصيد للمستخدم؟",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "نعم، وافق وأضف الرصيد",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#38bdf8",
    });
    if (!isConfirmed) return;
    setProcessingId(selectedSms.id);
    try {
      const res = await fetch("/api/admin/sms-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsId: selectedSms.id, rechargeId: selectedRechargeId, action: "link_and_approve" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.error || "تعذر تنفيذ الإجراء");
      setSmsList((prev) => prev.filter((s) => s.id !== selectedSms.id));
      setPendingRecharges((prev) => prev.filter((r) => r.id !== selectedRechargeId));
      setSelectedSms(null);
      setSelectedRechargeId("");
      toast.success("تم إضافة الرصيد بنجاح ✅");
    } catch (err) {
      await Swal.fire({ icon: "error", title: "خطأ في التنفيذ", text: err instanceof Error ? err.message : "حدث خطأ", background: "#111", color: "#fff" });
    } finally {
      setProcessingId("");
    }
  };

  const getSmsStatusBadge = (status: string) => {
    switch (status) {
      case "manual_review": return <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-xs font-bold">مراجعة يدوية</span>;
      case "pending": return <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold">قيد الانتظار</span>;
      default: return <span className="bg-card border border-border text-foreground px-2 py-0.5 rounded text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header Banner */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
        <AlertCircle size={22} className="text-orange-400 mt-0.5 shrink-0" />
        <div>
          <div className="font-bold text-orange-400 text-sm mb-1">رسائل SMS فشل تطابقها التلقائي</div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            هذه الرسائل وردت من بوابة SMS لكن النظام لم يستطع مطابقتها تلقائياً مع طلب شحن.
            يمكنك ربطها يدوياً بطلب الشحن المناسب وإضافة الرصيد، أو تجاهلها إن كانت غير صالحة.
          </div>
        </div>
        <button onClick={loadData} className="mr-auto shrink-0 bg-white/5 hover:bg-white/10 border border-border px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5">
          <RefreshCw size={13} /> تحديث
        </button>
      </div>

      <Card title={`📩 رسائل SMS تحتاج مراجعة (${smsList.length})`}>
        {loading ? (
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        ) : loadError ? (
          <p className="text-red-400 text-sm">{loadError}</p>
        ) : smsList.length === 0 ? (
          <div className="flex items-center gap-3 py-6 text-emerald-400">
            <CheckCircle size={20} />
            <span className="font-semibold">لا توجد رسائل تحتاج مراجعة يدوية — كل شيء على ما يرام ✅</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {smsList.map((sms) => (
              <div
                key={sms.id}
                className={`rounded-xl border p-4 transition-all ${
                  selectedSms?.id === sms.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/50 bg-background/50 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getSmsStatusBadge(sms.processingStatus)}
                      <span className="text-xs text-muted-foreground font-mono">
                        {sms.createdAt ? new Date(sms.createdAt).toLocaleString("en-US") : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">المرسل:</span>
                      <span className="font-mono text-sm text-foreground">{sms.sender}</span>
                      {sms.classification && sms.classification !== "unknown" && (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">{sms.classification}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/80 bg-muted/20 px-3 py-2 rounded-lg font-mono leading-relaxed max-w-xl break-words">
                      {sms.originalMessage}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      {sms.extractedAmountPiasters && (
                        <span className="text-emerald-400 font-bold">
                          💰 {ceilTo2Decimals(sms.extractedAmountPiasters / 100)} ج.م
                        </span>
                      )}
                      {sms.extractedPhone && (
                        <span className="text-blue-400">📞 {sms.extractedPhone}</span>
                      )}
                      {sms.extractedSenderName && (
                        <span className="text-purple-400">👤 {sms.extractedSenderName}</span>
                      )}
                      {sms.failureReason && (
                        <span className="text-destructive/80">⚠️ {sms.failureReason}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedSms(selectedSms?.id === sms.id ? null : sms);
                        setSelectedRechargeId("");
                      }}
                      disabled={processingId === sms.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
                        selectedSms?.id === sms.id
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-white/5 hover:bg-white/10 text-foreground border-border"
                      }`}
                    >
                      {selectedSms?.id === sms.id ? "إلغاء الاختيار" : "ربط بطلب شحن"}
                    </button>
                    <button
                      onClick={() => handleIgnore(sms.id)}
                      disabled={processingId === sms.id}
                      className="bg-muted/30 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border hover:border-destructive/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {processingId === sms.id ? "جاري..." : "تجاهل"}
                    </button>
                  </div>
                </div>

                {/* Recharge linking panel - shown when this SMS is selected */}
                {selectedSms?.id === sms.id && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="text-sm font-bold text-foreground mb-3">اختر طلب الشحن المناسب للربط:</div>
                    {pendingRecharges.length === 0 ? (
                      <p className="text-muted-foreground text-xs">لا توجد طلبات شحن قيد الانتظار حالياً.</p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                        {pendingRecharges.map((r) => {
                          const amountEgp = sms.extractedAmountPiasters
                            ? (sms.extractedAmountPiasters / 100).toFixed(2)
                            : null;
                          const rechargeAmount = Number(r.amount || 0);
                          const amountMatch = amountEgp && Math.abs(parseFloat(amountEgp) - rechargeAmount) < 1;
                          return (
                            <label
                              key={r.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedRechargeId === r.id
                                  ? "border-primary/50 bg-primary/10"
                                  : amountMatch
                                  ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                                  : "border-border/50 bg-muted/10 hover:bg-muted/20"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`recharge_${sms.id}`}
                                value={r.id}
                                checked={selectedRechargeId === r.id}
                                onChange={() => setSelectedRechargeId(r.id)}
                                className="accent-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-primary font-bold text-sm">{r.amount} {r.currency || "EGP"}</span>
                                  {amountMatch && (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">✓ تطابق المبلغ</span>
                                  )}
                                  <span className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">{r.method}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {r.userEmail || r.userId} — {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US") : ""}
                                </div>
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                #{String(r.id).slice(0, 6)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleLinkAndApprove}
                        disabled={!selectedRechargeId || processingId === sms.id}
                        className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {processingId === sms.id ? "جاري التنفيذ..." : "✓ ربط وإضافة الرصيد يدوياً"}
                      </button>
                      <button
                        onClick={() => { setSelectedSms(null); setSelectedRechargeId(""); }}
                        className="bg-muted/20 hover:bg-muted/40 text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-bold transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function RechargesTab() {
  const [recharges, setRecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [reviewingId, setReviewingId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    fetch("/api/admin/recharges", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result?.error?.message || result?.error || "تعذر تحميل طلبات الشحن");
        }
        if (active) {
          setRecharges(Array.isArray(result.recharges) ? result.recharges : []);
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "تعذر تحميل طلبات الشحن",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    
    // Fetch Gateway Status
    fetch("/api/admin/payment/gateway-status", { credentials: "include", cache: "no-store" })
      .then(res => res.json())
      .then(data => {
         if (data.success) setGatewayStatus(data.gateway);
      }).catch(console.error);

    return () => {
      active = false;
    };
  }, []);

  const approve = async (req: any) => {
    const { value: confirmedAmount, isConfirmed } = await Swal.fire({
      title: "تأكيد وموافقة الإيداع",
      html: `
        <div class="text-right text-sm space-y-2 mb-4" dir="rtl">
          <div><strong class="text-primary">المستخدم:</strong> ${req.userEmail || req.userId}</div>
          <div><strong class="text-primary">وسيلة الدفع:</strong> ${req.method}</div>
          <div><strong class="text-primary">المبلغ المطلوب:</strong> ${req.amount} ${req.currency || "EGP"}</div>
          ${req.receiptUrl ? `<div class="mt-2"><a href="${req.receiptUrl}" target="_blank" class="text-cyan-400 underline font-bold">📄 فتح صوره الإيصال المرفقة</a></div>` : ""}
        </div>
      `,
      input: "number",
      inputLabel: "أدخل المبلغ الفعلي المعتمد بالجنيه المصري (EGP):",
      inputValue: String(req.amount || 80),
      showCancelButton: true,
      confirmButtonText: "نعم، اعتمد وأضف الرصيد",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#38bdf8",
      inputValidator: (val) => {
        if (!val || Number(val) <= 0) {
          return "يرجى كتابة مبلغ صحيح أكبر من 0";
        }
      },
    });
    if (!isConfirmed || !confirmedAmount) return;
    setReviewingId(req.id);
    try {
      const response = await fetch("/api/admin/sms-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rechargeId: req.id,
          action: "approve_direct",
          confirmedAmountEgp: Number(confirmedAmount),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "تعذر قبول الإيداع");
      }
      setRecharges((current) => current.map((item) =>
        item.id === req.id ? { ...item, status: "approved", paymentStatus: "verified" } : item
      ));
      toast.success("تمت إضافة الرصيد بنجاح ✅");
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "تعذر قبول الإيداع",
        text: error instanceof Error ? error.message : "حدث خطأ",
        background: "#111",
        color: "#fff",
      });
    } finally {
      setReviewingId("");
    }
  };

  const reject = async (id: string) => {
    const { isConfirmed } = await Swal.fire({
      title: "تأكيد رفض الإيداع",
      text: "هل أنت متأكد من رفض هذا الطلب؟ لن يتم إضافة أي رصيد للمستخدم.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، ارفض الطلب",
      cancelButtonText: "إلغاء",
      background: "#111",
      color: "#fff",
      confirmButtonColor: "#ff4444",
    });
    if (!isConfirmed) return;
    setReviewingId(id);
    try {
      const response = await fetch("/api/admin/sms-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rechargeId: id, action: "reject_direct" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "تعذر رفض الإيداع");
      }
      setRecharges((current) => current.map((item) =>
        item.id === id ? { ...item, status: "rejected", paymentStatus: "rejected" } : item
      ));
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "تعذر رفض الإيداع",
        text: error instanceof Error ? error.message : "حدث خطأ",
        background: "#111",
        color: "#fff",
      });
    } finally {
      setReviewingId("");
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
       case "verified": return <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">تأكيد آلي (SMS)</span>;
       case "approved": return <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">تأكيد يدوي</span>;
       case "awaiting_payment": return <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">في انتظار التحويل</span>;
       case "matching": return <span className="bg-orange-500/10 text-orange-500 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">جاري المطابقة</span>;
       case "manual_review": return <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">مراجعة إدارية مطلوبة</span>;
       case "expired": return <span className="bg-muted-foreground/10 text-muted-foreground px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">منتهي الصلاحية</span>;
       case "pending": return <span className="bg-orange-500/10 text-orange-500 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">مراجعة النظام القديم</span>;
       case "rejected": return <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">مرفوض</span>;
       default: return <span className="bg-card border border-border text-foreground px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">{status}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {gatewayStatus && (
        <Card title="📱 حالة بوابة الـ SMS (Heartbeat)">
           <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#111", borderRadius: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: gatewayStatus.status === "online" ? "#00ff80" : gatewayStatus.status === "delayed" ? "orange" : "#ff4444" }} />
              <strong style={{ color: gatewayStatus.status === "online" ? "#00ff80" : gatewayStatus.status === "delayed" ? "orange" : "#ff4444" }}>
                 {gatewayStatus.status === "online" ? "متصل (Online)" : gatewayStatus.status === "delayed" ? "متأخر (Delayed)" : "غير متصل (Offline)"}
              </strong>
              <span style={{ color: "#888", fontSize: 13 }}>
                 (آخر نبضة: {gatewayStatus.lastHeartbeatAt ? new Date(gatewayStatus.lastHeartbeatAt).toLocaleString("ar-EG") : "لا يوجد"})
                 {gatewayStatus.secondsSinceLastHeartbeat >= 0 ? ` - منذ ${gatewayStatus.secondsSinceLastHeartbeat} ثانية` : ""}
              </span>
           </div>
        </Card>
      )}

      <Card title="💰 طلبات الشحن">
        {loading ? (
          <p>جاري التحميل...</p>
        ) : loadError ? (
          <p className="text-red-400">{loadError}</p>
        ) : recharges.length === 0 ? (
          <p>لا توجد طلبات شحن.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/5">
                  <th className="p-4 text-right text-muted-foreground font-semibold">التاريخ</th>
                  <th className="p-4 text-right text-muted-foreground font-semibold">المستخدم</th>
                  <th className="p-4 text-right text-muted-foreground font-semibold">المبلغ المتوقع</th>
                  <th className="p-4 text-right text-muted-foreground font-semibold">طريقة الدفع</th>
                  <th className="p-4 text-right text-muted-foreground font-semibold">الرقم / الاسم (المرجع)</th>
                  <th className="p-4 text-right text-muted-foreground font-semibold">الحالة</th>
                  <th className="p-4 text-right text-muted-foreground font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-white/5 transition-colors">
                    <td className="p-4 whitespace-nowrap text-muted-foreground/80">
                      {r.createdAt
                        ? new Date(
                          typeof r.createdAt === "object" && r.createdAt._seconds
                            ? r.createdAt._seconds * 1000
                            : r.createdAt,
                        ).toLocaleString("en-US")
                        : "—"}
                    </td>
                    <td className="p-4 whitespace-nowrap text-foreground">{r.userEmail || r.userId}</td>
                    <td className="p-4 whitespace-nowrap">
                      <strong className="text-primary font-mono text-base">{r.amount}</strong><br/>
                      <span className="text-xs text-muted-foreground/70">{r.expectedAmountPiasters ? `${r.expectedAmountPiasters} قرش` : ""}</span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="bg-background border border-border px-2 py-1 rounded-md text-xs font-medium">{r.method}</span>
                    </td>
                    <td className="p-4">
                       <div className="font-mono text-foreground text-sm">{r.originalName || r.originalPhone || r.reference}</div>
                       {r.receiptUrl && !r.receipt_deleted_at && r.receipt_status !== "deleted" && (
                         <div className="mt-1.5 flex flex-col gap-1">
                           <a
                             href={r.receiptUrl}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/20 transition-all no-underline w-fit"
                           >
                             🧾 صوره الإيصال
                           </a>
                           {r.receipt_delete_at && (
                             <span className="text-[10px] text-amber-400 font-semibold">
                               ⏳ حذف تلقائي بعد 15د من القرار
                             </span>
                           )}
                         </div>
                       )}
                       {(r.receipt_deleted_at || r.receipt_status === "deleted" || (!r.receiptUrl && (r.receipt_delete_at || r.approved_at || r.rejected_at))) && (
                         <div className="mt-1.5 text-xs text-muted-foreground/80 bg-muted/20 px-2.5 py-1 rounded-lg border border-border/40 w-fit">
                           <span>🗑️ تم حذف صورة الإيصال تلقائياً من R2</span>
                         </div>
                       )}
                       {(r.payerPhoneNormalized || r.payerNameNormalized) && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                             <CheckCircle size={12} className="text-emerald-500" /> المطابقة: {r.payerPhoneNormalized || r.payerNameNormalized}
                          </div>
                       )}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(r.status)}
                      <VerificationCountdown item={r} />
                    </td>
                    <td className="p-4">
                      {(r.status === "pending" || r.status === "manual_review" || r.status === "awaiting_payment" || r.status === "matching" || r.status === "expired") && (
                        <div className="flex gap-2">
                          <button disabled={reviewingId === r.id} onClick={() => approve(r)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                            {reviewingId === r.id ? "جاري..." : "موافقة"}
                          </button>
                          <button disabled={reviewingId === r.id} onClick={() => reject(r.id)} className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                            رفض
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
