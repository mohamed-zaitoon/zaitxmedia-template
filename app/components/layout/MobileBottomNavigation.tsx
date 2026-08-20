"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Boxes } from "lucide-react";
import { useDevicePlatform } from "@/app/lib/useDevicePlatform";
import { TikTokOfficialLogo, FacebookOfficialLogo, InstagramOfficialLogo, PubgOfficialLogo } from "../ServiceLogos";

const menu = [
  {
    id: "home",
    label: "الرئيسية",
    icon: <Home size={19} className="text-sky-400" />,
    color: "#38bdf8",
    href: "/",
  },
  {
    id: "tiktok",
    label: "تيك توك",
    icon: <TikTokOfficialLogo size={22} />,
    color: "#ff0050",
  },
  {
    id: "games",
    label: "ألعاب",
    icon: <PubgOfficialLogo size={22} />,
    color: "#f39c12",
  },
  {
    id: "facebook",
    label: "فيسبوك",
    icon: <FacebookOfficialLogo size={22} />,
    color: "#1877f2",
  },
  {
    id: "instagram",
    label: "إنستجرام",
    icon: <InstagramOfficialLogo size={22} />,
    color: "#e1306c",
  },
  {
    id: "other",
    label: "أخرى",
    icon: <Boxes size={19} className="text-emerald-400" />,
    color: "#10b981",
  },
];

export default function MobileBottomNavigation() {
  const pathname = usePathname();
  const { isAndroid, isIOS } = useDevicePlatform();

  if (isAndroid) {
    // 🤖 Material Design 3 (Android) Bottom Navigation Bar
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around bg-[#121824] px-2 shadow-[0_-4px_24px_rgba(0,0,0,0.4)] border-t border-white/5 md:hidden">
        {menu.map((item) => {
          const isActive =
            (item.id === "home" && pathname === "/") ||
            pathname.includes(`/${item.id}`);
          return (
            <Link
              key={item.id}
              href={item.href || `/${item.id}`}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 no-underline"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all duration-300 ${
                  isActive
                    ? "bg-sky-400/20 text-sky-400 scale-105"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                <span style={{ color: isActive ? item.color : "inherit" }}>
                  {item.icon}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold tracking-wide transition-colors ${
                  isActive ? "text-sky-300" : "text-slate-400"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  if (isIOS) {
    // 🍎 Apple Cupertino (iOS) Translucent SF Tab Bar
    return (
      <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-[448px] -translate-x-1/2 items-center justify-between rounded-[26px] border border-white/15 bg-slate-950/75 p-1.5 shadow-2xl shadow-black/80 backdrop-blur-3xl md:hidden">
        {menu.map((item) => {
          const isActive =
            (item.id === "home" && pathname === "/") ||
            pathname.includes(`/${item.id}`);
          return (
            <Link
              key={item.id}
              href={item.href || `/${item.id}`}
              className={`flex flex-col items-center justify-center flex-1 h-[54px] rounded-2xl transition-all duration-300 gap-1 relative ${
                isActive ? "bg-white/10 shadow-sm" : "hover:bg-white/5"
              }`}
            >
              <span
                className={`transition-transform duration-300 ${
                  isActive ? "scale-110" : "opacity-75"
                }`}
                style={{ color: isActive ? item.color : "#94a3b8" }}
              >
                {item.icon}
              </span>
              <span
                className="text-[10px] font-semibold tracking-tight"
                style={{ color: isActive ? item.color : "#94a3b8" }}
              >
                {item.label}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-1 w-1 h-1 rounded-full animate-pulse"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  // 💻 Desktop Default Navigation Bar
  return (
    <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-[448px] -translate-x-1/2 items-center justify-between rounded-2xl border border-white/10 bg-[#0b1220]/90 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl md:hidden">
      {menu.map((item) => {
        const isActive =
          (item.id === "home" && pathname === "/") ||
          pathname.includes(`/${item.id}`);
        return (
          <Link
            key={item.id}
            href={item.href || `/${item.id}`}
            className={`flex flex-col items-center justify-center flex-1 h-[54px] rounded-xl transition-all gap-1 relative ${
              isActive ? "bg-primary/10 shadow-inner" : "hover:bg-white/5"
            }`}
            title={item.label}
          >
            <span
              className={`transition-transform flex items-center justify-center h-4 w-4 shrink-0 ${
                isActive ? "scale-110" : ""
              }`}
              style={{
                color: isActive ? item.color : "var(--muted-foreground)",
              }}
            >
              {item.icon}
            </span>
            <span
              className="text-[10px] font-medium leading-none whitespace-nowrap mt-1"
              style={{
                color: isActive ? item.color : "var(--muted-foreground)",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
