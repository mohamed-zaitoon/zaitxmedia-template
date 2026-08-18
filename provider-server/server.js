"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const FAZER_ORIGIN = "https://api.fzr.cards";
const FAZER_API_PREFIX = "/api/v2";
const SMMX_ORIGIN = "https://smmxmedia.com";
const SMMX_API_PATH = "/api/v2";
const DEFAULT_USD_RATE = 50;
const DEFAULT_USD_RATE_PADDING_EGP = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CATALOG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SMMX_SERVICES_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = "active-offers-v5";
const cache = new Map();
const alphabeticCollator = new Intl.Collator(["en", "ar"], {
  numeric: true,
  sensitivity: "base",
});
const allowedMarketPattern =
  /(^|[^a-z0-9])(?:EG|EGY|EGYPT|SA|KSA|SAUDI)(?=$|[^a-z0-9])|(?:مصر|السعودية|السعوديه)/i;
const disallowedMarketPattern =
  /(^|[^a-z0-9])(?:US|USA|UNITED STATES|UK|GB|GREAT BRITAIN|GLOBAL|ROW|SEA|CIS|EU|EUROPE|ASIA|AE|UAE|CN|CHINA|HK|JP|KR|IN|ID|INDONESIA|MY|MALAYSIA|PH|PHILIPPINES|SG|SINGAPORE|TH|THAILAND|VN|VIETNAM|PK|BD|BR|BRAZIL|CA|MX|AU|NZ|AT|BE|CH|DE|DK|ES|FI|FR|IE|IT|NL|NO|PL|PT|RU|SE|TR|TURKEY|TW|TAIWAN|KH|CAMBODIA|KZ|KAZAKHSTAN|NA|NORTH AMERICA|NAEU|AMERICAS|LATAM|LATIN AMERICA|VNG|MENA|MIDDLE EAST)(?=$|[^a-z0-9])|(?:الإمارات|الامارات|الكويت|قطر|البحرين|عمان|الأردن|الاردن|العراق|المغرب|الجزائر|تونس|تركيا|الهند|اندونيسيا|إندونيسيا|باكستان|امريكا|أمريكا|اوروبا|أوروبا|عالمي|العالم)/i;
const disallowedMarketSuffixPattern =
  /(^|_)(us|usa|united_states|uk|gb|global|row|sea|cis|eu|europe|asia|ae|uae|cn|china|hk|jp|kr|in|id|my|ph|sg|th|vn|pk|bd|br|brazil|ca|mx|au|nz|at|be|ch|de|dk|es|fi|fr|ie|it|nl|no|pl|pt|ru|se|tr|turkey|tw|taiwan|kh|kz|na|naeu|americas|latam|vng|mena|middle_east)($|_)/i;
const allowedMarketSuffixPattern = /(^|_)(eg|egypt|sa|ksa|saudi)($|_)/i;
const neutralMarketPattern =
  /(^|[^a-z0-9])(?:GLOBAL|ROW|WORLDWIDE|WORLD WIDE|WW|INTL|INTERNATIONAL|MENA|MIDDLE EAST)(?=$|[^a-z0-9])|(?:عالمي|العالم)/i;
const neutralMarketStripPattern =
  /(^|[^a-z0-9])(?:GLOBAL|ROW|WORLDWIDE|WORLD WIDE|WW|INTL|INTERNATIONAL|MENA|MIDDLE EAST)(?=$|[^a-z0-9])|(?:عالمي|العالم)/gi;
const neutralMarketSuffixPattern = /(^|_)(global|row|worldwide|world_wide|ww|intl|international|mena|middle_east)($|_)/gi;
const PUBG_MOBILE_MERGED_ID = "pubg_mobile";
const PUBG_MOBILE_MERGED_CATALOG_ID = `topup:${PUBG_MOBILE_MERGED_ID}`;
const PUBG_NEW_STATE_ID = "pubg_new_state";
const PUBG_NEW_STATE_CATALOG_ID = `topup:${PUBG_NEW_STATE_ID}`;
const pubgCategoryPattern = /\bpubg\b|playerunknown|ببجي/i;
const pubgNewStatePattern = /\bnew[\s_-]*state\b|نيو\s*ستيت|newstate/i;
const smmxDescriptionNoisePattern = /(?:اقر[أاأ]?\s*(?:ال)?وصف|read\s*(?:the\s*)?description)\s*/gi;
const smmxGameServicePattern =
  /\b(?:game|gaming|games|pubg|playerunknown|free[\s_-]*fire|roblox|call[\s_-]*of[\s_-]*duty|codm|mobile[\s_-]*legends|mlbb|fortnite|valorant|genshin|honkai|steam|xbox|playstation|psn|riot|minecraft|brawl[\s_-]*stars|clash|efootball|fifa|fc[\s_-]*mobile|delta[\s_-]*force|blood[\s_-]*strike|arena[\s_-]*breakout)\b|(?:لعبة|العاب|ألعاب|ببجي|فري\s*فاير|كول\s*اوف)/i;
const smmxRazerAppPattern =
  /\b(?:telegram|capcut|bigo|imo|likee|lita|mangatoon|nimo|poppo|qq[\s_-]*coin|starmaker|sugo|wesing|yoho|zepeto|chamet|firefly|heesay)\b|(?:تيليجرام|تليجرام|كاب\s*كت|بيجو|لايكي|ستارميكر)/i;
const smmxRazerCommercePattern =
  /\b(?:premium|stars?|subscription|subscribe|membership|pro|vip|monthly|yearly|annual|coins?|diamonds?|gems?|points?|tokens?|recharge|top[\s_-]*up|topup|gift[\s_-]*card|card|wallet|balance)\b|(?:بريميوم|نجوم|اشتراك|عضوية|شهري|شهرية|سنوي|سنوية|شهر|سنة|عملات|عملة|كوينز|شحن|رصيد|بطاقة|كارت|الماسات|جواهر)/i;
const smmxTiktokCoinsPattern =
  /\b(?:tiktok|tik[\s_-]*tok)\b.*\b(?:coins?|recharge|top[\s_-]*up|topup|balance|wallet|diamonds?|tokens?|points?)\b|\b(?:coins?|recharge|top[\s_-]*up|topup|balance|wallet|diamonds?|tokens?|points?)\b.*\b(?:tiktok|tik[\s_-]*tok)\b|(?:تيك\s*توك|تيكتوك).*(?:عملات|عملة|كوينز|شحن|رصيد|محفظة)|(?:عملات|عملة|كوينز|شحن|رصيد|محفظة).*(?:تيك\s*توك|تيكتوك)/i;
const disallowedSmmxFlagPattern =
  /🇦🇪|🇰🇼|🇶🇦|🇧🇭|🇴🇲|🇯🇴|🇮🇶|🇲🇦|🇩🇿|🇹🇳|🇹🇷|🇮🇳|🇮🇩|🇵🇰|🇧🇩|🇺🇸|🇬🇧|🇧🇷|🇨🇦|🇦🇺|🇩🇪|🇫🇷|🇮🇹|🇪🇸|🇷🇺|🇨🇳|🇯🇵|🇰🇷|🇲🇾|🇵🇭|🇸🇬|🇹🇭|🇻🇳/u;
const disallowedSmmxAudiencePattern = /(?:أجانب|اجانب|أجنبي|اجنبي|foreigners?|foreign)/i;

loadEnvFile();

const catalogSources = {
  topup: {
    label: "شحن مباشر",
    listPath: "/topups",
    itemKey: "items",
    idKey: "category_id",
    offersPath: (id) => `/topups/offers?category_id=${encodeURIComponent(id)}`,
    offersKey: "offers",
    offerIdKey: "offer_id",
  },
  manual_service: {
    label: "خدمات يدوية",
    listPath: "/manual-services",
    itemKey: "items",
    idKey: "id",
    offersPath: (id) => `/manual-services/${encodeURIComponent(id)}/offers`,
    offersKey: "items",
    offerIdKey: "id",
  },
};

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFazerApiKey() {
  return process.env.FAZER_API_KEY || process.env.FAZERCARDS_API_KEY || "";
}

function getSmmxApiKey() {
  return process.env.SMMX_API_KEY || process.env.SMMXMEDIA_API_KEY || "";
}

function normalizeSmmxService(raw, usdRateOverride, customPadding) {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.service ?? "").trim();
  const name = String(raw.name || id).replace(/\s+/g, " ").trim();
  const category = String(raw.category || "").replace(/\s+/g, " ").trim();
  const type = String(raw.type || "Default").replace(/\s+/g, " ").trim();
  const rateUsd = asNumber(raw.rate);
  const minQuantity = Math.max(1, Math.round(asNumber(raw.min) || 1));
  const maxQuantity = Math.max(minQuantity, Math.round(asNumber(raw.max) || minQuantity));
  const searchable = `${id} ${name} ${category}`;

  if (!id || !name || !rateUsd || rateUsd <= 0) return null;
  if (isSmmxRazerDuplicateService(searchable)) return null;
  if (hasDisallowedSmmxMarketText(searchable)) return null;

  const rateEgpPer1000 = priceUsdToEgp(rateUsd, usdRateOverride, customPadding);

  return {
    id,
    name,
    category,
    type,
    rateUsd,
    rateEgpPer1000,
    minQuantity,
    maxQuantity,
  };
}

function getEffectiveUsdRate(usdRateOverride) {
  return usdRateOverride && usdRateOverride > 0 ? usdRateOverride : envNumber("USD_TO_EGP_RATE", DEFAULT_USD_RATE);
}

function asNumber(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundUpToNearestFive(value) {
  return Math.ceil(value);
}

function priceUsdToEgp(priceUsd, usdRateOverride) {
  const parsed = asNumber(priceUsd);
  if (!parsed || parsed <= 0) return null;
  const usdRate = usdRateOverride && usdRateOverride > 0 ? usdRateOverride : envNumber("USD_TO_EGP_RATE", DEFAULT_USD_RATE);
  const basePrice = parsed * usdRate;
  const withFixed = basePrice + 3.5;
  const total = withFixed * 1.004;
  return Math.ceil(total);
}

function alphabeticCompare(left, right) {
  return alphabeticCollator.compare(String(left || ""), String(right || ""));
}

function compareCategoriesAlphabetically(left, right) {
  return (
    alphabeticCompare(left.name, right.name) ||
    alphabeticCompare(left.kindLabel, right.kindLabel) ||
    alphabeticCompare(left.catalogId, right.catalogId)
  );
}

function compareOffersAlphabetically(left, right) {
  return alphabeticCompare(left.name, right.name) || left.priceEgp - right.priceEgp || alphabeticCompare(left.id, right.id);
}

function compareSmmxServicesAlphabetically(left, right) {
  return (
    alphabeticCompare(left.category, right.category) ||
    alphabeticCompare(left.name, right.name) ||
    alphabeticCompare(left.id, right.id)
  );
}

function getCached(key) {
  const entry = cache.get(`${CACHE_VERSION}:${key}`);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(`${CACHE_VERSION}:${key}`);
    return null;
  }
  return entry.value;
}

function setCached(key, value, ttlMs = CACHE_TTL_MS) {
  cache.set(`${CACHE_VERSION}:${key}`, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

async function fazerFetch(path) {
  const apiKey = getFazerApiKey();
  if (!apiKey) {
    const error = new Error("FAZER_API_KEY is not configured.");
    error.status = 503;
    throw error;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${FAZER_API_PREFIX}${normalizedPath}`, FAZER_ORIGIN);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || payload.ok === false) {
    const error = new Error(payload && payload.error ? payload.error : `Fazer request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function smmxFetch(params) {
  const apiKey = getSmmxApiKey();
  if (!apiKey) {
    const error = new Error("SMMX_API_KEY is not configured.");
    error.status = 503;
    throw error;
  }

  const body = new URLSearchParams({
    key: apiKey,
    ...params,
  });
  const response = await fetch(new URL(SMMX_API_PATH, SMMX_ORIGIN), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || (payload && typeof payload === "object" && !Array.isArray(payload) && payload.error)) {
    const error = new Error(payload && payload.error ? payload.error : `SMMX request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function fetchPagedList(source) {
  const allItems = [];
  let cursor = "";
  let guard = 0;

  do {
    const separator = source.listPath.includes("?") ? "&" : "?";
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const limitQuery = source.listPath.includes("limit=") ? "" : `${separator}limit=100`;
    const payload = await fazerFetch(`${source.listPath}${limitQuery}${cursorQuery}`);
    const items = Array.isArray(payload[source.itemKey]) ? payload[source.itemKey] : [];
    allItems.push(...items);

    cursor = payload.meta && payload.meta.next_cursor ? String(payload.meta.next_cursor) : "";
    guard += 1;
    if (!payload.meta || !payload.meta.has_more) break;
  } while (cursor && guard < 50);

  return allItems;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeCategory(kind, source, item) {
  const providerId = item[source.idKey];
  if (providerId === undefined || providerId === null) return null;
  const id = String(providerId);
  const name = String(item.name || item.title || id).trim();
  if (!name) return null;

  return {
    catalogId: `${kind}:${id}`,
    kind,
    kindLabel: source.label,
    id,
    name,
    note: "",
    region: typeof item.region === "string" ? item.region : "",
    platform: typeof item.platform === "string" ? item.platform : "",
  };
}

function hasAllowedMarketText(value) {
  return allowedMarketPattern.test(String(value || ""));
}

function isNeutralMarketText(value) {
  return neutralMarketPattern.test(String(value || ""));
}

function stripNeutralMarketText(value) {
  return String(value || "").replace(neutralMarketStripPattern, " ");
}

function stripNeutralMarketSuffixes(value) {
  return String(value || "")
    .replace(neutralMarketSuffixPattern, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

function hasDisallowedMarketText(value) {
  return disallowedMarketPattern.test(stripNeutralMarketText(value));
}

function hasDisallowedSmmxMarketText(value) {
  const text = stripNeutralMarketText(value);
  if (disallowedSmmxFlagPattern.test(text)) return true;
  if (disallowedSmmxAudiencePattern.test(text)) return true;
  return hasDisallowedMarketText(text);
}

function isSmmxRazerDuplicateService(value) {
  const text = String(value || "");
  if (smmxGameServicePattern.test(text)) return true;
  if (smmxTiktokCoinsPattern.test(text)) return true;
  return smmxRazerAppPattern.test(text) && smmxRazerCommercePattern.test(text);
}

function isAllowedMarketCategory(category) {
  const region = String(category.region || "").trim();
  const marketText = `${region} ${category.id || ""} ${category.name || ""} ${category.platform || ""}`;
  if (hasDisallowedMarketText(marketText)) return false;
  if (region && !hasAllowedMarketText(region) && !isNeutralMarketText(region) && region.length <= 12) return false;

  const id = String(category.id || "");
  const marketId = stripNeutralMarketSuffixes(id);
  if (disallowedMarketSuffixPattern.test(marketId) && !allowedMarketSuffixPattern.test(id)) return false;

  const parentheticalParts = [...String(category.name || "").matchAll(/\(([^)]{2,})\)/g)].map((match) => match[1].trim());
  for (const part of parentheticalParts) {
    if (isNeutralMarketText(part)) continue;
    if (hasDisallowedMarketText(part)) return false;
    if (!hasAllowedMarketText(part) && /^[A-Z]{2,5}$/.test(part)) return false;
  }
  return true;
}

function isPubgCategory(category) {
  return pubgCategoryPattern.test(`${category.kind} ${category.id} ${category.name} ${category.platform}`);
}

function createMergedPubgCategory() {
  return {
    catalogId: PUBG_MOBILE_MERGED_CATALOG_ID,
    kind: "topup",
    kindLabel: catalogSources.topup.label,
    id: PUBG_MOBILE_MERGED_ID,
    name: "Pubg Mobile",
    note: "",
    region: "Global",
    platform: "pubg",
  };
}

function mergePubgCatalogCategories(categories) {
  const pubgCategories = categories.filter(isPubgCategory);
  if (!pubgCategories.length) return categories;

  return [
    createMergedPubgCategory(),
    ...categories.filter((category) => !isPubgCategory(category)),
  ];
}

function ensurePubgCatalogCategory(categories) {
  if (categories.some((category) => category.catalogId === PUBG_MOBILE_MERGED_CATALOG_ID)) return categories;
  return [createMergedPubgCategory(), ...categories];
}

async function loadPubgCategories() {
  const categories = [];
  for (const [kind, source] of Object.entries(catalogSources)) {
    const items = await fetchPagedList(source).catch(() => []);
    for (const item of items) {
      const category = normalizeCategory(kind, source, item);
      if (category && isAllowedMarketCategory(category) && isPubgCategory(category)) {
        categories.push(category);
      }
    }
  }
  return categories;
}

function normalizeMergedPubgOfferName(name) {
  return String(name || "")
    .replace(/\s*\((?:EG|EGY|EGYPT|مصر|SA|KSA|SAUDI|السعودية|السعوديه|MENA)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMergedOfferKey(offer) {
  return normalizeMergedPubgOfferName(offer.name).toLowerCase();
}

function normalizeOffer(raw, source, usdRateOverride, customPadding) {
  const providerId = raw[source.offerIdKey];
  if (providerId === undefined || providerId === null) return null;

  const priceUsd = raw.price_usd ?? raw.priceUsd ?? raw.price;
  const priceEgp = priceUsdToEgp(priceUsd, usdRateOverride, customPadding);
  if (!priceEgp) return null;

  const name = String(raw.name || raw.title || providerId).trim();
  if (!name) return null;
  if (hasDisallowedMarketText(name)) return null;

  return {
    id: String(providerId),
    name,
    priceUsd: Number(priceUsd),
    priceEgp,
    stock: raw.stock ?? null,
    minQuantity: raw.min_order_quantity ?? raw.minQuantity ?? null,
    maxQuantity: raw.max_order_quantity ?? raw.maxQuantity ?? null,
    deliveryMinutes: raw.delivery_minutes ?? null,
  };
}

function normalizeField(raw) {
  if (!raw || typeof raw !== "object") return null;
  const key = String(raw.key || "").trim();
  if (!key) return null;
  return {
    key,
    label: String(raw.label || key).trim(),
    type: String(raw.type || "text").trim(),
  };
}

function normalizeSmmxService(raw, usdRateOverride) {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.service ?? "").trim();
  const name = String(raw.name || id).replace(/\s+/g, " ").trim();
  const category = String(raw.category || "").replace(/\s+/g, " ").trim();
  const type = String(raw.type || "Default").replace(/\s+/g, " ").trim();
  const rateUsd = asNumber(raw.rate);
  const minQuantity = Math.max(1, Math.round(asNumber(raw.min) || 1));
  const maxQuantity = Math.max(minQuantity, Math.round(asNumber(raw.max) || minQuantity));
  const searchable = `${id} ${name} ${category}`;

  if (!id || !name || !rateUsd || rateUsd <= 0) return null;
  if (isSmmxRazerDuplicateService(searchable)) return null;
  if (hasDisallowedSmmxMarketText(searchable)) return null;

  const rateEgpPer1000 = priceUsdToEgp(rateUsd, usdRateOverride, 3.5);
  if (!rateEgpPer1000) return null;

  return {
    id,
    name,
    category,
    type,
    rateUsd,
    rateEgpPer1000,
    minQuantity,
    maxQuantity,
    refill: raw.refill === true || raw.refill === "true",
    cancel: raw.cancel === true || raw.cancel === "true",
  };
}

async function categoryHasUsableOffers(category) {
  const source = catalogSources[category.kind];
  if (!source) return true;

  const payload = await fazerFetch(source.offersPath(category.id)).catch(() => null);
  if (!payload) return false;

  const rawOffers = Array.isArray(payload[source.offersKey]) ? payload[source.offersKey] : [];
  return rawOffers.some((offer) => Boolean(normalizeOffer(offer, source)));
}

async function filterCategoriesWithUsableOffers(categories) {
  const checkedCategories = await mapWithConcurrency(categories, 4, async (category) =>
    (await categoryHasUsableOffers(category)) ? category : null,
  );
  return checkedCategories.filter(Boolean);
}

async function buildCatalog() {
  const categories = [];

  for (const [kind, source] of Object.entries(catalogSources)) {
    const items = await fetchPagedList(source).catch((error) => {
      console.warn(`Failed loading Fazer ${kind} catalog: ${error.message}`);
      return [];
    });
    for (const item of items) {
      const category = normalizeCategory(kind, source, item);
      if (category && isAllowedMarketCategory(category)) categories.push(category);
    }
  }

  const activeCategories = await filterCategoriesWithUsableOffers(categories);

  activeCategories.push(
    {
      catalogId: "telegram_premium:telegram_premium",
      kind: "telegram_premium",
      kindLabel: "تيليجرام",
      id: "telegram_premium",
      name: "Telegram Premium",
      note: "",
      region: "",
      platform: "",
    },
    {
      catalogId: "telegram_stars:telegram_stars",
      kind: "telegram_stars",
      kindLabel: "تيليجرام",
      id: "telegram_stars",
      name: "Telegram Stars",
      note: "",
      region: "",
      platform: "",
    },
  );

  const mergedCategories = ensurePubgCatalogCategory(mergePubgCatalogCategories(activeCategories));
  mergedCategories.sort(compareCategoriesAlphabetically);

  return {
    ok: true,
    source: "fazer",
    updatedAt: new Date().toISOString(),
    effectiveUsdRate: getEffectiveUsdRate(),
    categories: mergedCategories,
  };
}

async function buildOffers(kind, id, usdRateOverride, customPadding) {
  if (kind === "topup" && id === PUBG_MOBILE_MERGED_ID) {
    return buildPubgMobileOffers(usdRateOverride, customPadding);
  }

  if (kind === "telegram_stars") {
    const payload = await fazerFetch("/telegram/stars");
    const pricePerStarUsd = asNumber(payload.price_per_star);
    const minAmount = asNumber(payload.min_amount) || 50;
    const maxAmount = asNumber(payload.max_amount) || 10000;
    const fields = [{ key: "telegram_username", label: "يوزر تيليجرام", type: "text" }];

    if (!pricePerStarUsd || pricePerStarUsd <= 0) {
      return makeOfferPayload(kind, id, "Telegram Stars", fields, [], usdRateOverride, customPadding);
    }

    const quantities = [minAmount, 100, 250, 500, 1000, 2500, 5000, 10000, maxAmount]
      .map((quantity) => Math.round(quantity))
      .filter((quantity) => quantity >= minAmount && quantity <= maxAmount);
    const uniqueQuantities = [...new Set(quantities)].sort((a, b) => a - b);

    return makeOfferPayload(
      kind,
      id,
      "Telegram Stars",
      fields,
      uniqueQuantities.map((quantity) => {
        const priceUsd = quantity * pricePerStarUsd;
        return {
          id: String(quantity),
          name: `${quantity.toLocaleString("en-US")} نجمة`,
          priceUsd,
          priceEgp: priceUsdToEgp(priceUsd, usdRateOverride, customPadding),
          stock: null,
          minQuantity: quantity,
          maxQuantity: quantity,
          deliveryMinutes: null,
        };
      }),
      usdRateOverride,
      customPadding,
    );
  }

  if (kind === "telegram_premium") {
    const payload = await fazerFetch("/telegram/premium");
    const plans = Array.isArray(payload.plans) ? payload.plans : [];
    return makeOfferPayload(
      kind,
      id,
      "Telegram Premium",
      [{ key: "telegram_username", label: "يوزر تيليجرام", type: "text" }],
      plans
        .map((plan) => {
          const months = plan.months;
          const priceEgp = priceUsdToEgp(plan.price_usd, usdRateOverride, customPadding);
          if (!months || !priceEgp) return null;
          return {
            id: String(months),
            name: `${months} شهر`,
            priceUsd: Number(plan.price_usd),
            priceEgp,
            stock: null,
            minQuantity: 1,
            maxQuantity: 1,
            deliveryMinutes: null,
          };
        })
        .filter(Boolean),
      usdRateOverride,
      customPadding,
    );
  }

  const source = catalogSources[kind];
  if (!source || !id) {
    const error = new Error("Unknown catalog kind.");
    error.status = 400;
    throw error;
  }

  const payload = await fazerFetch(source.offersPath(id));
  const rawOffers = Array.isArray(payload[source.offersKey]) ? payload[source.offersKey] : [];
  const rawFields = Array.isArray(payload.fields) ? payload.fields : [];
  const offers = rawOffers
    .map((offer) => normalizeOffer(offer, source, usdRateOverride, customPadding))
    .filter(Boolean)
    .sort(compareOffersAlphabetically);

  return makeOfferPayload(
    kind,
    id,
    String(payload.name || (payload.category && payload.category.name) || id),
    rawFields.map(normalizeField).filter(Boolean),
    offers,
    usdRateOverride,
    customPadding,
  );
}

async function buildPubgMobileOffers(usdRateOverride, customPadding) {
  const pubgCategories = await loadPubgCategories();
  const offerMap = new Map();

  await Promise.all(
    pubgCategories.map(async (category) => {
      const source = catalogSources[category.kind];
      if (!source) return;

      const payload = await fazerFetch(source.offersPath(category.id)).catch(() => null);
      if (!payload) return;

      const rawOffers = Array.isArray(payload[source.offersKey]) ? payload[source.offersKey] : [];
      for (const rawOffer of rawOffers) {
        const offer = normalizeOffer(rawOffer, source, usdRateOverride, customPadding);
        if (!offer) continue;

        const name = normalizeMergedPubgOfferName(offer.name);
        const mergedOffer = {
          ...offer,
          id: `${category.kind}:${category.id}:${offer.id}`,
          name: name || offer.name,
        };
        const key = getMergedOfferKey(mergedOffer);
        const current = offerMap.get(key);
        if (!current || mergedOffer.priceEgp < current.priceEgp) {
          offerMap.set(key, mergedOffer);
        }
      }
    }),
  );

  const offers = [...offerMap.values()].sort(compareOffersAlphabetically);
  return makeOfferPayload(
    "topup",
    PUBG_MOBILE_MERGED_ID,
    "Pubg Mobile",
    [{ key: "player_id", label: "ID اللاعب", type: "text" }],
    offers,
    usdRateOverride,
    customPadding,
  );
}

function makeOfferPayload(kind, id, name, fields, offers, usdRateOverride, customPadding) {
  return {
    ok: true,
    source: "fazer",
    updatedAt: new Date().toISOString(),
    effectiveUsdRate: getEffectiveUsdRate(usdRateOverride, customPadding),
    category: { kind, id, name },
    fields,
    offers,
  };
}

async function buildSmmxServices(usdRateOverride, customPadding) {
  const payload = await smmxFetch({ action: "services" });
  const services = Array.isArray(payload)
    ? payload
        .map((service) => normalizeSmmxService(service, usdRateOverride, customPadding))
        .filter(Boolean)
        .sort(compareSmmxServicesAlphabetically)
    : [];

  return {
    ok: true,
    source: "smmxmedia",
    updatedAt: new Date().toISOString(),
    effectiveUsdRate: getEffectiveUsdRate(usdRateOverride, customPadding),
    services,
  };
}

function sendJson(res, status, payload, origin) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": status === 200 ? "public, max-age=120" : "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function getCorsOrigin(req) {
  const configured = process.env.CORS_ORIGIN || "*";
  if (configured === "*") return "*";
  const allowed = configured.split(",").map((item) => item.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  return allowed.includes(origin) ? origin : allowed[0] || "*";
}

const server = http.createServer(async (req, res) => {
  const origin = getCorsOrigin(req);
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {}, origin);
    return;
  }

  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" }, origin);
      return;
    }

    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true, source: "fazer-provider" }, origin);
      return;
    }

    if (url.pathname === "/catalog") {
      const cached = getCached("catalog");
      const payload = cached || (await buildCatalog());
      if (!cached) setCached("catalog", payload, CATALOG_CACHE_TTL_MS);
      sendJson(res, 200, payload, origin);
      return;
    }

    if (url.pathname === "/offers") {
      const kind = url.searchParams.get("kind") || "";
      const id = url.searchParams.get("id") || "";
      const usdRateOverride = asNumber(url.searchParams.get("usd_rate"));
      const customPadding = url.searchParams.get("padding") ? asNumber(url.searchParams.get("padding")) : 3;
      const cacheKey = `offers:${kind}:${id}:${usdRateOverride || "env"}:${customPadding || "env"}`;
      const cached = getCached(cacheKey);
      const payload = cached || (await buildOffers(kind, id, usdRateOverride, customPadding));
      if (!cached) setCached(cacheKey, payload);
      sendJson(res, 200, payload, origin);
      return;
    }

    if (url.pathname === "/smmx/services") {
      const usdRateOverride = asNumber(url.searchParams.get("usd_rate"));
      const customPadding = url.searchParams.get("padding") ? asNumber(url.searchParams.get("padding")) : 3.5;
      const cacheKey = `smmx-services-eg-sa-v5:${usdRateOverride || "env"}:${customPadding || "env"}`;
      const cached = getCached(cacheKey);
      const payload = cached || (await buildSmmxServices(usdRateOverride, customPadding));
      if (!cached) setCached(cacheKey, payload, SMMX_SERVICES_CACHE_TTL_MS);
      sendJson(res, 200, payload, origin);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" }, origin);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, { ok: false, error: error.message || "Server error" }, origin);
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`Provider server listening on port ${port}`);
});
