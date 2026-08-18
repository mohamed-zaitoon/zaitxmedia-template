import "server-only";

import { adminDb } from "@/app/lib/firebase-admin";
import catalog from "@/public/services.json";

import { calculateTikTokPriceEgp } from "@/lib/pricing/tiktok";
import { calculateManualServicePriceEgp } from "@/lib/pricing/manual-service";

import { calculateGlobalUsdDiscount } from "@/lib/pricing/pricing-discount";

interface CatalogService {
  service: string | number;
  name: string;
  rate: string | number;
  min: number;
  max: number;
  type?: string;
  isFazer?: boolean;
}

export interface ServerOrderPrice {
  amountEgp: number;
  serviceName: string;
  supplierPricingBasis: "per_1000" | "per_unit";
}

function roundEgp(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const normalized = Math.round(value * 1e8) / 1e8;
  return Math.round(normalized * 100) / 100;
}

export async function calculateServerOrderPrice(
  serviceId: string,
  quantity: number,
): Promise<ServerOrderPrice> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("INVALID_QUANTITY");
  }

  const linkedTikTokCoinQuantity = serviceId === "tiktok_hidden_w"
    ? 13_000
    : serviceId === "tiktok_hidden_m"
      ? 26_000
      : 0;

  if (serviceId === "tiktok_coins" || linkedTikTokCoinQuantity > 0) {
    const pricedCoinQuantity = linkedTikTokCoinQuantity || quantity;
    const [pricing, tiersSnap] = await Promise.all([
      adminDb.collection("settings").doc("pricing").get(),
      adminDb.collection("tiers").get(),
    ]);
    const minCoins = Number(pricing.data()?.tiktok_min_coins || 30);
    const maxCoins = Number(pricing.data()?.tiktok_max_coins || 2_500_000);
    if (pricedCoinQuantity < minCoins || pricedCoinQuantity > maxCoins) {
      throw new Error("SERVICE_QUANTITY_OUT_OF_RANGE");
    }
    const usdRate = Number(
      pricing.data()?.usd_rate || pricing.data()?.tiktok_usd_rate || 50
    );
    const tiers = tiersSnap.docs.map((d) => d.data()) as any[];
    const globalDiscountConfig = {
      enabled: Boolean(pricing.data()?.global_usd_discount_enabled ?? pricing.data()?.globalUsdDiscountEnabled),
      discountPercent: Number(pricing.data()?.global_usd_discount_percent ?? pricing.data()?.globalUsdDiscountPercent ?? 0),
      maxDiscountUsd: Number(pricing.data()?.global_usd_discount_max_amount ?? pricing.data()?.globalUsdDiscountMaxAmount ?? pricing.data()?.max_discount_usd ?? pricing.data()?.maxDiscountUsd ?? 0),
      expiresAt: pricing.data()?.global_usd_discount_expires_at ?? pricing.data()?.globalUsdDiscountExpiresAt ?? null,
    };
    const amountEgp = calculateTikTokPriceEgp(pricedCoinQuantity, tiers, usdRate, globalDiscountConfig);
    return {
      amountEgp,
      serviceName: serviceId === "tiktok_hidden_w"
        ? "اشتراك مخفي - اسبوعي"
        : serviceId === "tiktok_hidden_m"
          ? "اشتراك مخفي - شهري"
          : "شحن عملات تيك توك",
      supplierPricingBasis: "per_1000",
    };
  }

  const [manualSettings, manualPricing] = await Promise.all([
    adminDb.collection("settings").doc("manual_services").get(),
    adminDb.collection("settings").doc("pricing").get(),
  ]);
  const manualService = (
    Array.isArray(manualSettings.data()?.services)
      ? manualSettings.data()?.services
      : []
  ).find((service: Record<string, unknown>) => String(service.id) === serviceId);

  if (manualService) {
    if (manualService.disabled === true || manualService.status === "disabled" || manualService.active === false) {
      throw new Error("SERVICE_TEMPORARILY_DISABLED");
    }
    const min = Number(manualService.min);
    const max = Number(manualService.max);
    const manualUsdRate = Number(
      manualPricing.data()?.usd_rate || manualPricing.data()?.tiktok_usd_rate || 50,
    );
    const globalDiscountConfig = {
      enabled: Boolean(manualPricing.data()?.global_usd_discount_enabled ?? manualPricing.data()?.globalUsdDiscountEnabled),
      discountPercent: Number(manualPricing.data()?.global_usd_discount_percent ?? manualPricing.data()?.globalUsdDiscountPercent ?? 0),
      maxDiscountUsd: Number(manualPricing.data()?.global_usd_discount_max_amount ?? manualPricing.data()?.globalUsdDiscountMaxAmount ?? manualPricing.data()?.max_discount_usd ?? manualPricing.data()?.maxDiscountUsd ?? 0),
      expiresAt: manualPricing.data()?.global_usd_discount_expires_at ?? manualPricing.data()?.globalUsdDiscountExpiresAt ?? null,
    };
    const unitPrice = calculateManualServicePriceEgp(manualService, manualUsdRate, globalDiscountConfig);
    if (
      quantity < min
      || quantity > max
      || !Number.isFinite(unitPrice)
      || unitPrice <= 0
    ) {
      throw new Error("SERVICE_QUANTITY_OUT_OF_RANGE");
    }
    return {
      amountEgp: roundEgp(quantity * unitPrice),
      serviceName: String(manualService.name || serviceId),
      supplierPricingBasis: "per_unit",
    };
  }

  const service = (catalog as CatalogService[]).find(
    (item) => String(item.service) === serviceId,
  );
  if (!service) throw new Error("SERVICE_NOT_FOUND");
  if (quantity < Number(service.min) || quantity > Number(service.max)) {
    throw new Error("SERVICE_QUANTITY_OUT_OF_RANGE");
  }

  const settings = await adminDb.collection("settings").doc("pricing").get();
  const rateUsd = Number(service.rate);
  const usdRate = Number(settings.data()?.usd_rate || settings.data()?.tiktok_usd_rate || 50);
  const globalDiscountConfig = {
    enabled: Boolean(settings.data()?.global_usd_discount_enabled ?? settings.data()?.globalUsdDiscountEnabled),
    discountPercent: Number(settings.data()?.global_usd_discount_percent ?? settings.data()?.globalUsdDiscountPercent ?? 0),
    maxDiscountUsd: Number(settings.data()?.global_usd_discount_max_amount ?? settings.data()?.globalUsdDiscountMaxAmount ?? settings.data()?.max_discount_usd ?? settings.data()?.maxDiscountUsd ?? 0),
    expiresAt: settings.data()?.global_usd_discount_expires_at ?? settings.data()?.globalUsdDiscountExpiresAt ?? null,
  };
  const globalDiscountRes = calculateGlobalUsdDiscount(rateUsd, globalDiscountConfig);
  const effectiveS = globalDiscountRes.finalPrice;

  if (
    !Number.isFinite(rateUsd)
    || rateUsd <= 0
    || !Number.isFinite(usdRate)
    || usdRate <= 0
  ) {
    throw new Error("SERVICE_PRICE_UNAVAILABLE");
  }

  const unitEgp = effectiveS * (usdRate + 4) * 1.005;
  const amountEgp =
    service.type === "Package"
      ? quantity * unitEgp
      : (quantity * unitEgp) / 1000;

  return {
    amountEgp: roundEgp(amountEgp),
    serviceName: service.name,
    supplierPricingBasis:
      service.type === "Package" ? "per_unit" : "per_1000",
  };
}
