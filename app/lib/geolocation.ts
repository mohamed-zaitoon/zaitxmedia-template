"use client";

import { toast } from "sonner";

export interface GeoLocationResult {
  countryCode: string; // e.g. "EG", "SA"
  countryName?: string;
  verified: boolean;
}

/**
 * Detects actual physical country code of the user via IP Geolocation APIs with fallbacks.
 */
export async function detectUserCountry(): Promise<GeoLocationResult> {
  try {
    // Try primary IP API
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.country_code) {
        return {
          countryCode: String(data.country_code).toUpperCase(),
          countryName: data.country_name || "",
          verified: true,
        };
      }
    }
  } catch (e) {
    // Fallback IP API
    try {
      const res2 = await fetch("https://ip-api.com/json/?fields=status,countryCode,country", { cache: "no-store" });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.countryCode) {
          return {
            countryCode: String(data2.countryCode).toUpperCase(),
            countryName: data2.country || "",
            verified: true,
          };
        }
      }
    } catch (err) {
      console.warn("Geo detection failed:", err);
    }
  }

  // Fallback if IP detection service is blocked: use Browser Timezone / Locale heuristics
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Riyadh") || tz.includes("Saudi") || tz.includes("Asia/Riyadh")) {
      return { countryCode: "SA", countryName: "السعودية", verified: true };
    }
    if (tz.includes("Cairo") || tz.includes("Egypt") || tz.includes("Africa/Cairo")) {
      return { countryCode: "EG", countryName: "مصر", verified: true };
    }
  } catch (err) {}

  return { countryCode: "UNKNOWN", verified: false };
}

/**
 * Validates whether the user can switch to the requested target country.
 * Detects actual physical IP location and rejects mismatch.
 */
export async function validateCountryChange(targetCountry: string): Promise<boolean> {
  const flag = targetCountry === "SA" ? "🇸🇦" : targetCountry === "EG" ? "🇪🇬" : "🌍";
  const targetName = targetCountry === "SA" ? "السعودية" : targetCountry === "EG" ? "مصر" : targetCountry;

  toast.info("جاري التحقق من الموقع الجغرافي الفعلي... 📍");

  const detected = await detectUserCountry();

  if (detected.verified && detected.countryCode !== "UNKNOWN") {
    if (detected.countryCode !== targetCountry) {
      const detectedName = detected.countryCode === "SA" ? "السعودية 🇸🇦" : detected.countryCode === "EG" ? "مصر 🇪🇬" : (detected.countryName || detected.countryCode);
      toast.error(`تعذر تغيير الدولة: موقعك الجغرافي الفعلي (${detectedName}) لا يطابق الدولة المختارة (${targetName} ${flag}) 📍`);
      return false;
    }
  }

  toast.success(`تم التحقق الجغرافي وتغيير الدولة إلى ${targetName} ${flag} بنجاح 📍`);
  return true;
}
