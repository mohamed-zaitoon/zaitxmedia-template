"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
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

export default function GlobalDiscountBanner() {
  const [config, setConfig] = useState<{
    enabled: boolean;
    discountPercent: number;
    maxDiscountUsd?: number;
    expiresAt?: string | null;
  } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          enabled: Boolean(data?.global_usd_discount_enabled ?? data?.globalUsdDiscountEnabled),
          discountPercent: Number(data?.global_usd_discount_percent ?? data?.globalUsdDiscountPercent ?? 0),
          maxDiscountUsd: data?.global_usd_discount_max_amount ? Number(data.global_usd_discount_max_amount) : undefined,
          expiresAt: data?.global_usd_discount_expires_at ?? data?.globalUsdDiscountExpiresAt ?? null,
        });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!config?.expiresAt) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [config?.expiresAt]);

  if (!config || !isGlobalUsdDiscountActive(config)) {
    return null;
  }

  const percent = config.discountPercent;
  const maxCap = config.maxDiscountUsd;
  const durationText = calculateExactRemainingTimeText(config.expiresAt);
  const textMessage = `🔥 خصم ${percent}% متاح لمدة ${durationText}!`;
  const capNote = maxCap && maxCap > 0
    ? ` (بحد أقصى ${maxCap}$ خصم - على جميع الخدمات التي بقيمة 10$ او اكثر)`
    : ` (على جميع الخدمات التي بقيمة 10$ او اكثر)`;
  const bannerText = `${textMessage}${capNote}`;

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/90 via-slate-950 to-amber-950/90 border-b border-amber-500/40 text-amber-300 text-[11px] md:text-xs font-bold py-2.5 overflow-hidden relative shadow-md z-40 dir-ltr select-none">
      <div className="flex whitespace-nowrap animate-marquee-smooth">
        {/* Track Group 1 */}
        <div className="flex items-center shrink-0">
          <span className="mx-6 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {bannerText}
          </span>
          <span className="mx-6 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {bannerText}
          </span>
        </div>
        {/* Track Group 2 (Exact Duplicate for 100% gapless loop) */}
        <div className="flex items-center shrink-0">
          <span className="mx-6 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {bannerText}
          </span>
          <span className="mx-6 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {bannerText}
          </span>
        </div>
      </div>
    </div>
  );
}
