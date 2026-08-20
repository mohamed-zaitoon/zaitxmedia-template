"use client";

import React from "react";

interface PaymentLogoProps {
  type: string;
  size?: number;
  className?: string;
}

// 1. Official Vodafone Cash Logo Icon
export function VodafoneLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#E60000] shadow-md shadow-red-600/30 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Vodafone Cash"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-1.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 12C32.327 12 18 26.327 18 44C18 57.886 26.85 69.704 39.262 74.204C37.142 70.82 36 66.862 36 62.6C36 49.345 46.745 38.6 60 38.6C65.044 38.6 69.7 40.16 73.542 42.828C69.04 24.966 52.88 12 50 12Z"
          fill="white"
        />
        <path
          d="M60 46C50.888 46 43.5 53.388 43.5 62.5C43.5 71.612 50.888 79 60 79C69.112 79 76.5 71.612 76.5 62.5C76.5 53.388 69.112 46 60 46ZM60 70C55.858 70 52.5 66.642 52.5 62.5C52.5 58.358 55.858 55 60 55C64.142 55 67.5 58.358 67.5 62.5C67.5 66.642 64.142 70 60 70Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

// 2. Official InstaPay (IPN) Logo Icon
export function InstaPayLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#381076] via-[#2a0b5a] to-[#1a053c] border border-violet-500/40 shadow-md shadow-purple-900/40 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="InstaPay IPN"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* InstaPay IPN Lightning / Check Pattern */}
        <circle cx="50" cy="50" r="44" fill="url(#instapay-bg)" />
        <path
          d="M32 28L68 28L46 54L64 54L30 80L38 58L22 58L32 28Z"
          fill="url(#instapay-lightning)"
        />
        <path
          d="M62 34L76 48L62 62"
          stroke="#00D2C2"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="instapay-bg" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="#4A148C" />
            <stop offset="100%" stopColor="#28065B" />
          </linearGradient>
          <linearGradient id="instapay-lightning" x1="20" y1="20" x2="70" y2="80">
            <stop offset="0%" stopColor="#FF6B00" />
            <stop offset="50%" stopColor="#FFAE00" />
            <stop offset="100%" stopColor="#00D2C2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// 3. Official Binance Pay Logo Icon
export function BinancePayLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#F0B90B] shadow-md shadow-amber-500/30 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Binance Pay"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full p-1.5"
        fill="#181A20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2L8.5 5.5L12 9L15.5 5.5L12 2ZM5.5 8.5L2 12L5.5 15.5L9 12L5.5 8.5ZM18.5 8.5L15 12L18.5 15.5L22 12L18.5 8.5ZM12 15L8.5 18.5L12 22L15.5 18.5L12 15ZM12 10.5L9.5 13L12 15.5L14.5 13L12 10.5Z" />
      </svg>
    </div>
  );
}

// 4. Official Barq (برق) Logo Icon
export function BarqLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#059669] via-[#047857] to-[#064e3b] border border-emerald-400/40 shadow-md shadow-emerald-900/40 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Barq"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-1.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="42" fill="#047857" stroke="#34D399" strokeWidth="4" />
        {/* Flash Bolt Barq Icon */}
        <path
          d="M54 18L26 52H48L42 82L74 48H52L54 18Z"
          fill="url(#barq-flash)"
        />
        <defs>
          <linearGradient id="barq-flash" x1="26" y1="18" x2="74" y2="82">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#A7F3D0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// 5. Official Bank Transfer Logo Icon
export function BankLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#0891b2] via-[#0e7490] to-[#155e75] border border-cyan-400/40 shadow-md shadow-cyan-900/40 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Bank Transfer"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full p-1.5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
      </svg>
    </div>
  );
}

// Universal Payment Method Logo Renderer
export default function PaymentMethodLogo({ type, size = 28, className = "" }: PaymentLogoProps) {
  const normalized = (type || "").toLowerCase().trim();
  if (normalized === "vodafone" || normalized.includes("vodafone")) {
    return <VodafoneLogo size={size} className={className} />;
  }
  if (normalized === "instapay" || normalized.includes("instapay")) {
    return <InstaPayLogo size={size} className={className} />;
  }
  if (normalized === "binance_pay" || normalized === "binance" || normalized.includes("binance")) {
    return <BinancePayLogo size={size} className={className} />;
  }
  if (normalized === "barq" || normalized.includes("barq")) {
    return <BarqLogo size={size} className={className} />;
  }
  if (normalized === "bank" || normalized.includes("bank")) {
    return <BankLogo size={size} className={className} />;
  }

  // Fallback for custom or unknown methods
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      💳
    </div>
  );
}
