"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Zap, User, LogOut, ArrowRight, Home, Gamepad2, Wallet, LogIn, ShoppingCart, Boxes, ChevronDown, Menu, Sparkles, X, Package } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/lib/auth-context";
import { useCurrency, Currency } from "@/app/lib/currency-context";
import { useCart } from "@/app/lib/cart-context";

function CurrencyDropdown({
  selectedCurrency,
  setSelectedCurrency,
  isSaudi,
}: {
  selectedCurrency: Currency;
  setSelectedCurrency: (c: Currency) => void;
  isSaudi: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { symbols } = useCurrency();

  const options: { value: Currency; label: string }[] = isSaudi
    ? [
        { value: "SAR", label: symbols.sar || "﷼" },
        { value: "USD", label: symbols.usd || "$" },
      ]
    : [
        { value: "EGP", label: symbols.egp || "£" },
        { value: "USD", label: symbols.usd || "$" },
      ];

  const current = options.find((o) => o.value === selectedCurrency) || options[0];

  return (
    <div className="relative inline-block w-20 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-9 px-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 flex items-center justify-between gap-1 text-xs font-black text-cyan-300 transition-all cursor-pointer shadow-sm active:scale-95"
        aria-label="اختر العملة"
      >
        <span className="truncate flex-1 text-center">{current.label}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 shrink-0 text-cyan-400 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[99990] bg-slate-950/20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 left-0 top-full mt-2 z-[99991] w-full min-w-full rounded-2xl border border-cyan-500/40 bg-slate-950/98 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setSelectedCurrency(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-2 py-2 rounded-xl text-center text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                  selectedCurrency === opt.value
                    ? "bg-gradient-to-r from-cyan-500/20 to-primary/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-black"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent"
                }`}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();
  const { selectedCurrency, setSelectedCurrency, rates, symbols } = useCurrency();
  const { cartCount, setIsCartOpen } = useCart();
  const [balanceUsd, setBalanceUsd] = useState(Number(user?.balance) || 0);

  const isSaudi = user?.country_code === "SA";

  useEffect(() => {
    if (isSaudi && selectedCurrency === "EGP") {
      setSelectedCurrency("SAR");
    } else if (!isSaudi && selectedCurrency === "SAR") {
      setSelectedCurrency("EGP");
    }
  }, [isSaudi, selectedCurrency, setSelectedCurrency]);

  useEffect(() => {
    setBalanceUsd(Number(user?.balance) || 0);
  }, [user?.balance]);

  const formatExactNum = (num: number) => {
    if (Number.isInteger(num)) return num.toString();
    return Number(num.toFixed(2)).toString().replace(/0+$/, '').replace(/\.$/, '');
  };

  const getDisplayedBalance = (): { num: string; label: string } => {
    const maxEgp = 1000000;
    const maxUsd = maxEgp / (rates.usd || 50);
    const cappedUsd = Math.min(balanceUsd, maxUsd);
    const floorUsd = Math.floor((cappedUsd + 1e-9) * 100) / 100;
    
    if (selectedCurrency === "USD") {
      return { num: floorUsd.toFixed(2), label: symbols.usd || "$" };
    }
    
    const priceEGP = Math.floor((floorUsd * (rates.usd || 50) + 1e-9) * 100) / 100;
    
    if (selectedCurrency === "SAR") {
      const priceSAR = Math.floor((priceEGP / (rates.sar || 13) + 1e-9) * 100) / 100;
      return { num: priceSAR.toFixed(2), label: symbols.sar || "﷼" };
    }

    return { num: priceEGP.toFixed(2), label: symbols.egp || "£" };
  };

  const displayedBalance = getDisplayedBalance();

  const showBackButton = pathname !== "/" && pathname !== "/admin";
  const desktopLinks = [
    { href: "/", label: "الرئيسية", icon: Home },
    { href: "/tiktok", label: "تيك توك", icon: Zap },
    { href: "/games", label: "شحن الألعاب", icon: Gamepad2 },
    { href: "/facebook", label: "فيسبوك", icon: Zap },
    { href: "/instagram", label: "إنستجرام", icon: Zap },
    { href: "/other", label: "أخرى", icon: Boxes },
  ];

  const [mobileBottomSheetOpen, setMobileBottomSheetOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-[#060a13]/85 shadow-[0_12px_35px_rgba(0,0,0,.22)] backdrop-blur-2xl">
      <div className="centered-app-frame flex h-[68px] min-w-0 items-center justify-between">
        
        {/* Right Side: Logo & Back Button */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {showBackButton && (
            <button 
              onClick={() => router.push("/")}
              className="bg-white/5 hover:bg-white/10 text-foreground inline-flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl transition-colors border border-transparent hover:border-white/10 shrink-0"
              aria-label="العودة للمتجر"
            >
              <ArrowRight className="shrink-0 w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
          )}
          <Link href="/" className="flex items-center gap-2 md:gap-3 no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/zaitx-logo.png"
              alt="ZAITX MEDIA"
              className="h-10 w-10 rounded-xl border border-amber-500/30 object-cover shadow-lg"
            />
            <div className="hidden sm:block">
              <h1 className="m-0 whitespace-nowrap text-lg font-black text-foreground md:text-xl">ZAITX MEDIA</h1>
              <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground">خدمات رقمية موثوقة</span>
            </div>
          </Link>
        </div>

        {/* Left Side: Actions */}
        <div className="flex items-center gap-1.5 md:gap-2.5 flex-shrink-0">

          <CurrencyDropdown
            selectedCurrency={selectedCurrency}
            setSelectedCurrency={setSelectedCurrency}
            isSaudi={isSaudi}
          />

          {user && (
            <div
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-black shadow-sm select-none"
              title="رصيد المحفظة الحالي"
              dir="rtl"
            >
              <Wallet size={14} className="hidden md:inline-block text-amber-400 shrink-0" />
              <span className="hidden md:inline">الرصيد المتوفر :</span>
              <span className="font-mono flex items-center gap-1" dir="rtl">
                <span>{displayedBalance.num}</span>
                <span>{displayedBalance.label}</span>
              </span>
            </div>
          )}

          {!user && (
            <Link
              href="/login"
              className="inline-flex h-9 md:h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-cyan-400 px-3 md:px-4 text-xs font-black text-black shadow-lg shadow-cyan-500/15 transition hover:-translate-y-0.5 shrink-0"
            >
              <LogIn size={16} /> تسجيل الدخول
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileBottomSheetOpen((prev) => !prev)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer shrink-0 active:scale-95 z-[99999999]"
            aria-label="القائمة"
          >
            {mobileBottomSheetOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Desktop Only Extra Action Buttons */}
          {user && (
            <Link
              href="/recharge"
              className="hidden md:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-colors hover:bg-amber-500/20"
              aria-label="شحن الرصيد"
              title="شحن الرصيد"
            >
              <Wallet size={17} />
            </Link>
          )}

          {user && user.role === "admin" && (
            <a
              href="https://admin.zaitxmedia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold h-9 px-3 rounded-xl items-center gap-1.5 border border-cyan-500/30 transition-all shrink-0 no-underline"
              title="لوحة الإدارة"
            >
              <span className="text-sm">⚙️</span>
              <span>الإدارة</span>
            </a>
          )}

          {user && (
            <button
              onClick={() => router.push("/account")}
              className="hidden md:inline-flex bg-white/5 hover:bg-white/10 text-foreground h-9 w-9 rounded-xl items-center justify-center border border-border/50 transition-all shrink-0 cursor-pointer"
              aria-label="حسابي"
            >
              <User className="shrink-0 w-4 h-4" />
            </button>
          )}

          {user && (
            <button
              onClick={async () => {
                await signOutUser();
                router.push("/login");
              }}
              className="hidden md:inline-flex bg-destructive/10 hover:bg-destructive/20 text-destructive h-9 w-9 rounded-xl border border-destructive/20 items-center justify-center transition-all shrink-0 cursor-pointer"
              aria-label="خروج"
            >
              <LogOut className="shrink-0 w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* Desktop Navigation */}
      <nav className="hidden border-t border-white/5 bg-black/10 md:block">
        <div className="site-container flex h-14 items-center justify-center gap-2">
          {desktopLinks.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold transition-all ${
                  active
                    ? "border-primary/30 bg-primary/15 text-primary shadow-sm shadow-primary/10"
                    : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Sheet Modal Menu rendered into body via Portal */}
      {mobileBottomSheetOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999999] md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/40 transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileBottomSheetOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="relative w-full max-h-[85vh] bg-slate-950/98 border-t border-cyan-500/40 rounded-t-3xl p-5 shadow-2xl overflow-y-auto space-y-4 z-10 animate-in slide-in-from-bottom duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Sheet Top Bar Header with Close Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <span className="text-xs font-black text-slate-300">القائمة والخدمات</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileBottomSheetOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700/50 shrink-0"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. FIRST BUTTON: Recharge Balance */}
            {user ? (
              <Link
                href="/recharge"
                onClick={() => setMobileBottomSheetOpen(false)}
                className="w-full min-h-[52px] px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 text-slate-950 font-extrabold text-sm flex items-center justify-between shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <Wallet size={20} className="fill-slate-950" />
                  <span>⚡ شحن الرصيد</span>
                </div>
                <ArrowRight size={16} className="rotate-180" />
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileBottomSheetOpen(false)}
                className="w-full min-h-[52px] px-5 rounded-2xl bg-gradient-to-r from-cyan-400 to-primary text-slate-950 font-extrabold text-sm flex items-center justify-between shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <LogIn size={20} />
                  <span>تسجيل الدخول / إنشاء حساب</span>
                </div>
                <ArrowRight size={16} className="rotate-180" />
              </Link>
            )}

            {/* 2. Main Navigation Links */}
            <div className="space-y-2 py-1">
              <span className="text-[11px] font-bold text-slate-400 px-2 block">الأقسام الرئيسية:</span>
              {[
                { href: "/", label: "الرئيسية", icon: Home },
                { href: "/tiktok", label: "تيك توك", icon: Zap },
                { href: "/games", label: "شحن الألعاب", icon: Gamepad2 },
                { href: "/facebook", label: "فيسبوك", icon: Zap },
                { href: "/instagram", label: "إنستجرام", icon: Zap },
                { href: "/other", label: "أخرى", icon: Boxes },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileBottomSheetOpen(false)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 text-slate-200 text-xs font-black flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-cyan-400" />
                      <span>{link.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* 3. Account Links */}
            {user && (
              <div className="space-y-2 py-1">
                <span className="text-[11px] font-bold text-slate-400 px-2 block">الحساب والطلبات:</span>
                <Link
                  href="/account"
                  onClick={() => setMobileBottomSheetOpen(false)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 text-slate-200 text-xs font-black flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-amber-400" />
                    <span>حسابي</span>
                  </div>
                </Link>
                <Link
                  href="/orders"
                  onClick={() => setMobileBottomSheetOpen(false)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 text-slate-200 text-xs font-black flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Package size={18} className="text-amber-400" />
                    <span>طلباتي</span>
                  </div>
                </Link>
                {user.role === "admin" && (
                  <a
                    href="https://admin.zaitxmedia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileBottomSheetOpen(false)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-black flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span>⚙️</span>
                      <span>لوحة الإدارة</span>
                    </div>
                  </a>
                )}
              </div>
            )}

            {/* 4. LAST BUTTON: Logout */}
            {user && (
              <button
                type="button"
                onClick={() => {
                  setMobileBottomSheetOpen(false);
                  signOutUser();
                }}
                className="w-full min-h-[50px] px-5 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-extrabold text-xs flex items-center justify-between transition-all cursor-pointer mt-3"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut size={18} />
                  <span>تسجيل الخروج</span>
                </div>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
