"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Coins, Send, ShoppingCart, AlertCircle, Info } from "lucide-react";
import { SiTiktok, SiFacebook, SiInstagram } from "react-icons/si";
import { Boxes, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";
import ServicesPanel from "../../ServicesPanel";
import CheckoutModal from "../../components/CheckoutModal";
import { grossDepositRequiredForNet, getMethodFeePercent } from "@/lib/money/wallet";
import { db } from "../../lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { useAuth } from "../../lib/auth-context";
import { useCurrency } from "../../lib/currency-context";
import { useCart } from "../../lib/cart-context";
import {
  calculateTikTokPriceEgp,
  calculateTikTokOriginalPriceEgp,
  ceilTo2Decimals,
  getTikTokPricePer1000,
  getTierEgpPer1000,
} from "@/lib/pricing/tiktok";
import { calculateManualServicePriceEgp } from "@/lib/pricing/manual-service";

const getAppCat = (cat: string, name: string, isFazer?: boolean) => {
  const c = (cat + " " + name).toLowerCase();
  if (isFazer) return "games";
  if (
    c.includes("tik") ||
    c.includes("تيك") ||
    c.includes("مخفي") ||
    c.includes("سوبر فان") ||
    c.includes("سوبرفان") ||
    c.includes("superfan") ||
    c.includes("hidden")
  )
    return "tiktok";
  if (
    c.includes("efootball") ||
    c.includes("pes") ||
    c.includes("بيس") ||
    c.includes("إي فوتبول") ||
    c.includes("اي فوتبول") ||
    c.includes("pubg") ||
    c.includes("ببجي") ||
    c.includes("فري فاير") ||
    c.includes("free fire") ||
    c.includes("mobile legend") ||
    c.includes("roblox") ||
    c.includes("call of duty") ||
    c.includes("fortnite") ||
    c.includes("honor") ||
    c.includes("هونر") ||
    c.includes("empires") ||
    c.includes("إيج") ||
    c.includes("arena") ||
    c.includes("أرينا") ||
    c.includes("pool") ||
    c.includes("8 ball") ||
    c.includes("nba") ||
    c.includes("dragon") ||
    c.includes("دراغون") ||
    c.includes("undawn") ||
    c.includes("أنداون") ||
    c.includes("ludo") ||
    c.includes("لودو") ||
    c.includes("ألعاب") ||
    c.includes("العاب") ||
    c.includes("شحن الألعاب")
  )
    return "games";
  if (
    c.includes("chatgpt") ||
    c.includes("gpt") ||
    c.includes("جي بي تي") ||
    c.includes("برامج") ||
    c.includes("برمجيات") ||
    c.includes("تطبيقات") ||
    c.includes("أخرى") ||
    c.includes("اخري")
  )
    return "other";
  if (c.includes("facebook") || c.includes("فيسبوك") || c.includes("فيس بوك"))
    return "facebook";
  if (c.includes("instagram") || c.includes("انستجرام") || c.includes("انستا"))
    return "instagram";
  return "other";
};

const tn = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^\d.]/g, "");

import { TikTokOfficialLogo, FacebookOfficialLogo, InstagramOfficialLogo, PubgOfficialLogo } from "../../components/ServiceLogos";

const menu = [
  {
    id: "tiktok",
    label: "تيك توك",
    icon: <TikTokOfficialLogo size={20} />,
    color: "#ff0050",
  },
  {
    id: "games",
    label: "شحن ألعاب",
    icon: <PubgOfficialLogo size={20} />,
    color: "#f39c12",
  },
  {
    id: "facebook",
    label: "فيسبوك",
    icon: <FacebookOfficialLogo size={20} />,
    color: "#1877f2",
  },
  {
    id: "instagram",
    label: "إنستجرام",
    icon: <InstagramOfficialLogo size={20} />,
    color: "#e1306c",
  },
  {
    id: "other",
    label: "أخرى",
    icon: <Boxes size={18} className="text-emerald-400" />,
    color: "#10b981",
  },
];

import { isolateLtr } from "../../lib/bidi";

export default function CategoryPage() {
  const params = useParams();
  const category = (params?.category as string) || "tiktok";

  const { user, loading } = useAuth();
  const { convertPrice, selectedCurrency } = useCurrency();
  const { addToCart } = useCart();
  const [p, setP] = useState<any>(null);

  const [min, setMin] = useState(30);
  const [max, setMax] = useState(2500000);
  const [smmRate, setSmmRate] = useState(50);
  const [tiktokUsdRate, setTiktokUsdRate] = useState(50);
  const [sarRate, setSarRate] = useState(12.63);
  const [tiers, setTiers] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [manualSvcs, setManualSvcs] = useState<any>({});
  const [categoryInstructions, setCategoryInstructions] = useState<Record<string, string>>({});
  const [categoryAlerts, setCategoryAlerts] = useState<Record<string, string>>({});
  const [pricingSettings, setPricingSettings] = useState<any>(null);
  const [globalDiscountConfig, setGlobalDiscountConfig] = useState<{ enabled: boolean; discountPercent: number; maxDiscountUsd?: number; expiresAt?: string | null }>({ enabled: false, discountPercent: 0, expiresAt: null });
  const [loaded, setLoaded] = useState(false);
  const [coins, setC] = useState("");
  const [price, setPr] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [checkoutService, setCheckoutService] = useState<any>(null);

  useEffect(() => {
    if (loading) return;
    if (user) setP(user);
  }, [loading, user]);

  useEffect(() => {
    const applyPricing = (s: any) => {
      if (s.exists()) {
        const v = s.data();
        setPricingSettings(v);
        setMin(v.tiktok_min_coins || 30);
        setMax(v.tiktok_max_coins || 2500000);
        setSmmRate(v.smm_usd_rate || 50);
        setTiktokUsdRate(v.usd_rate || v.tiktok_usd_rate || 50);
        setGlobalDiscountConfig({
          enabled: Boolean(v.global_usd_discount_enabled ?? v.globalUsdDiscountEnabled),
          discountPercent: Number(v.global_usd_discount_percent ?? v.globalUsdDiscountPercent ?? 0),
          maxDiscountUsd: Number(v.global_usd_discount_max_amount ?? v.globalUsdDiscountMaxAmount ?? v.max_discount_usd ?? v.maxDiscountUsd ?? 0),
          expiresAt: v.global_usd_discount_expires_at ?? v.globalUsdDiscountExpiresAt ?? null,
        });
      }
    };

    const applyManualServices = (s: any) => {
      if (s.exists() && s.data()) {
        const d = s.data();
        if (d.categoryInstructions) setCategoryInstructions(d.categoryInstructions);
        if (d.categoryAlerts) setCategoryAlerts(d.categoryAlerts);
        if (d.services) {
          const map: any = {};
          d.services.forEach((sv: any) => {
            map[sv.id] = sv;
          });
          setManualSvcs(map);
        }
      }
    };

    const pricingRef = doc(db, "settings", "pricing");
    const manualServicesRef = doc(db, "settings", "manual_services");
    const tiersQuery = query(collection(db, "tiers"), orderBy("min"));
    const manualQuery = query(
      collection(db, "services"),
      where("is_manual", "==", true),
    );

    // Firestore listeners update prices immediately after an admin save.
    const unsubscribePricing = onSnapshot(pricingRef, applyPricing, console.error);
    const unsubscribeManualServices = onSnapshot(
      manualServicesRef,
      applyManualServices,
      console.error,
    );

    const unsubscribeTiers = onSnapshot(
      tiersQuery,
      (s) => {
        setTiers(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      console.error,
    );
    const unsubscribeManual = onSnapshot(
      manualQuery,
      (s) => setManual(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      console.error,
    );

    const refreshPrices = () => {
      void Promise.allSettled([
        getDoc(pricingRef).then(applyPricing),
        getDoc(manualServicesRef).then(applyManualServices),
        getDocs(tiersQuery).then((s) =>
          setTiers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        ),
        getDocs(manualQuery).then((s) =>
          setManual(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        ),
      ]);
    };

    fetch("https://api.exchangerate-api.com/v4/latest/SAR")
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates?.EGP) setSarRate(d.rates.EGP - 0.75 - d.rates.EGP * 0.002);
      })
      .catch(() => {});

    refreshPrices();
    const pricingInterval = window.setInterval(refreshPrices, 30_000);
    const refreshAfterFocus = () => {
      if (document.visibilityState === "visible") refreshPrices();
    };
    window.addEventListener("focus", refreshPrices);
    document.addEventListener("visibilitychange", refreshAfterFocus);

    setLoaded(true);

    return () => {
      unsubscribePricing();
      unsubscribeManualServices();
      unsubscribeTiers();
      unsubscribeManual();
      window.clearInterval(pricingInterval);
      window.removeEventListener("focus", refreshPrices);
      document.removeEventListener("visibilitychange", refreshAfterFocus);
    };
  }, []);

  const gp = (n: number) =>
    getTikTokPricePer1000(n, tiers, tiktokUsdRate);
  const manualServicePrice = (id: string, fallbackEgp: number) => {
    const service = manualSvcs[id];
    if (service) return calculateManualServicePriceEgp(service, tiktokUsdRate, globalDiscountConfig);
    return fallbackEgp;
  };
  const formatExact = (num: number) => {
    return ceilTo2Decimals(num).toString();
  };

  const hc = (v: string) => {
    let e = tn(v);
    if (e.includes(".")) {
      e = e.split(".")[0];
    }
    setC(e);
    const n = Number(e);
    if (n > 0) {
      setPr(formatExact(calculateTikTokPriceEgp(n, tiers, tiktokUsdRate, globalDiscountConfig)));
      setOriginalPrice(formatExact(calculateTikTokOriginalPriceEgp(n, tiers, tiktokUsdRate)));
    }
    else {
      setPr("");
      setOriginalPrice("");
    }
  };
  const nc = Number(coins);
  const ok = nc >= min && nc <= max && tiers.length > 0;

  useEffect(() => {
    const quantity = Number(coins);
    if (quantity > 0 && tiers.length > 0) {
      setPr(
        formatExact(calculateTikTokPriceEgp(quantity, tiers, tiktokUsdRate, globalDiscountConfig)),
      );
      setOriginalPrice(
        formatExact(calculateTikTokOriginalPriceEgp(quantity, tiers, tiktokUsdRate)),
      );
    }
  }, [tiers, tiktokUsdRate, globalDiscountConfig]);

  if (loading || !loaded)
    return (
      <div className="premium-loader-container">
        <div className="premium-loader-wrapper">
          <div className="premium-loader"></div>
          <div className="premium-loader-inner"></div>
        </div>
        <span className="premium-loader-text">جاري تحميل ZAITX MEDIA...</span>
      </div>
    );

  const tabInfo = menu.find((m) => m.id === category);

  const allServices = [
    {
      service: "tiktok_promo",
      name: "ترويج تيك توك",
      category: "ترويج تيك توك",
      description: "زيادة مشاهدات ولايكات ومتابعين",
      isManual: true,
      appCategory: "tiktok",
      price: manualServicePrice("tiktok_promo", 0.5),
      price_egp: manualServicePrice("tiktok_promo", 0.5),
      min: manualSvcs["tiktok_promo"]?.min || 10,
      max: manualSvcs["tiktok_promo"]?.max || 50000,
      min_quantity: manualSvcs["tiktok_promo"]?.min || 10,
      max_quantity: manualSvcs["tiktok_promo"]?.max || 50000,
      instructions: manualSvcs["tiktok_promo"]?.instructions || "",
      alertNote: manualSvcs["tiktok_promo"]?.alertNote || "",
      categoryInstructions: categoryInstructions["ترويج تيك توك"] || categoryInstructions["تيك توك"] || categoryInstructions["tiktok"] || "",
      categoryAlert: categoryAlerts["ترويج تيك توك"] || categoryAlerts["تيك توك"] || categoryAlerts["tiktok"] || "",
    },
    {
      service: "instagram_promo",
      name: "ترويج انستجرام",
      category: "ترويج انستجرام",
      description: "زيادة متابعين ولايكات ومشاهدات",
      isManual: true,
      appCategory: "instagram",
      price: manualServicePrice("instagram_promo", 0.5),
      price_egp: manualServicePrice("instagram_promo", 0.5),
      min: manualSvcs["instagram_promo"]?.min || 10,
      max: manualSvcs["instagram_promo"]?.max || 50000,
      min_quantity: manualSvcs["instagram_promo"]?.min || 10,
      max_quantity: manualSvcs["instagram_promo"]?.max || 50000,
      instructions: manualSvcs["instagram_promo"]?.instructions || "",
      alertNote: manualSvcs["instagram_promo"]?.alertNote || "",
      categoryInstructions: categoryInstructions["ترويج انستجرام"] || categoryInstructions["انستجرام"] || categoryInstructions["instagram"] || "",
      categoryAlert: categoryAlerts["ترويج انستجرام"] || categoryAlerts["انستجرام"] || categoryAlerts["instagram"] || "",
    },
    {
      service: "facebook_promo",
      name: "ترويج فيسبوك",
      category: "ترويج فيسبوك",
      description: "زيادة متابعين ولايكات ومشاهدات",
      isManual: true,
      appCategory: "facebook",
      price: manualServicePrice("facebook_promo", 0.5),
      price_egp: manualServicePrice("facebook_promo", 0.5),
      min: manualSvcs["facebook_promo"]?.min || 10,
      max: manualSvcs["facebook_promo"]?.max || 50000,
      min_quantity: manualSvcs["facebook_promo"]?.min || 10,
      max_quantity: manualSvcs["facebook_promo"]?.max || 50000,
      instructions: manualSvcs["facebook_promo"]?.instructions || "",
      alertNote: manualSvcs["facebook_promo"]?.alertNote || "",
      categoryInstructions: categoryInstructions["ترويج فيسبوك"] || categoryInstructions["فيسبوك"] || categoryInstructions["facebook"] || "",
      categoryAlert: categoryAlerts["ترويج فيسبوك"] || categoryAlerts["فيسبوك"] || categoryAlerts["facebook"] || "",
    },
    ...(manualSvcs["tiktok_superfan"]?.disabled ? [] : [{
      service: "tiktok_superfan",
      name: "سوبر فان - شهري",
      category: "اشتراكات",
      description: "تفعيل سوبر فان لمدة شهر",
      isManual: true,
      appCategory: "tiktok",
      price: manualServicePrice("tiktok_superfan", 150),
      price_egp: manualServicePrice("tiktok_superfan", 150),
      min: manualSvcs["tiktok_superfan"]?.min || 1,
      max: manualSvcs["tiktok_superfan"]?.max || 1,
      min_quantity: manualSvcs["tiktok_superfan"]?.min || 1,
      max_quantity: manualSvcs["tiktok_superfan"]?.max || 1,
    }]),
    ...(manualSvcs["tiktok_hidden_w"]?.disabled ? [] : [{
      service: "tiktok_hidden_w",
      name: "اشتراك مخفي - اسبوعي",
      category: "اشتراكات",
      description: "تفعيل المخفي لمدة اسبوع",
      isManual: true,
      appCategory: "tiktok",
      price: manualServicePrice("tiktok_hidden_w", 30),
      price_egp: manualServicePrice("tiktok_hidden_w", 30),
      min: manualSvcs["tiktok_hidden_w"]?.min || 1,
      max: manualSvcs["tiktok_hidden_w"]?.max || 1,
      min_quantity: manualSvcs["tiktok_hidden_w"]?.min || 1,
      max_quantity: manualSvcs["tiktok_hidden_w"]?.max || 1,
    }]),
    ...(manualSvcs["tiktok_hidden_m"]?.disabled ? [] : [{
      service: "tiktok_hidden_m",
      name: "اشتراك مخفي - شهري",
      category: "اشتراكات",
      description: "تفعيل المخفي لمدة شهر",
      isManual: true,
      appCategory: "tiktok",
      price: manualServicePrice("tiktok_hidden_m", 100),
      price_egp: manualServicePrice("tiktok_hidden_m", 100),
      min: manualSvcs["tiktok_hidden_m"]?.min || 1,
      max: manualSvcs["tiktok_hidden_m"]?.max || 1,
      min_quantity: manualSvcs["tiktok_hidden_m"]?.min || 1,
      max_quantity: manualSvcs["tiktok_hidden_m"]?.max || 1,
    }]),
    ...manual
      .filter((s: any) => !manualSvcs[s.id] && !s.disabled && s.status !== "disabled" && s.active !== false)
      .map((s: any) => ({
        ...s,
        service: s.id,
        isManual: true,
        price: calculateManualServicePriceEgp(s, tiktokUsdRate, globalDiscountConfig),
        price_egp: calculateManualServicePriceEgp(s, tiktokUsdRate, globalDiscountConfig),
        appCategory: getAppCat(s.category || "", s.name || ""),
      })),
    ...Object.values(manualSvcs)
      .filter((s: any) => !["tiktok_superfan", "tiktok_hidden_w", "tiktok_hidden_m"].includes(s.id) && !s.disabled && s.status !== "disabled" && s.active !== false)
      .map((s: any) => ({
        ...s,
        service: s.id,
        name: s.name,
        category: s.category || "أخرى",
        isManual: true,
        price: calculateManualServicePriceEgp(s, tiktokUsdRate, globalDiscountConfig),
        price_egp: calculateManualServicePriceEgp(s, tiktokUsdRate, globalDiscountConfig),
        min: Number(s.min || 1),
        max: Number(s.max || 1),
        min_quantity: Number(s.min || 1),
        max_quantity: Number(s.max || 1),
        appCategory: getAppCat(s.category || "", s.name || ""),
        categoryInstructions: categoryInstructions[s.category || ""] || categoryInstructions[getAppCat(s.category || "", s.name || "")] || "",
        categoryAlert: categoryAlerts[s.category || ""] || categoryAlerts[getAppCat(s.category || "", s.name || "")] || "",
      })),
  ];

  let displayServices = allServices.filter(
    (s: any) => s.appCategory === category && !s.disabled && s.status !== "disabled" && s.active !== false,
  );

  if (category === "tiktok") {
    displayServices = [
      {
        service: "tiktok_coins_calc",
        name: "شحن عملات تيك توك",
        category: "شحن العملات",
        isManual: true,
        price: 0,
        min,
        max,
        appCategory: "tiktok",
        instructions: manualSvcs["tiktok_coins_calc"]?.instructions || manualSvcs["tiktok_coins"]?.instructions || "",
        alertNote: manualSvcs["tiktok_coins_calc"]?.alertNote || manualSvcs["tiktok_coins"]?.alertNote || "",
        categoryInstructions: categoryInstructions["شحن عملات تيك توك"] || categoryInstructions["شحن العملات"] || categoryInstructions["تيك توك"] || categoryInstructions["tiktok"] || "",
        categoryAlert: categoryAlerts["شحن عملات تيك توك"] || categoryAlerts["شحن العملات"] || categoryAlerts["تيك توك"] || categoryAlerts["tiktok"] || "",
      },
      ...displayServices,
    ];
  }

  const seenServiceNames = new Set<string>();
  displayServices = displayServices.filter((s: any) => {
    const key = (s.name || s.id || "").trim().toLowerCase();
    if (seenServiceNames.has(key)) return false;
    seenServiceNames.add(key);
    return true;
  });

  return (
    <motion.div
      className="service-page-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ServicesPanel
        usdRate={tiktokUsdRate}
        sarRate={sarRate}
        siteSettings={{}}
        services={displayServices}
        tabInfo={tabInfo}
        userProfile={p}
        renderCustomService={(id: any) => {
          if (id === "tiktok_coins_calc") {
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 20,
                  padding: 16,
                  border: "1px solid var(--border-accent)",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                }}
              >


                <div className="tiktok-inputs" style={{ marginBottom: 12 }}>
                  <div className="graffiti-input-group" style={{ width: "100%" }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: "bold", color: "#cbd5e1", marginBottom: 8 }}>
                      🪙 كمية العملات المطلوبة
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="auto"
                      placeholder="1000"
                      value={coins}
                      onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val.includes('.')) {
                          val = val.split('.')[0];
                          e.target.value = val;
                        }
                        hc(val);
                      }}
                      onBlur={() => {
                        const n = Number(coins);
                        if (n > 0 && n < min) hc(min.toString());
                      }}
                      className="graffiti-input w-full h-13 px-5 py-3.5 bg-input border border-border rounded-2xl text-foreground font-mono text-base bidi-plaintext"
                      disabled={!tiers.length}
                      style={{ unicodeBidi: "plaintext" }}
                    />
                    {coins && nc < min && (
                      <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8, padding: "0 12px", display: "flex", alignItems: "center", gap: 4 }}>
                        الكمية أقل من الحد الأدنى ({min})
                      </div>
                    )}
                    {coins && nc > max && (
                      <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8, padding: "0 12px", display: "flex", alignItems: "center", gap: 4 }}>
                        الكمية تتجاوز الحد الأقصى ({max})
                      </div>
                    )}
                    {price && Number(price) > 0 && (
                      <div className="flex flex-col gap-2.5 mt-3">
                        <div style={{ fontSize: 14, color: "#38bdf8", fontWeight: "bold", background: "rgba(56,189,248,0.08)", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(56,189,248,0.2)" }} className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span>💵 السعر الإجمالي:</span>
                            {originalPrice && Number(originalPrice) > Number(price) + 0.01 && (
                              <span className="text-red-400/90 line-through text-sm font-mono font-bold decoration-red-500 decoration-2" dir="ltr">
                                {convertPrice(Number(originalPrice)).formatted}
                              </span>
                            )}
                            <strong className="text-emerald-400 text-lg font-mono font-black" dir="ltr">
                              {convertPrice(Number(price)).formatted}
                            </strong>
                          </div>
                        </div>

                        <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: "bold", background: "rgba(251,191,36,0.08)", padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(251,191,36,0.25)" }} className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-amber-400 font-extrabold text-xs md:text-sm">💳 السعر برسوم الإيداع =</span>
                          <strong className="text-amber-300 text-base md:text-lg font-mono font-black" dir="ltr">
                            {selectedCurrency === "USD" 
                              ? convertPrice(grossDepositRequiredForNet(Number(price), getMethodFeePercent("wallet", pricingSettings), 2)).formatted
                              : isolateLtr(`${Math.round(convertPrice(grossDepositRequiredForNet(Number(price), getMethodFeePercent("wallet", pricingSettings), 0)).amount)} ${convertPrice(Number(price)).symbol}`)
                            }
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  {(() => {
                    const coinsSvc = displayServices.find((s: any) => s.service === "tiktok_coins_calc");
                    const alertText = coinsSvc?.alertNote || coinsSvc?.notice || coinsSvc?.categoryAlert || categoryAlerts["شحن عملات تيك توك"] || categoryAlerts["تيك توك"] || "";
                    const instrText = coinsSvc?.instructions || coinsSvc?.shippingInstructions || coinsSvc?.categoryInstructions || categoryInstructions["شحن عملات تيك توك"] || categoryInstructions["تيك توك"] || "";
                    return (
                      <div className="space-y-4 mb-4">
                        {alertText && (
                          <div className="bg-gradient-to-br from-amber-950/70 via-amber-900/35 to-slate-950 border-2 border-amber-500/60 text-amber-100 p-5 md:p-6 rounded-2xl text-right shadow-[0_0_30px_rgba(245,158,11,0.25)] relative overflow-hidden backdrop-blur-md">
                            <div className="flex items-center gap-3 text-amber-400 font-black text-base md:text-lg mb-2.5">
                              <AlertCircle size={24} className="text-amber-400 shrink-0 animate-pulse" />
                              <span>⚠️ تنبيه وملاحظة هامة جداً:</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-line text-sm md:text-base text-amber-100 font-bold pr-1">
                              {alertText}
                            </div>
                          </div>
                        )}

                        {instrText && (
                          <div className="bg-gradient-to-br from-cyan-950/70 via-cyan-900/35 to-slate-950 border-2 border-cyan-500/60 text-cyan-100 p-5 md:p-6 rounded-2xl text-right shadow-[0_0_30px_rgba(6,182,212,0.25)] relative overflow-hidden backdrop-blur-md">
                            <div className="flex items-center gap-3 text-cyan-400 font-black text-base md:text-lg mb-2.5">
                              <Info size={24} className="text-cyan-400 shrink-0" />
                              <span>📋 تعليمات الشحن وتطبيق الطلب:</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-line text-sm md:text-base text-slate-100 font-bold pr-1">
                              {instrText}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    disabled={!ok}
                    className="w-full min-h-[52px] py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 font-black text-base text-slate-950 transition-all shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"
                    onClick={() => {
                      const coinsSvc = displayServices.find((s: any) => s.service === "tiktok_coins_calc");
                      setCheckoutService({
                        id: "tiktok_coins",
                        name: "شحن عملات تيك توك",
                        price_egp: Number(price),
                        price: Number(price),
                        instructions: coinsSvc?.instructions || "",
                        alertNote: coinsSvc?.alertNote || "",
                        categoryInstructions: coinsSvc?.categoryInstructions || categoryInstructions["شحن عملات تيك توك"] || "",
                        categoryAlert: coinsSvc?.categoryAlert || categoryAlerts["شحن عملات تيك توك"] || "",
                      });
                    }}
                  >
                    <Send size={19} className="shrink-0" /> إتمام الدفع ⚡
                  </button>
                </div>
              </motion.div>
            );
          }
          return null;
        }}
      />
      {checkoutService && (
        <CheckoutModal
          service={checkoutService}
          quantity={Number(coins)}
          priceEGP={Number(price)}
          link=""
          settings={{ smm_usd_rate: smmRate, usd_rate: tiktokUsdRate }}
          userProfile={p}
          onClose={() => setCheckoutService(null)}
          useBalance
        />
      )}
    </motion.div>
  );
}
