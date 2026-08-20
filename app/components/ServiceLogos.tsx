"use client";

import React from "react";
import { SiTiktok, SiFacebook, SiInstagram } from "react-icons/si";
import { Gamepad2, Sparkles, Boxes } from "lucide-react";
import { TikTokCoinsLogo } from "./PaymentLogos";

// 1. Official TikTok Logo with Cyan/Magenta Shadow Effect
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
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#10a37f] shadow-md shadow-emerald-600/30 p-1 ${className}`}
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

// 5. Official PUBG / Gaming Logo
export function PubgOfficialLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] shadow-md shadow-amber-600/30 p-1 ${className}`}
      style={{ width: size, height: size }}
      title="شحن الألعاب / ببجي"
    >
      <Gamepad2 size={size * 0.65} className="text-slate-950 font-bold" />
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
  if (k.includes("pubg") || k.includes("game") || k.includes("لعبة") || k.includes("ألعاب") || k.includes("العاب")) {
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
