"use client";

import React from "react";
import { SiTiktok, SiFacebook, SiInstagram } from "react-icons/si";
import { Gamepad2, Sparkles, Boxes, Bot } from "lucide-react";
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
      <Bot size={size * 0.65} className="text-white" />
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
