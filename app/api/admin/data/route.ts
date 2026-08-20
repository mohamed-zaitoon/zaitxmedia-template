import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import catalog from "@/public/services.json";
import { calculateTikTokPriceEgp, type TikTokPricingTier } from "@/lib/pricing/tiktok";
import { getManualServicePriceUsd } from "@/lib/pricing/manual-service";

const readableDocuments = new Set([
  "settings/pricing",
  "settings/site",
  "settings/manual_services",
  "settings/site_appearance",
  "settings/payment_gateways",
  "settings/category_icons",
]);

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const resource = new URL(request.url).searchParams.get("resource") || "";
    if (resource === "tiers") {
      const snapshot = await adminDb.collection("tiers").get();
      return NextResponse.json({
        success: true,
        items: snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })),
      });
    }
    if (resource === "calculator_services") {
      const snapshot = await adminDb.collection("services")
        .where("is_manual", "==", true)
        .get();
      return NextResponse.json({
        success: true,
        manualItems: snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })),
      });
    }
    if (!readableDocuments.has(resource)) {
      return NextResponse.json({ success: false, error: "Invalid resource" }, { status: 400 });
    }
    const [collection, id] = resource.split("/");
    const snapshot = await adminDb.collection(collection).doc(id).get();
    let data = snapshot.data() || null;

    if (resource === "settings/manual_services") {
      const gameDefaults = [
        { id: "pubg_60_uc", name: "60 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "1.11", price_usd: 1.11, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_325_uc", name: "300+25 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "5.59", price_usd: 5.59, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_660_uc", name: "600+60 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "11.19", price_usd: 11.19, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_1800_uc", name: "1500+300 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "27.99", price_usd: 27.99, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_3850_uc", name: "3000+850 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "52.99", price_usd: 52.99, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_8100_uc", name: "6000+2100 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "105.99", price_usd: 105.99, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_16200_uc", name: "12000+4200 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "211.98", price_usd: 211.98, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_24300_uc", name: "18000+6300 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "308.97", price_usd: 308.97, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_32400_uc", name: "24000+8400 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "411.96", price_usd: 411.96, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "pubg_40500_uc", name: "30000+10500 UC | PUBG MOBILE", category: "PUBG MOBILE", priceUsd: "453.19", price_usd: 453.19, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_25_diamonds", name: "25 ألماسة | Free Fire", category: "Free Fire", priceUsd: "0.31", price_usd: 0.31, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_50_diamonds", name: "50 ألماسة | Free Fire", category: "Free Fire", priceUsd: "0.59", price_usd: 0.59, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_100_diamonds", name: "100 ألماسة | Free Fire", category: "Free Fire", priceUsd: "1.06", price_usd: 1.06, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_300_diamonds", name: "300 ألماسة | Free Fire", category: "Free Fire", priceUsd: "3.28", price_usd: 3.28, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_520_diamonds", name: "520 ألماسة | Free Fire", category: "Free Fire", priceUsd: "4.88", price_usd: 4.88, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_1060_diamonds", name: "1060 ألماسة | Free Fire", category: "Free Fire", priceUsd: "9.54", price_usd: 9.54, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_1580_diamonds", name: "1580 ألماسة | Free Fire", category: "Free Fire", priceUsd: "14.42", price_usd: 14.42, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_2180_diamonds", name: "2180 ألماسة | Free Fire", category: "Free Fire", priceUsd: "19.30", price_usd: 19.30, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_3240_diamonds", name: "3240 ألماسة | Free Fire", category: "Free Fire", priceUsd: "28.02", price_usd: 28.02, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_5600_diamonds", name: "5600 ألماسة | Free Fire", category: "Free Fire", priceUsd: "46.35", price_usd: 46.35, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "ff_11500_diamonds", name: "11500 ألماسة | Free Fire", category: "Free Fire", priceUsd: "95.28", price_usd: 95.28, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_830_diamonds", name: "830 ألماسة | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "2.40", price_usd: 2.40, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_2320_diamonds", name: "2,320 ماس | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "6.00", price_usd: 6.00, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_5150_diamonds", name: "5,150 ألماسة | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "11.45", price_usd: 11.45, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_13580_diamonds", name: "13,580 ماس | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "28.62", price_usd: 28.62, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_27640_diamonds", name: "27,640 ماس | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "55.87", price_usd: 55.87, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_55800_diamonds", name: "55,800 ألماسة | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "111.73", price_usd: 111.73, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_68500_gold", name: "68,500 ذهب | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "2.40", price_usd: 2.40, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_223700_gold", name: "223,700 ذهب | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "6.00", price_usd: 6.00, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_1463320_gold", name: "1,463,320 ذهب | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "11.45", price_usd: 11.45, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_3666470_gold", name: "3,666,470 ذهب | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "28.62", price_usd: 28.62, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "yl_9973990_gold", name: "9,973,990 ذهب | Yalla Ludo - لودو وجاكارو", category: "Yalla Ludo - لودو وجاكارو", priceUsd: "55.87", price_usd: 55.87, min: "1", max: "1", desc: "شحن يدوي بواسطة الآي دي (Player ID)" },
        { id: "jaco_100_coins", name: "100 عملات | JACO - جاكو", category: "JACO - جاكو", priceUsd: "1.37", price_usd: 1.37, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_300_coins", name: "300 عملة | JACO - جاكو", category: "JACO - جاكو", priceUsd: "4.09", price_usd: 4.09, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_500_coins", name: "500 عملات | JACO - جاكو", category: "JACO - جاكو", priceUsd: "6.82", price_usd: 6.82, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_1000_coins", name: "1,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "13.62", price_usd: 13.62, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_2000_coins", name: "2,000 عملات | JACO - جاكو", category: "JACO - جاكو", priceUsd: "27.26", price_usd: 27.26, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_3000_coins", name: "3,000 عملات | JACO - جاكو", category: "JACO - جاكو", priceUsd: "40.88", price_usd: 40.88, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_5000_coins", name: "5,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "68.11", price_usd: 68.11, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_8000_coins", name: "8,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "108.98", price_usd: 108.98, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_10000_coins", name: "10,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "136.24", price_usd: 136.24, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_20000_coins", name: "20,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "272.45", price_usd: 272.45, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_30000_coins", name: "30,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "408.68", price_usd: 408.68, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_50000_coins", name: "50,000 عملات | JACO - جاكو", category: "JACO - جاكو", priceUsd: "681.15", price_usd: 681.15, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_80000_coins", name: "80,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "1089.83", price_usd: 1089.83, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_100000_coins", name: "100,000 عملات | JACO - جاكو", category: "JACO - جاكو", priceUsd: "1362.27", price_usd: 1362.27, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "jaco_200000_coins", name: "200,000 Coins | JACO - جاكو", category: "JACO - جاكو", priceUsd: "2724.56", price_usd: 2724.56, min: "1", max: "1", desc: "شحن اشتراكات وعملات تطبيق جاكو (JACO)" },
        { id: "tg_premium_1yr", name: "1 سنة | Telegram Premium", category: "Telegram Premium", priceUsd: "32.47", price_usd: 32.47, min: "1", max: "1", desc: "تفعيل اشتراك تليجرام بريميوم لمدة 1 سنة عن طريق يوزر التليجرام" },
        { id: "tg_premium_6mo", name: "6 أشهر | Telegram Premium", category: "Telegram Premium", priceUsd: "17.91", price_usd: 17.91, min: "1", max: "1", desc: "تفعيل اشتراك تليجرام بريميوم لمدة 6 أشهر عن طريق يوزر التليجرام" },
        { id: "tg_premium_3mo", name: "3 أشهر | Telegram Premium", category: "Telegram Premium", priceUsd: "13.43", price_usd: 13.43, min: "1", max: "1", desc: "تفعيل اشتراك تليجرام بريميوم لمدة 3 أشهر عن طريق يوزر التليجرام" },
        { id: "tg_stars_custom", name: "نجوم تليجرام | Telegram Stars", category: "Telegram Premium", priceUsd: "0.92", price_usd: 0.92, min: "50", max: "1000000", desc: "شحن نجوم تليجرام (سعر 50 نجمة $0.92) - أدخل الكمية المطلوبة من 50 إلى 1,000,000" },
      ];

      const currentServices = Array.isArray(data?.services) ? data.services : [];
      const existingIds = new Set(currentServices.map((s: any) => s.id));
      const missingDefaults = gameDefaults.filter((p) => !existingIds.has(p.id));

      if (missingDefaults.length > 0) {
        const mergedServices = [...currentServices, ...missingDefaults];
        await adminDb.collection("settings").doc("manual_services").set(
          { services: mergedServices, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        data = { ...(data || {}), services: mergedServices };
      }
    }

    return NextResponse.json({
      success: true,
      exists: snapshot.exists || !!data,
      data,
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to read admin data", error);
    return NextResponse.json({ success: false, error: "Unable to read data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    if (body.action === "setDocument" && readableDocuments.has(body.resource)) {
      const [collection, id] = body.resource.split("/");
      const reference = adminDb.collection(collection).doc(id);
      const data = body.data && typeof body.data === "object" ? body.data : {};

      // Before replacing the site USD rate, give legacy packages (which only
      // have an EGP price) a USD source price using the previous site rate.
      // This makes their next displayed EGP/SAR price move with the new rate.
      if (body.resource === "settings/pricing") {
        const [currentPricing, manualServices] = await Promise.all([
          reference.get(),
          adminDb.collection("settings").doc("manual_services").get(),
        ]);
        const previousUsdRate = Number(
          currentPricing.data()?.usd_rate || currentPricing.data()?.tiktok_usd_rate,
        );
        const requestedPricing = data as Record<string, unknown>;
        const nextUsdRate = Number(
          requestedPricing.usd_rate || requestedPricing.tiktok_usd_rate,
        );
        const services = manualServices.data()?.services;
        if (
          Array.isArray(services)
          && Number.isFinite(previousUsdRate)
          && previousUsdRate > 0
          && Number.isFinite(nextUsdRate)
          && nextUsdRate > 0
        ) {
          const repricedServices = services.map((service: Record<string, unknown>) => {
            let priceUsd = getManualServicePriceUsd(service);
            if (priceUsd <= 0) {
              const priceEgp = Number(service.price ?? service.price_egp);
              priceUsd = Number.isFinite(priceEgp) && priceEgp > 0
                ? priceEgp / previousUsdRate
                : 0;
            }
            if (priceUsd <= 0) return service;
            return {
              ...service,
              price_usd: priceUsd,
              price: Math.round(priceUsd * nextUsdRate * 100) / 100,
              locked_usd_rate: previousUsdRate,
            };
          });
          await adminDb.collection("settings").doc("manual_services").set(
            { services: repricedServices, updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
        }

        // The old manual-services collection is still displayed to customers
        // on some categories. Recalculate both its stored EGP price and its
        // USD source price in the same update.
        if (
          Number.isFinite(previousUsdRate)
          && previousUsdRate > 0
          && Number.isFinite(nextUsdRate)
          && nextUsdRate > 0
        ) {
          const legacyServices = await adminDb.collection("services")
            .where("is_manual", "==", true)
            .get();
          const batch = adminDb.batch();
          let changes = 0;
          for (const legacyService of legacyServices.docs) {
            const service = legacyService.data() as Record<string, unknown>;
            let priceUsd = getManualServicePriceUsd(service);
            if (priceUsd <= 0) {
              const priceEgp = Number(service.price ?? service.price_egp);
              priceUsd = Number.isFinite(priceEgp) && priceEgp > 0
                ? priceEgp / previousUsdRate
                : 0;
            }
            if (priceUsd <= 0) continue;
            batch.set(legacyService.ref, {
              price_usd: priceUsd,
              price: Math.round(priceUsd * nextUsdRate * 100) / 100,
              locked_usd_rate: previousUsdRate,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            changes += 1;
          }
          if (changes > 0) await batch.commit();
        }
      }

      await reference.set(
        {
          ...data,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === "savePricingSettings" && body.settings && typeof body.settings === "object") {
      await adminDb.collection("settings").doc("pricing").set(
        {
          ...body.settings,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === "saveTiers" && Array.isArray(body.tiers)) {
      const pricing = await adminDb.collection("settings").doc("pricing").get();
      const usdRate = Number(
        pricing.data()?.usd_rate || pricing.data()?.tiktok_usd_rate,
      );
      if (!Number.isFinite(usdRate) || usdRate <= 0) {
        return NextResponse.json(
          { success: false, error: "سعر صرف الدولار غير مضبوط" },
          { status: 400 },
        );
      }
      const batch = adminDb.batch();
      for (const tier of body.tiers) {
        const pricePer1000Usd = Number(
          tier.pricePer1000Usd ?? tier.price_per_1000_usd,
        );
        if (
          !Number.isFinite(pricePer1000Usd)
          || pricePer1000Usd <= 0
          || !Number.isFinite(Number(tier.min))
          || !Number.isFinite(Number(tier.max))
        ) {
          return NextResponse.json(
            { success: false, error: "تأكد من حدود الشرائح وأسعار الدولار" },
            { status: 400 },
          );
        }
        const reference = tier.id
          ? adminDb.collection("tiers").doc(String(tier.id))
          : adminDb.collection("tiers").doc();
        batch.set(reference, {
          min: Number(tier.min),
          max: Number(tier.max),
          price_per_1000_usd: pricePer1000Usd,
          price_per_1000: Math.round(pricePer1000Usd * usdRate * 100) / 100,
          locked_usd_rate: usdRate,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
      return NextResponse.json({ success: true });
    }
    if (body.action === "saveManualServices" && Array.isArray(body.services)) {
      const [pricing, tiersSnapshot] = await Promise.all([
        adminDb.collection("settings").doc("pricing").get(),
        adminDb.collection("tiers").get(),
      ]);
      const usdRate = Number(
        pricing.data()?.usd_rate || pricing.data()?.tiktok_usd_rate,
      );
      if (!Number.isFinite(usdRate) || usdRate <= 0) {
        return NextResponse.json(
          { success: false, error: "سعر صرف الدولار غير مضبوط" },
          { status: 400 },
        );
      }
      const tiers = tiersSnapshot.docs.map((document) => document.data() as TikTokPricingTier);
      const services = body.services.map((service: Record<string, unknown>) => {
        const serviceId = String(service.id || "");
        const linkedCoins = serviceId === "tiktok_hidden_w"
          ? 13_000
          : serviceId === "tiktok_hidden_m"
            ? 26_000
            : 0;
        const automaticPriceEgp = linkedCoins > 0
          ? calculateTikTokPriceEgp(linkedCoins, tiers, usdRate)
          : 0;
        const priceUsd = linkedCoins > 0
          ? automaticPriceEgp / usdRate
          : Number(service.priceUsd ?? service.price_usd);
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
          throw new Error("INVALID_MANUAL_SERVICE_PRICE");
        }
        const discountPercent = priceUsd > 10 ? Math.min(100, Math.max(0, Number(service.discountPercent ?? service.discount_percent ?? 0))) : 0;
        return {
          ...service,
          priceUsd: priceUsd,
          price_usd: priceUsd,
          price: linkedCoins > 0 ? automaticPriceEgp : Math.round(priceUsd * usdRate * 100) / 100,
          price_egp: linkedCoins > 0 ? automaticPriceEgp : Math.round(priceUsd * usdRate * 100) / 100,
          ...(linkedCoins > 0 ? { automatic_tiktok_coins: linkedCoins } : {}),
          locked_usd_rate: usdRate,
          discountPercent: discountPercent > 0 ? discountPercent.toString() : "",
          discount_percent: discountPercent > 0 ? discountPercent : 0,
        };
      });
      const batch = adminDb.batch();
      batch.set(adminDb.collection("settings").doc("manual_services"), {
        services,
        ...(body.categoryInstructions ? { categoryInstructions: body.categoryInstructions } : {}),
        ...(body.categoryAlerts ? { categoryAlerts: body.categoryAlerts } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      for (const s of services) {
        const serviceId = String(s.id || "");
        if (serviceId) {
          const docRef = adminDb.collection("services").doc(serviceId);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            batch.set(docRef, {
              price_usd: s.price_usd,
              price: s.price,
              price_egp: s.price,
              locked_usd_rate: usdRate,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        }
      }

      await batch.commit();
      return NextResponse.json({ success: true });
    }
    if (body.action === "saveSiteAppearance") {
      await adminDb.collection("settings").doc("site_appearance").set(
        {
          ...(body.appearance || {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === "saveCategoryIcons") {
      await adminDb.collection("settings").doc("category_icons").set(
        {
          icons: body.icons || {},
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === "savePaymentGateways") {
      await adminDb.collection("settings").doc("payment_gateways").set(
        {
          gateways: body.gateways || {},
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === "deleteTier" && typeof body.id === "string") {
      await adminDb.collection("tiers").doc(body.id).delete();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to write admin data", error);
    const message =
      error instanceof Error && error.message === "INVALID_MANUAL_SERVICE_PRICE"
        ? "تأكد من أسعار الخدمات بالدولار"
        : "Unable to save data";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
