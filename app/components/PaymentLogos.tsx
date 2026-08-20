"use client";

import React from "react";

interface PaymentLogoProps {
  type: string;
  size?: number;
  className?: string;
}

// 1. Official Vodafone Cash / Electronic Wallet Logo Icon
export function VodafoneLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#dc2626] to-[#991b1b] border border-red-500/40 shadow-md shadow-red-900/40 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Vodafone Cash / المحافظ الإلكترونية"
    >
      <svg
        viewBox="0 0 640 640"
        className="w-full h-full p-1.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#ffffff"
          d="M128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 256C576 220.7 547.3 192 512 192L136 192C122.7 192 112 181.3 112 168C112 154.7 122.7 144 136 144L520 144C533.3 144 544 133.3 544 120C544 106.7 533.3 96 520 96L128 96zM480 320C497.7 320 512 334.3 512 352C512 369.7 497.7 384 480 384C462.3 384 448 369.7 448 352C448 334.3 462.3 320 480 320z"
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

// 5. Official Bank Transfer Logo Icon
export function BankLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0369a1] border border-cyan-400/40 shadow-md shadow-cyan-900/40 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="Bank Transfer / التحويل البنكي"
    >
      <svg
        viewBox="0 0 640 640"
        className="w-full h-full p-1.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#ffffff"
          d="M335.9 84.2C326.1 78.6 314 78.6 304.1 84.2L80.1 212.2C67.5 219.4 61.3 234.2 65 248.2C68.7 262.2 81.5 272 96 272L128 272L128 480L128 480L76.8 518.4C68.7 524.4 64 533.9 64 544C64 561.7 78.3 576 96 576L544 576C561.7 576 576 561.7 576 544C576 533.9 571.3 524.4 563.2 518.4L512 480L512 272L544 272C558.5 272 571.2 262.2 574.9 248.2C578.6 234.2 572.4 219.4 559.8 212.2L335.8 84.2zM464 272L464 480L400 480L400 272L464 272zM352 272L352 480L288 480L288 272L352 272zM240 272L240 480L176 480L176 272L240 272zM320 160C337.7 160 352 174.3 352 192C352 209.7 337.7 224 320 224C302.3 224 288 209.7 288 192C288 174.3 302.3 160 320 160z"
        />
      </svg>
    </div>
  );
}

// 6. Official TikTok Coins Logo Icon
export function TikTokCoinsLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#d8ac0c] via-[#b88c00] to-[#8a6800] border border-amber-400/40 shadow-md shadow-amber-900/40 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="TikTok Coins / عملات تيك توك"
    >
      <svg
        viewBox="0 0 640 640"
        className="w-full h-full p-1.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#ffffff"
          d="M192 160L192 144C192 99.8 278 64 384 64C490 64 576 99.8 576 144L576 160C576 190.6 534.7 217.2 474 230.7C471.6 227.9 469.1 225.2 466.6 222.7C451.1 207.4 431.1 195.8 410.2 187.2C368.3 169.7 313.7 160.1 256 160.1C234.1 160.1 212.7 161.5 192.2 164.2C192 162.9 192 161.5 192 160.1zM496 417L496 370.8C511.1 366.9 525.3 362.3 538.2 356.9C551.4 351.4 564.3 344.7 576 336.6L576 352C576 378.8 544.5 402.5 496 417zM496 321L496 288C496 283.5 495.6 279.2 495 275C510.5 271.1 525 266.4 538.2 260.8C551.4 255.2 564.3 248.6 576 240.5L576 255.9C576 282.7 544.5 306.4 496 320.9zM64 304L64 288C64 243.8 150 208 256 208C362 208 448 243.8 448 288L448 304C448 348.2 362 384 256 384C150 384 64 348.2 64 304zM448 400C448 444.2 362 480 256 480C150 480 64 444.2 64 400L64 384.6C75.6 392.7 88.5 399.3 101.8 404.9C143.7 422.4 198.3 432 256 432C313.7 432 368.3 422.3 410.2 404.9C423.4 399.4 436.3 392.7 448 384.6L448 400zM448 480.6L448 496C448 540.2 362 576 256 576C150 576 64 540.2 64 496L64 480.6C75.6 488.7 88.5 495.3 101.8 500.9C143.7 518.4 198.3 528 256 528C313.7 528 368.3 518.3 410.2 500.9C423.4 495.4 436.3 488.7 448 480.6z"
        />
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
  if (normalized === "tiktok" || normalized.includes("tiktok") || normalized.includes("coin")) {
    return <TikTokCoinsLogo size={size} className={className} />;
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
