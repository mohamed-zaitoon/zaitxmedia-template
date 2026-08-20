"use client";

import React from "react";
import { SiTiktok, SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";
import { Sparkles } from "lucide-react";
import { TikTokCoinsLogo } from "./PaymentLogos";

// 1. Official TikTok Logo
export function TikTokOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-slate-950 border border-pink-500/30 p-1 shadow-md shadow-pink-500/20 ${className}`}
      style={{ width: size, height: size }}
      title="تيك توك (TikTok)"
    >
      <SiTiktok size={size * 0.65} className="text-[#00f2fe] drop-shadow-[2px_2px_0px_#ff0050]" />
    </div>
  );
}

// 2. Official Facebook Logo
export function FacebookOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#1877F2] shadow-md shadow-blue-600/30 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="فيسبوك (Facebook)"
    >
      <SiFacebook size={size * 0.65} className="text-white" />
    </div>
  );
}

// 3. Official Instagram Logo
export function InstagramOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-tr from-[#fccc63] via-[#f77737] to-[#833ab4] shadow-md shadow-fuchsia-600/30 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="إنستجرام (Instagram)"
    >
      <SiInstagram size={size * 0.65} className="text-white" />
    </div>
  );
}

// 4. Official ChatGPT / OpenAI Logo
export function ChatGptOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#10a37f] border border-emerald-400/30 shadow-md shadow-emerald-600/30 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="شات جي بي تي (ChatGPT)"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full p-0.5 object-contain"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path fill="#ffffff" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.535-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9503a4.4992 4.4992 0 0 1-6.1408-1.6465zm-1.3589-10.437c.3644-1.0035 1.0555-1.8413 1.964-2.3712l.1419.0804 4.7783 2.7582a.7948.7948 0 0 0 .7854 0l5.838-3.3685-2.02-1.1686a.0757.0757 0 0 1-.038-.052V2.6288a4.504 4.504 0 0 1 7.3705 3.4536v10.871a4.4755 4.4755 0 0 1-2.8764 1.0408l-.1419.0804-4.7783 2.7582a.7948.7948 0 0 1-.3927.6813v6.7369l-2.02-1.1686a.071.071 0 0 1-.038-.052v-5.5826a4.504 4.504 0 0 1 4.4945-4.4944z" />
      </svg>
    </div>
  );
}

// 5. Official Telegram Logo
export function TelegramOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#229ED9] shadow-md shadow-cyan-600/30 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="تليجرام (Telegram)"
    >
      <SiTelegram size={size * 0.65} className="text-white" />
    </div>
  );
}

// 6. Official JACO Live Logo
export function JacoOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#4c1d95] border border-purple-400/30 shadow-md shadow-purple-900/40 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="جاكو (JACO Live)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-0.5 object-contain" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 12L85 32V68L50 88L15 68V32L50 12Z" fill="url(#jaco-grad)" stroke="#a855f7" strokeWidth="3" />
        <path d="M56 30C56 30 56 55 45 65C38 71 28 66 28 60C28 54 34 52 38 55C42 58 40 62 44 60C47 58 48 48 48 40H60V30H56Z" fill="#FFFFFF" />
        <circle cx="62" cy="24" r="5" fill="#facc15" />
        <defs>
          <linearGradient id="jaco-grad" x1="15" y1="12" x2="85" y2="88">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#5b21b6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// 7. Official PUBG Mobile Logo
export function PubgOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#18181b] via-[#27272a] to-[#09090b] border border-amber-500/40 shadow-md shadow-amber-500/20 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="ببجي موبايل (PUBG Mobile)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1 object-contain" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 50C20 30 32 15 50 15C68 15 80 30 80 50V68C80 72 76 76 72 76H28C24 76 20 72 20 68V50Z" fill="#f59e0b" />
        <path d="M28 42H72V54C72 56 70 58 68 58H32C30 58 28 56 28 54V42Z" fill="#09090b" />
        <line x1="36" y1="42" x2="36" y2="58" stroke="#f59e0b" strokeWidth="2" />
        <line x1="50" y1="42" x2="50" y2="58" stroke="#f59e0b" strokeWidth="2" />
        <line x1="64" y1="42" x2="64" y2="58" stroke="#f59e0b" strokeWidth="2" />
        <path d="M35 76L50 86L65 76" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 8. Official Free Fire Logo
export function FreeFireOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#ea580c] via-[#c2410c] to-[#7c2d12] border border-orange-400/40 shadow-md shadow-orange-900/40 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="فري فاير (Free Fire)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1 object-contain" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 10C50 10 32 30 32 52C32 68 40 78 50 88C60 78 68 68 68 52C68 30 50 10 50 10Z" fill="url(#ff-flame)" />
        <path d="M50 32C50 32 40 45 40 58C40 68 45 74 50 80C55 74 60 68 60 58C60 45 50 32 50 32Z" fill="#facc15" />
        <path d="M36 44H64M40 54H58M44 64H54" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
        <defs>
          <linearGradient id="ff-flame" x1="50" y1="10" x2="50" y2="88">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// 9. Official Yalla Ludo Logo
export function YallaLudoOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#dc2626] via-[#b91c1c] to-[#7f1d1d] border border-red-400/40 shadow-md shadow-red-900/40 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="يلا لودو (Yalla Ludo)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1 object-contain" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="20" width="60" height="60" rx="16" fill="#ffffff" stroke="#facc15" strokeWidth="4" />
        <circle cx="34" cy="34" r="5" fill="#dc2626" />
        <circle cx="66" cy="34" r="5" fill="#16a34a" />
        <circle cx="50" cy="50" r="6" fill="#f59e0b" />
        <circle cx="34" cy="66" r="5" fill="#2563eb" />
        <circle cx="66" cy="66" r="5" fill="#dc2626" />
      </svg>
    </div>
  );
}

// Universal Service Logo Dispatcher
export function ServiceBrandLogo({ serviceKey, size = 24, className = "" }: { serviceKey: string; size?: number; className?: string }) {
  const k = (serviceKey || "").toLowerCase().trim();

  if (k.includes("coin") || k.includes("عملات") || k.includes("شحن العملات")) {
    return <TikTokCoinsLogo size={size} className={className} />;
  }
  if (k.includes("tik") || k.includes("تيك")) {
    return <TikTokOfficialLogo size={size} className={className} />;
  }
  if (k.includes("facebook") || k.includes("فيسبوك") || k.includes("فيس")) {
    return <FacebookOfficialLogo size={size} className={className} />;
  }
  if (k.includes("instagram") || k.includes("انستجرام") || k.includes("انستا")) {
    return <InstagramOfficialLogo size={size} className={className} />;
  }
  if (k.includes("gpt") || k.includes("openai") || k.includes("جي بي تي") || k.includes("شات")) {
    return <ChatGptOfficialLogo size={size} className={className} />;
  }
  if (k.includes("telegram") || k.includes("تليجرام") || k.includes("تليغرام")) {
    return <TelegramOfficialLogo size={size} className={className} />;
  }
  if (k.includes("jaco") || k.includes("جاكو")) {
    return <JacoOfficialLogo size={size} className={className} />;
  }
  if (k.includes("ludo") || k.includes("لودو") || k.includes("يلا لودو")) {
    return <YallaLudoOfficialLogo size={size} className={className} />;
  }
  if (k.includes("free fire") || k.includes("freefire") || k.includes("فري فاير") || k.includes("فراي فاير")) {
    return <FreeFireOfficialLogo size={size} className={className} />;
  }
  if (k.includes("pubg") || k.includes("ببجي") || k.includes("ببجى")) {
    return <PubgOfficialLogo size={size} className={className} />;
  }
  if (k.includes("game") || k.includes("لعبة") || k.includes("ألعاب") || k.includes("العاب")) {
    return <PubgOfficialLogo size={size} className={className} />;
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 ${className}`}
      style={{ width: size, height: size }}
    >
      <Sparkles size={size * 0.6} />
    </div>
  );
}
