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
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-[#181A20] border border-[#f3ba2f]/40 shadow-md shadow-amber-500/20 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Binance Pay"
    >
      <svg
        viewBox="0 0 126.61 126.61"
        className="w-full h-full p-1.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="#f3ba2f">
          <path d="m38.73 53.2 24.59-24.58 24.6 24.6 14.3-14.31-38.9-38.91-38.9 38.9z" />
          <path d="m0 63.31 14.3-14.31 14.31 14.31-14.31 14.3z" />
          <path d="m38.73 73.41 24.59 24.59 24.6-24.6 14.31 14.29-38.9 38.91-38.91-38.88z" />
          <path d="m98 63.31 14.3-14.31 14.31 14.3-14.31 14.32z" />
          <path d="m77.83 63.3-14.51-14.52-10.73 10.73-1.24 1.23-2.54 2.54 14.51 14.5 14.51-14.47z" />
        </g>
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

// 5. Official Bank Transfer Logo Icon (Streamline Kameleon Duo-tone)
export function BankLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-cyan-500/30 shadow-md shadow-cyan-900/30 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Bank Transfer"
    >
      <svg
        viewBox="0 0 48 48"
        className="w-full h-full p-1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path fill="#e0f2fe" d="M23.9979 47.9997c13.2548 0 23.9999 -10.745 23.9999 -23.9998C47.9978 10.7451 37.2527 0 23.9979 0S-0.00195312 10.7451 -0.00195312 23.9999 10.7431 47.9997 23.9979 47.9997Z" strokeWidth="1" />
        <path fill="#0284c7" d="M37.9613 20.5087v1.7455H10.0342v-1.7455l13.9635 -8.7272 13.9636 8.7272Z" strokeWidth="1" />
        <path fill="#0284c7" d="M11.7803 36.2179v-1.7455h24.4362v1.7455H11.7803Z" strokeWidth="1" />
        <path fill="#38bdf8" d="M18.3255 22.2544h-4.3636v12.2181h4.3636V22.2544Z" strokeWidth="1" />
        <path fill="#38bdf8" d="M26.18 22.2544h-4.3636v12.2181H26.18V22.2544Z" strokeWidth="1" />
        <path fill="#38bdf8" d="M34.0345 22.2544h-4.3636v12.2181h4.3636V22.2544Z" strokeWidth="1" />
        <path fill="#0284c7" d="M37.9613 36.2178H10.0342v1.7454h27.9271v-1.7454Z" strokeWidth="1" />
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
