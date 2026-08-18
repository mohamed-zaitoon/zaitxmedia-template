import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { calculateTikTokPriceEgp, calculateTikTokOriginalPriceEgp } from "@/lib/pricing/tiktok";
import { calculateManualServicePriceEgp, calculateManualServiceOriginalPriceEgp } from "@/lib/pricing/manual-service";

import { isGlobalUsdDiscountActive } from "@/lib/pricing/pricing-discount";

export async function GET() {
  try {
    const [pricingSnap, manualServicesSnap, tiersSnap, catalogServicesSnap] = await Promise.all([
      adminDb.collection("settings").doc("pricing").get(),
      adminDb.collection("settings").doc("manual_services").get(),
      adminDb.collection("tiers").get(),
      adminDb.collection("services").get(),
    ]);

    const pricingData = pricingSnap.data() || {};
    const usdRate = Number(pricingData.usd_rate || pricingData.tiktok_usd_rate || 50);
    const globalDiscountExpiresAt = pricingData.global_usd_discount_expires_at ?? pricingData.globalUsdDiscountExpiresAt ?? null;
    const globalDiscountConfig = {
      enabled: Boolean(pricingData.global_usd_discount_enabled ?? pricingData.globalUsdDiscountEnabled),
      discountPercent: Number(pricingData.global_usd_discount_percent ?? pricingData.globalUsdDiscountPercent ?? 0),
      maxDiscountUsd: Number(pricingData.global_usd_discount_max_amount ?? pricingData.globalUsdDiscountMaxAmount ?? 0),
      expiresAt: globalDiscountExpiresAt,
    };

    const isDiscountActive = isGlobalUsdDiscountActive(globalDiscountConfig);
    const globalDiscountEnabled = isDiscountActive;
    const globalDiscountPercent = isDiscountActive ? globalDiscountConfig.discountPercent : 0;

    const expireTime = globalDiscountExpiresAt ? new Date(globalDiscountExpiresAt).getTime() : null;
    const remainingSeconds = (expireTime && Number.isFinite(expireTime))
      ? Math.max(0, Math.floor((expireTime - Date.now()) / 1000))
      : null;

    const tiers = tiersSnap.docs.map((d) => d.data()) as any[];
    const manualSvcsMap: Record<string, any> = {};
    if (manualServicesSnap.exists && Array.isArray(manualServicesSnap.data()?.services)) {
      manualServicesSnap.data()!.services.forEach((s: any) => {
        if (s?.id) manualSvcsMap[s.id] = s;
      });
    }

    const servicesList: any[] = [];

    // Helper to format dual pricing output for export
    const createServiceEntry = (
      id: string,
      name: string,
      category: string,
      description: string,
      min: number,
      max: number,
      origPriceEgp: number,
      finPriceEgp: number,
      unitType = "per_1000",
    ) => {
      const originalPriceUsd = origPriceEgp / usdRate;
      const finalPriceUsd = finPriceEgp / usdRate;
      const discountAmountUsd = Math.max(0, originalPriceUsd - finalPriceUsd);
      const discountPercentage = (globalDiscountEnabled && globalDiscountPercent > 0 && originalPriceUsd > 0)
        ? Math.round(((originalPriceUsd - finalPriceUsd) / originalPriceUsd) * 100)
        : 0;

      return {
        id,
        name,
        category,
        description,
        min,
        max,
        unit_type: unitType,
        // Backward-compatible fields
        rate: String(finalPriceUsd.toFixed(4)),
        price: finPriceEgp,
        price_egp: finPriceEgp,
        // Dual pricing export fields
        original_price: Number(originalPriceUsd.toFixed(4)),
        discount_percentage: discountPercentage,
        discount_amount: Number(discountAmountUsd.toFixed(4)),
        final_price: Number(finalPriceUsd.toFixed(4)),
        original_price_egp: origPriceEgp,
        final_price_egp: finPriceEgp,
        currency: "USD",
      };
    };

    // 1. TikTok Coins Service
    const coinsOrigEgp = calculateTikTokOriginalPriceEgp(1000, tiers, usdRate);
    const coinsFinEgp = calculateTikTokPriceEgp(1000, tiers, usdRate, globalDiscountConfig);
    servicesList.push(
      createServiceEntry(
        "tiktok_coins",
        "شحن عملات تيك توك (لكل 1000 عملة)",
        "تيك توك",
        "شحن عملات تيك توك بحاسبة مرنة وأسعار تنافسية",
        Number(pricingData.tiktok_min_coins || 100),
        Number(pricingData.tiktok_max_coins || 2500000),
        coinsOrigEgp,
        coinsFinEgp,
        "per_1000_coins",
      ),
    );

    // 2. Built-in Special Services
    const builtInServices = [
      {
        id: "tiktok_promo",
        name: "ترويج تيك توك",
        category: "ترويج",
        desc: "زيادة مشاهدات ولايكات ومتابعين",
        min: manualSvcsMap["tiktok_promo"]?.min || 10,
        max: manualSvcsMap["tiktok_promo"]?.max || 50000,
        fallbackEgp: 0.5,
      },
      {
        id: "instagram_promo",
        name: "ترويج انستجرام",
        category: "ترويج",
        desc: "زيادة متابعين ولايكات ومشاهدات",
        min: manualSvcsMap["instagram_promo"]?.min || 10,
        max: manualSvcsMap["instagram_promo"]?.max || 50000,
        fallbackEgp: 0.5,
      },
      {
        id: "facebook_promo",
        name: "ترويج فيسبوك",
        category: "ترويج",
        desc: "زيادة متابعين ولايكات ومشاهدات",
        min: manualSvcsMap["facebook_promo"]?.min || 10,
        max: manualSvcsMap["facebook_promo"]?.max || 50000,
        fallbackEgp: 0.5,
      },
      {
        id: "tiktok_superfan",
        name: "اشتراك سوبر فان - شهري",
        category: "اشتراكات",
        desc: "سوبر فان لمدة شهر",
        min: 1,
        max: 1,
        fallbackEgp: 150,
      },
      {
        id: "tiktok_hidden_w",
        name: "اشتراك مخفي - اسبوعي",
        category: "اشتراكات",
        desc: "تفعيل المخفي لمدة اسبوع",
        min: 1,
        max: 1,
        fallbackEgp: 30,
        linkedCoins: 13000,
      },
      {
        id: "tiktok_hidden_m",
        name: "اشتراك مخفي - شهري",
        category: "اشتراكات",
        desc: "تفعيل المخفي لمدة شهر",
        min: 1,
        max: 1,
        fallbackEgp: 100,
        linkedCoins: 26000,
      },
    ];

    for (const s of builtInServices) {
      let origEgp = 0;
      let finEgp = 0;

      if (s.linkedCoins && s.linkedCoins > 0 && tiers.length > 0) {
        origEgp = calculateTikTokOriginalPriceEgp(s.linkedCoins, tiers, usdRate);
        finEgp = calculateTikTokPriceEgp(s.linkedCoins, tiers, usdRate, globalDiscountConfig);
      } else {
        const manualService = manualSvcsMap[s.id];
        if (manualService) {
          origEgp = calculateManualServiceOriginalPriceEgp(manualService, usdRate);
          finEgp = calculateManualServicePriceEgp(manualService, usdRate, globalDiscountConfig);
        } else {
          origEgp = s.fallbackEgp;
          finEgp = globalDiscountEnabled ? Math.ceil((s.fallbackEgp * (1 - globalDiscountPercent / 100)) * 100) / 100 : s.fallbackEgp;
        }
      }

      servicesList.push(
        createServiceEntry(
          s.id,
          s.name,
          s.category,
          s.desc,
          s.min,
          s.max,
          origEgp,
          finEgp,
          s.linkedCoins ? "package" : "per_unit",
        ),
      );
    }

    // 3. Custom Manual Services from settings/manual_services
    Object.values(manualSvcsMap).forEach((service: any) => {
      if (builtInServices.some((b) => b.id === service.id)) return;
      const origEgp = calculateManualServiceOriginalPriceEgp(service, usdRate);
      const finEgp = calculateManualServicePriceEgp(service, usdRate, globalDiscountConfig);
      servicesList.push(
        createServiceEntry(
          service.id || service.service,
          service.name,
          service.category || "عام",
          service.description || service.desc || "",
          Number(service.min || 1),
          Number(service.max || 50000),
          origEgp,
          finEgp,
          "package",
        ),
      );
    });

    // 4. Catalog / SMM Services from services collection
    if (!catalogServicesSnap.empty) {
      catalogServicesSnap.docs.forEach((docSnap) => {
        const s = docSnap.data();
        if (s.is_manual || manualSvcsMap[docSnap.id]) return;

        const S = parseFloat(s.rate || "0");
        if (!S || S <= 0) return;

        const baseUSD = S;
        const origEgp = Math.ceil((S * (usdRate + 4) * 1.005) * 100) / 100;
        const effectiveS = globalDiscountEnabled ? S * (1 - globalDiscountPercent / 100) : S;
        const finEgp = Math.ceil((effectiveS * (usdRate + 4) * 1.005) * 100) / 100;

        servicesList.push(
          createServiceEntry(
            docSnap.id,
            s.name || docSnap.id,
            s.category || "خدمات المظلة",
            s.description || "",
            Number(s.min || 10),
            Number(s.max || 50000),
            origEgp,
            finEgp,
            "per_1000",
          ),
        );
      });
    }

    return NextResponse.json({
      success: true,
      usd_rate: usdRate,
      global_discount: {
        enabled: globalDiscountEnabled,
        discount_percent: globalDiscountPercent,
        expires_at: globalDiscountExpiresAt,
        remaining_seconds: remainingSeconds,
      },
      total_services: servicesList.length,
      services: servicesList,
    });
  } catch (error) {
    console.error("Failed to export services API:", error);
    return NextResponse.json({ success: false, error: "تعذر تصدير قائمة الأسعار" }, { status: 500 });
  }
}
