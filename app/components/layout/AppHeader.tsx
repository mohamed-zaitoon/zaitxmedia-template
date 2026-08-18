"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Zap, User, LogOut, ArrowRight, Home, Gamepad2, Wallet, LogIn, ShoppingCart, Boxes } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/lib/auth-context";
import { useCurrency, Currency } from "@/app/lib/currency-context";
import { useCart } from "@/app/lib/cart-context";



export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();
  const { selectedCurrency, setSelectedCurrency, rates } = useCurrency();
  const { cartCount, setIsCartOpen } = useCart();
  const [balanceUsd, setBalanceUsd] = useState(Number(user?.balance) || 0);
  const isSaudi = user?.country_code === "SA";

  useEffect(() => {
    if (!user) return;
    if (isSaudi && selectedCurrency === "EGP") setSelectedCurrency("SAR");
    if (!isSaudi && selectedCurrency === "SAR") setSelectedCurrency("EGP");
  }, [isSaudi, selectedCurrency, setSelectedCurrency, user]);

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
      return { num: floorUsd.toFixed(2), label: "$" };
    }
    
    const priceEGP = Math.floor((floorUsd * (rates.usd || 50) + 1e-9) * 100) / 100;
    
    if (selectedCurrency === "SAR") {
      const priceSAR = Math.floor((priceEGP / (rates.sar || 13) + 1e-9) * 100) / 100;
      return { num: priceSAR.toFixed(2), label: "ر.س" };
    }

    if (priceEGP >= 1000000) {
      return { num: formatExactNum(priceEGP / 1000000), label: "مليون ج" };
    } else if (priceEGP >= 100000) {
      return { num: formatExactNum(priceEGP / 1000), label: "ألف ج" };
    } else {
      return { num: priceEGP.toFixed(2), label: "ج" };
    }
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
        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">

          {!user && <label className="relative shrink-0" aria-label="اختيار عملة العرض">
            <select
              value={selectedCurrency}
              onChange={(event) => setSelectedCurrency(event.target.value as Currency)}
              className="h-9 min-w-[66px] cursor-pointer appearance-none rounded-xl border border-primary/25 bg-primary/10 px-2 text-center text-xs font-black text-primary outline-none"
              dir="ltr"
            >
              <option value="USD" className="bg-[#0c1322] text-white">USD $</option>
              {isSaudi ? (
                <option value="SAR" className="bg-[#0c1322] text-white">SAR ر.س</option>
              ) : (
                <option value="EGP" className="bg-[#0c1322] text-white">EGP ج</option>
              )}
            </select>
          </label>}

          {user && (
            <div className="inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 max-sm:h-8 shadow-sm">
              <Link
                href="/account"
                className="inline-flex min-w-[62px] items-center justify-center gap-1 px-2.5 text-[11px] font-black text-amber-400 max-sm:min-w-[50px] max-sm:px-1.5 max-sm:text-[10px]"
                title="رصيد المحفظة"
              >
                <span style={{ direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
                  {displayedBalance.num}
                </span>
                <span style={{ direction: "rtl", unicodeBidi: "isolate", display: "inline-block" }}>
                  {displayedBalance.label}
                </span>
              </Link>
              <label className="relative flex items-center border-r border-amber-500/20" aria-label="اختيار عملة عرض الرصيد">
                <select
                  value={selectedCurrency}
                  onChange={(event) => setSelectedCurrency(event.target.value as Currency)}
                  className="h-full w-[54px] cursor-pointer appearance-none bg-transparent px-1 text-center text-[10px] font-black text-amber-300 outline-none max-sm:w-[45px] max-sm:text-[9px]"
                  dir="ltr"
                >
                  <option value="USD" className="bg-[#0c1322] text-white">USD</option>
                  {isSaudi ? (
                    <option value="SAR" className="bg-[#0c1322] text-white">SAR</option>
                  ) : (
                    <option value="EGP" className="bg-[#0c1322] text-white">EGP</option>
                  )}
                </select>
              </label>
            </div>
          )}

          {!user && (
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-cyan-400 px-4 text-xs font-black text-black shadow-lg shadow-cyan-500/15 transition hover:-translate-y-0.5"
            >
              <LogIn size={16} /> تسجيل الدخول
            </Link>
          )}

          {user && (
            <Link
              href="/recharge"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-colors hover:bg-amber-500/20"
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
              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold h-9 px-2.5 md:px-3 rounded-xl inline-flex items-center gap-1.5 border border-cyan-500/30 transition-all shrink-0 no-underline"
              title="لوحة الإدارة"
            >
              <span className="text-sm">⚙️</span>
              <span className="hidden md:inline">الإدارة</span>
            </a>
          )}
          {user && (
            <button
              onClick={() => router.push("/account")}
              className="bg-white/5 hover:bg-white/10 text-foreground h-9 w-9 rounded-xl inline-flex items-center justify-center border border-border/50 transition-all shrink-0"
              aria-label="حسابي"
            >
              <User className="shrink-0 w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}

          {/* Logout Button */}
          {user && (
            <button
              onClick={async () => {
                await signOutUser();
                router.push("/login");
              }}
              className="bg-destructive/10 hover:bg-destructive/20 text-destructive h-9 w-9 rounded-xl border border-destructive/20 inline-flex items-center justify-center transition-all shrink-0"
              aria-label="خروج"
            >
              <LogOut className="shrink-0 w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}
        </div>

      </div>
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
    </header>
  );
}
