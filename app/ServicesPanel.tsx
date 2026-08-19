"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Send,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Search,
  X,
  ShoppingCart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import CheckoutModal from "./components/CheckoutModal";
import { useCurrency } from "./lib/currency-context";
import { useCart } from "./lib/cart-context";
import { useDevicePlatform } from "@/app/lib/useDevicePlatform";
import {
  calculateManualServicePriceEgp,
  calculateManualServiceOriginalPriceEgp,
  getManualServicePriceUsd,
} from "@/lib/pricing/manual-service";
import { isGlobalUsdDiscountActive } from "@/lib/pricing/pricing-discount";
import { grossDepositRequiredForNet, getMethodFeePercent } from "@/lib/money/wallet";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

const getGameBadge = (catName: string) => {
  const c = catName.toLowerCase();
  if (c.includes("pubg") || c.includes("ببجي")) return "🎮 ببجي موبايل";
  if (c.includes("free fire") || c.includes("فري فاير")) return "🔥 فري فاير";
  if (c.includes("yalla ludo") || c.includes("يلا لودو")) return "🎲 يلا لودو";
  if (c.includes("8 ball")) return "🎱 8 Ball Pool";
  if (c.includes("mobile legend") || c.includes("موبايل ليجندز")) return "⚔️ موبايل ليجندز";
  if (c.includes("jawaker") || c.includes("جواكر")) return "🃏 جواكر";
  if (c.includes("ludo club") || c.includes("لودو كلوب")) return "🎲 لودو كلوب";
  if (c.includes("genshin") || c.includes("جينشين")) return "💎 جينشين إمباكت";
  if (c.includes("crossfire") || c.includes("كروس فاير")) return "🔫 كروس فاير";
  if (c.includes("conquer") || c.includes("كونكر")) return "⚔️ كونكر أونلاين";
  return `🎮 ${catName}`;
};

function CustomDropdown({ options, value, onChange, placeholder, isOpen: externalIsOpen, onToggle, onClose: externalOnClose }: any) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const toggle = onToggle ? onToggle : () => setInternalIsOpen((prev) => !prev);
  const close = () => {
    if (externalOnClose) externalOnClose();
    setInternalIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const filtered = options.filter((o: any) =>
    o.searchText
      ? o.searchText.toLowerCase().includes(search.toLowerCase())
      : o.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedOption = options.find((o: any) => o.value === value);
  const selectedLabel = selectedOption?.label || placeholder;

  return (
    <div ref={ref} className={`relative w-full ${isOpen ? "z-[100]" : "z-1"}`}>
      {/* Trigger Button */}
      <button
        type="button"
        className="w-full min-h-[58px] px-5 py-4 rounded-2xl bg-gradient-to-r from-[#0d1627] via-[#111c34] to-[#0d1627] border border-cyan-500/25 flex justify-between items-center gap-3.5 cursor-pointer shadow-lg shadow-black/40 transition-all duration-300 hover:border-cyan-400/60 hover:shadow-cyan-500/15 text-right group active:scale-[0.99]"
        onClick={toggle}
        dir="rtl"
      >
        <div className="flex justify-between items-center flex-1 min-w-0 px-2 sm:px-3">
          <span
            dir="auto"
            className="break-words text-sm font-extrabold text-right leading-relaxed flex-1 py-1 px-2 tracking-wide"
            style={{ color: value ? "var(--foreground)" : "var(--muted-foreground)", unicodeBidi: "plaintext" }}
          >
            <bdi>{selectedLabel}</bdi>
          </span>
          {selectedOption?.price && (
            <span className="text-cyan-400 font-black mr-3 ml-1 shrink-0 text-[13px] bg-cyan-500/10 border border-cyan-500/25 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm" dir="ltr" style={{ unicodeBidi: "isolate" }}>
              {selectedOption.originalPrice && (
                <span className="text-[11px] text-red-400 line-through opacity-75 font-mono">
                  {selectedOption.originalPrice}
                </span>
              )}
              <bdi>{selectedOption.price}</bdi>
            </span>
          )}
        </div>
        <ChevronDown size={19} className={`text-cyan-400 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu - Styled & Touch-Friendly */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full left-0 right-0 z-[999] bg-[#090f1d]/98 backdrop-blur-2xl border border-cyan-500/35 rounded-2xl mt-2 max-h-[360px] overflow-y-auto shadow-2xl shadow-black/95 p-3 text-right"
            dir="rtl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Search Input inside dropdown */}
            <div className="p-3 sticky top-0 bg-[#0c1322]/98 backdrop-blur-md z-20 border-b border-[#263b5f]/70 rounded-t-xl mb-2">
              <div className="relative flex items-center">
                <input
                  type="search"
                  inputMode="search"
                  placeholder="ابحث عن الخدمة أو الباقة..."
                  dir="rtl"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-12 rounded-xl border border-[#263b5f] bg-[#111b2e] py-3 px-5 pr-4 pl-11 text-sm text-foreground placeholder:text-slate-400 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-right shadow-inner"
                  style={{ unicodeBidi: "plaintext" }}
                />
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="flex flex-col gap-2 p-1">
              {filtered.map((o: any) => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    close();
                    setSearch("");
                  }}
                  className={`min-h-[56px] w-full cursor-pointer rounded-2xl border px-5 py-3.5 text-right transition-all duration-200 active:scale-[0.99] ${
                    o.value === value
                      ? "border-cyan-400/60 bg-gradient-to-r from-[#15324a] to-[#12283b] shadow-md shadow-cyan-950/40"
                      : "border-[#1e3050] bg-[#111b2e]/90 hover:border-cyan-500/40 hover:bg-[#17263f] active:bg-[#1c3050]"
                  }`}
                  dir="rtl"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <bdi
                        dir="auto"
                        className={`block whitespace-normal break-words text-right leading-relaxed text-sm ${
                          o.value === value
                            ? "font-black text-cyan-300"
                            : "font-bold text-foreground"
                        }`}
                        style={{ unicodeBidi: "plaintext" }}
                      >
                        {o.label}
                      </bdi>
                      {o.desc && (
                        <bdi
                          dir="auto"
                          className="mt-1 block text-xs leading-relaxed text-muted-foreground/80 font-normal"
                          style={{ unicodeBidi: "plaintext" }}
                        >
                          {o.desc}
                        </bdi>
                      )}
                    </span>
                    {o.price && (
                      <span
                        className="shrink-0 rounded-xl bg-[#0a1929] border border-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-400 flex items-center gap-1.5 shadow-sm"
                        dir="ltr"
                        style={{ unicodeBidi: "isolate" }}
                      >
                        {o.originalPrice && (
                          <span className="text-[10px] text-red-400 line-through opacity-75 font-mono">
                            {o.originalPrice}
                          </span>
                        )}
                        <bdi>{o.price}</bdi>
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm font-semibold text-slate-400">
                  🔍 لا توجد نتائج مطابقة لبحثك
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ServicesPanel({
  usdRate,
  sarRate,
  siteSettings,
  services,
  tabInfo,
  renderCustomService,
  userProfile,
}: any) {
  const { convertPrice, selectedCurrency } = useCurrency();
  const { isAndroid, isIOS } = useDevicePlatform();
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<"cat" | "srv" | null>(null);

  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [globalDiscountConfig, setGlobalDiscountConfig] = useState<{ enabled: boolean; discountPercent: number; maxDiscountUsd?: number; expiresAt?: string | null }>({ enabled: false, discountPercent: 0 });

  useEffect(() => {
    getDoc(doc(db, "settings", "pricing")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalDiscountConfig({
          enabled: Boolean(data?.global_usd_discount_enabled ?? data?.globalUsdDiscountEnabled),
          discountPercent: Number(data?.global_usd_discount_percent ?? data?.globalUsdDiscountPercent ?? 0),
          maxDiscountUsd: Number(data?.global_usd_discount_max_amount ?? data?.globalUsdDiscountMaxAmount ?? data?.max_discount_usd ?? data?.maxDiscountUsd ?? 0),
          expiresAt: data?.global_usd_discount_expires_at ?? data?.globalUsdDiscountExpiresAt ?? null,
        });
      }
    }).catch(console.error);
  }, []);

  const activeServices = useMemo(() => {
    return (services || []).filter((s: any) => {
      if (s.disabled === true || s.status === "disabled" || s.active === false) return false;
      return true;
    });
  }, [services]);

  const categories = useMemo(() => {
    return Array.from(new Set(activeServices.map((s: any) => s.category).filter(Boolean)));
  }, [activeServices]);

  useEffect(() => {
    if (categories.length > 0) {
      if (!categories.includes(selectedCat)) {
        setSelectedCat(categories[0] as string);
      }
    } else {
      setSelectedCat("");
    }
  }, [categories, selectedCat]);

  const filteredServices = useMemo(() => {
    return activeServices.filter((s: any) => s.category === selectedCat);
  }, [activeServices, selectedCat]);

  useEffect(() => {
    if (filteredServices.length > 0) {
      const exists = filteredServices.some(
        (s: any) => String(s.service || s.id) === String(selectedServiceId)
      );
      if (!exists) {
        setSelectedServiceId(filteredServices[0].service || filteredServices[0].id || "");
      }
    } else {
      setSelectedServiceId("");
    }
  }, [filteredServices, selectedServiceId]);

  const selectedService = useMemo(() => {
    return filteredServices.find(
      (s: any) => String(s.service) === String(selectedServiceId),
    );
  }, [filteredServices, selectedServiceId]);

  const isTikTokCoins = selectedService?.name?.includes("عملات") && (selectedService?.name?.includes("تيك توك") || selectedService?.name?.includes("تيك تيك"));
  const isSecretSub = selectedService?.name?.includes("اشتراك مخفي") || selectedService?.name?.includes("سوبر فان") || (selectedService?.name?.includes("اشتراك") && (selectedService?.category === "اشتراكات" || selectedService?.name?.includes("تيك توك") || selectedService?.name?.includes("تيك تيك")));
  const isGame = tabInfo?.id === "games";
  const isJaco = selectedService?.name?.includes("JACO") || selectedService?.name?.includes("جاكو") || selectedService?.category?.includes("JACO") || selectedService?.category?.includes("جاكو");
  const isChatGPT = selectedService?.name?.toLowerCase().includes("chatgpt") || selectedService?.category?.toLowerCase().includes("chatgpt") || selectedService?.category?.includes("شات جي بي تي");
  const isTelegram = selectedService?.name?.includes("Telegram") || selectedService?.name?.includes("تليجرام") || selectedService?.category?.includes("Telegram") || selectedService?.category?.includes("تليجرام");
  const isPromo = selectedService?.name?.includes("ترويج") || selectedService?.category?.includes("ترويج");
  const isTikTokPromo = isPromo && (selectedService?.appCategory === "tiktok" || selectedService?.service === "tiktok_promo" || selectedService?.name?.includes("تيك توك"));
  const isOther = (tabInfo?.id === "other" || selectedService?.appCategory === "other" || selectedService?.category === "أخرى" || selectedService?.category === "اشتراكات") && !isJaco && !isChatGPT && !isTelegram && !isPromo;
  const hideLinkInput = isTikTokCoins || isSecretSub || isOther || isChatGPT;

  const minQ = selectedService ? Number(selectedService.min) : 0;
  const maxQ = selectedService ? Number(selectedService.max) : 0;

  const isTelegramStars = selectedService?.id === "tg_stars_custom" || selectedService?.service === "tg_stars_custom" || selectedService?.name?.includes("نجوم تليجرام") || selectedService?.name?.includes("Telegram Stars");
  const isFixedPackage = isGame || isSecretSub || isJaco || isChatGPT || (isTelegram && !isTelegramStars) || (minQ === 1 && maxQ === 1) || (selectedService?.isManual && !isTelegramStars);

  const effectiveQuantity = isFixedPackage && !isPromo
    ? "1"
    : quantity;

  const pricePer1000EGP = useMemo(() => {
    if (!selectedService) return 0;
    if (selectedService.isManual) {
      return calculateManualServicePriceEgp(selectedService, Number(usdRate), globalDiscountConfig);
    }
    const S = parseFloat(selectedService.rate);
    const D = Number(usdRate);
    const globalPercent = globalDiscountConfig.enabled ? Math.min(100, Math.max(0, globalDiscountConfig.discountPercent)) : 0;
    const effectiveS = S * (1 - globalPercent / 100);
    const base = effectiveS * (D + 4);
    const rawPrice = base * 1.005;
    return rawPrice;
  }, [selectedService, usdRate, globalDiscountConfig, isGame]);

  const originalPricePer1000EGP = useMemo(() => {
    if (!selectedService) return 0;
    if (selectedService.isManual) {
      return calculateManualServiceOriginalPriceEgp(selectedService, Number(usdRate));
    }
    const S = parseFloat(selectedService.rate);
    const D = Number(usdRate);
    const base = S * (D + 4);
    const rawPrice = base * 1.005;
    return rawPrice;
  }, [selectedService, usdRate, isGame]);

  const finalPrice = useMemo(() => {
    // For promo services: user enters the quantity (units), price computed from admin/unit pricing
    if (isPromo) {
      const q = Number(quantity);
      if (isNaN(q) || q <= 0) return 0;
      let rawVal = 0;
      if (selectedService?.isManual) {
        if (selectedService?.id === "tg_stars_custom" || selectedService?.service === "tg_stars_custom" || selectedService?.name?.includes("نجوم تليجرام") || selectedService?.name?.includes("Telegram Stars")) {
          const priceFor50Usd = (Number(selectedService.priceUsd ?? selectedService.price_usd) || 0.92);
          const ratePerStarUsd = priceFor50Usd / 50;
          rawVal = q * ratePerStarUsd * Number(usdRate);
        } else {
          rawVal = q * pricePer1000EGP;
        }
      } else if (selectedService?.type === "Package") {
        rawVal = q * pricePer1000EGP;
      } else {
        rawVal = (q * pricePer1000EGP) / 1000;
      }
      return Math.ceil(((rawVal) - 1e-9) * 100) / 100;
    }
    const q = Number(effectiveQuantity);
    if (isNaN(q) || q <= 0) return 0;
    let rawVal = 0;
    if (selectedService?.isManual) {
      if (selectedService?.id === "tg_stars_custom" || selectedService?.service === "tg_stars_custom" || selectedService?.name?.includes("نجوم تليجرام") || selectedService?.name?.includes("Telegram Stars")) {
        const priceFor50Usd = (Number(selectedService.priceUsd ?? selectedService.price_usd) || 0.92);
        const ratePerStarUsd = priceFor50Usd / 50;
        rawVal = q * ratePerStarUsd * Number(usdRate);
      } else {
        rawVal = q * pricePer1000EGP;
      }
    } else if (selectedService?.type === "Package") {
      rawVal = q * pricePer1000EGP;
    } else {
      rawVal = (q * pricePer1000EGP) / 1000;
    }
    return Math.ceil(((rawVal) - 1e-9) * 100) / 100;
  }, [effectiveQuantity, isPromo, pricePer1000EGP, quantity, selectedService, usdRate]);

  const originalFinalPrice = useMemo(() => {
    // For promo services: original price is computed from original per-unit price
    if (isPromo) {
      const q = Number(quantity);
      if (isNaN(q) || q <= 0) return 0;
      let rawVal = 0;
      if (selectedService?.isManual) {
        if (selectedService?.id === "tg_stars_custom" || selectedService?.service === "tg_stars_custom" || selectedService?.name?.includes("نجوم تليجرام") || selectedService?.name?.includes("Telegram Stars")) {
          const priceFor50Usd = (Number(selectedService.priceUsd ?? selectedService.price_usd) || 0.92);
          const ratePerStarUsd = priceFor50Usd / 50;
          rawVal = q * ratePerStarUsd * Number(usdRate);
        } else {
          rawVal = q * originalPricePer1000EGP;
        }
      } else if (selectedService?.type === "Package") {
        rawVal = q * originalPricePer1000EGP;
      } else {
        rawVal = (q * originalPricePer1000EGP) / 1000;
      }
      return Math.ceil(((rawVal) - 1e-9) * 100) / 100;
    }
    const q = Number(effectiveQuantity);
    if (isNaN(q) || q <= 0) return 0;
    let rawVal = 0;
    if (selectedService?.isManual) {
      if (selectedService?.id === "tg_stars_custom" || selectedService?.service === "tg_stars_custom" || selectedService?.name?.includes("نجوم تليجرام") || selectedService?.name?.includes("Telegram Stars")) {
        const priceFor50Usd = (Number(selectedService.priceUsd ?? selectedService.price_usd) || 0.92);
        const ratePerStarUsd = priceFor50Usd / 50;
        rawVal = q * ratePerStarUsd * Number(usdRate);
      } else {
        rawVal = q * originalPricePer1000EGP;
      }
    } else if (selectedService?.type === "Package") {
      rawVal = q * originalPricePer1000EGP;
    } else {
      rawVal = (q * originalPricePer1000EGP) / 1000;
    }
    return Math.ceil(((rawVal) - 1e-9) * 100) / 100;
  }, [effectiveQuantity, originalPricePer1000EGP, selectedService, usdRate]);

  const { addToCart } = useCart();

  const handleAddToCart = () => {
    let finalQ = effectiveQuantity;
    if (isSecretSub) finalQ = String(selectedService?.min > 0 ? selectedService.min : 1);
    if (!selectedService || !finalQ || (!hideLinkInput && !link) || finalPrice <= 0 || isInvalid) return;

    addToCart({
      serviceId: String(selectedService.service || selectedService.id || "service"),
      serviceName: selectedService.name,
      categoryName: String(tabInfo?.label || selectedService.category || "قسم"),
      quantity: Number(finalQ),
      link,
      totalPriceEgp: finalPrice,
      unitPrice: pricePer1000EGP,
      isManual: selectedService.isManual,
    });
  };

  const handleOrder = () => {
    let finalQ = effectiveQuantity;
    if (isSecretSub) finalQ = String(selectedService?.min > 0 ? selectedService.min : 1);
    
    if (!selectedService || !finalQ || (!hideLinkInput && !link)) return;
    setQuantity(finalQ);
    setShowCheckout(true);
  };

  // For promo: compute EGP budget limits from quantity × price
  const promoMinEgp = isPromo ? Math.ceil(minQ * pricePer1000EGP / 1000) : 0;
  const promoMaxEgp = isPromo ? Math.floor(maxQ * pricePer1000EGP / 1000) : 0;

  const qNum = isPromo ? Number(quantity) : Number(effectiveQuantity);
  const isInvalid = isGame
    ? false
    : isPromo
      ? !quantity || isNaN(qNum) || qNum < minQ || qNum > maxQ
      : !effectiveQuantity || isNaN(qNum) || qNum < minQ || qNum > maxQ;

  const catOptions = categories.map((c) => ({
    value: c,
    label: c as string,
    searchText: c as string,
  }));
  const srvOptions = filteredServices
    .map((s: any) => {
      let p = 0;
      if (s.isManual) {
        p = calculateManualServicePriceEgp(s, Number(usdRate), globalDiscountConfig);
      } else {
        const S = parseFloat(s.rate);
        const D = Number(usdRate);
        const isDiscountActive = isGlobalUsdDiscountActive(globalDiscountConfig);
        const globalPercent = isDiscountActive ? Math.min(100, Math.max(0, globalDiscountConfig.discountPercent)) : 0;
        const effectiveS = S * (1 - globalPercent / 100);
        const base = effectiveS * (D + 4);
        p = base * 1.005;
      }
      const displayP = convertPrice(p);
      const isTgStars = s.id === "tg_stars_custom" || s.service === "tg_stars_custom" || s.name?.includes("نجوم تليجرام") || s.name?.includes("Telegram Stars");
      let originalP = p;
      if (s.isManual) {
        originalP = calculateManualServiceOriginalPriceEgp(s, Number(usdRate));
      } else {
        const S = parseFloat(s.rate);
        const D = Number(usdRate);
        const base = S * (D + 4);
        originalP = base * 1.005;
      }
      const hasDiscount = originalP > p + 0.01;

      return {
        value: s.service,
        label: s.name,
        desc: s.description || "",
        numericPrice: p,
        isManual: !!s.isManual,
        price: isTgStars ? "" : displayP.formatted,
        originalPrice: isTgStars || !hasDiscount ? "" : convertPrice(originalP).formatted,
        searchText: `${s.name} ${s.description || ""} ${isTgStars ? "" : `${p} ج.م`}`,
      };
    })
    .filter((o: any) => {
      if (o.disabled === true || o.status === "disabled" || o.active === false) return false;
      return o.isManual ? o.numericPrice > 0 : o.numericPrice >= 5;
    });

  return (
    <motion.div
      className={`service-panel-modern platform-card p-6 md:p-8 ${
        isAndroid
          ? "rounded-[28px] bg-[#172030] border border-white/10 shadow-2xl"
          : isIOS
          ? "rounded-[26px] bg-slate-950/75 border border-white/15 backdrop-blur-2xl shadow-2xl shadow-black/80"
          : "rounded-3xl bg-slate-950/80 border border-cyan-500/25 backdrop-blur-xl shadow-2xl hover:border-cyan-500/45 transition-all duration-300"
      }`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.div
        className="panel-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          borderBottom: `2px solid ${tabInfo?.color || "#00ffff"}`,
          paddingBottom: 16,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: 0,
            color: tabInfo?.color || "#fff",
          }}
        >
          {tabInfo?.icon} {tabInfo?.label}
        </h2>
      </motion.div>

      <motion.div
        className="panel-body"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.08 } },
        }}
      >
        {services.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              color: "#fff",
              textAlign: "center",
              marginTop: 40,
              padding: 40,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 12,
            }}
          >
            لا توجد خدمات متاحة في هذا القسم حالياً.
          </motion.div>
        ) : (
          <>
            {(tabInfo?.id === "games" || tabInfo?.id === "other" ? catOptions.length > 0 : catOptions.length > 1) && (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className={`mb-6 text-right ${activeDropdown === "cat" ? "relative z-30" : "relative z-10"}`}
              >
                <label className="block text-muted-foreground font-semibold text-sm mb-2.5">
                  {tabInfo?.id === "games" ? "اختر اللعبة 🎮" : tabInfo?.id === "other" ? "القسم / الخدمة 🎯" : "القسم"}
                </label>
                <CustomDropdown
                  options={catOptions}
                  value={selectedCat}
                  onChange={(val: string) => {
                    setSelectedCat(val);
                    setActiveDropdown(null);
                  }}
                  placeholder="اختر القسم..."
                  isOpen={activeDropdown === "cat"}
                  onToggle={() => setActiveDropdown((prev) => (prev === "cat" ? null : "cat"))}
                  onClose={() => setActiveDropdown(null)}
                />
              </motion.div>
            )}

            {srvOptions.length > 0 && (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className={`mb-6 text-right ${activeDropdown === "srv" ? "relative z-30" : "relative z-0"}`}
              >
                <label className="block text-muted-foreground font-semibold text-sm mb-2">
                  {tabInfo?.id === "games" ? "اختر الباقة 🎯" : "الخدمة / الباقة"}
                </label>
                <CustomDropdown
                  options={srvOptions}
                  value={selectedServiceId}
                  onChange={(val: string) => {
                    setSelectedServiceId(val);
                    setActiveDropdown(null);
                  }}
                  placeholder="اختر الباقة..."
                  isOpen={activeDropdown === "srv"}
                  onToggle={() => setActiveDropdown((prev) => (prev === "srv" ? null : "srv"))}
                  onClose={() => setActiveDropdown(null)}
                />
              </motion.div>
            )}

            {renderCustomService && renderCustomService(selectedServiceId) ? (
              renderCustomService(selectedServiceId)
            ) : (
              <>
                {selectedService && (
                  <div className="mb-6 px-1">
                    {selectedService.description && (
                      <div className="bg-background/50 border border-border/80 p-5 rounded-2xl text-right text-sm text-muted-foreground leading-relaxed mb-4 px-5 py-4 shadow-inner">
                        📋 {selectedService.description}
                      </div>
                    )}
                    {selectedService.isManual && Number(getManualServicePriceUsd(selectedService)) > 10 && Number(selectedService.discountPercent ?? selectedService.discount_percent ?? 0) > 0 && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-4 py-2.5 rounded-xl text-right mb-4 flex items-center justify-between gap-3">
                        <span>🏷️ تم تطبيق خصم خاص لهذا العرض!</span>
                        <span className="bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-lg">
                          -{selectedService.discountPercent ?? selectedService.discount_percent}%
                        </span>
                      </div>
                    )}
                    {selectedService && originalFinalPrice > finalPrice + 1e-4 && (
                      <div className="mb-4 flex items-center justify-end gap-2.5 px-1 text-xs text-muted-foreground">
                        <span className="text-red-400/90 line-through font-mono font-bold decoration-red-500 decoration-2 text-sm">{convertPrice(originalFinalPrice).formatted}</span>
                        <span className="text-emerald-400 font-black text-base">{convertPrice(finalPrice).formatted}</span>
                        <span className="text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">السعر بعد الخصم 🔥</span>
                      </div>
                    )}
                    {!isGame && <div
                      className="text-sm font-bold text-right flex items-center justify-end gap-2.5 px-2 py-1"
                      style={{ color: tabInfo?.color || 'var(--primary)' }}
                    >
                      الحد الأدنى: <span className="font-mono bg-background/60 px-3 py-1 rounded-lg border border-border/40">{minQ}</span>
                      <span className="text-border mx-1.5">|</span>
                      الحد الأقصى: <span className="font-mono bg-background/60 px-3 py-1 rounded-lg border border-border/40">{maxQ}</span>
                    </div>}
                  </div>
                )}

                {!hideLinkInput && (
                  <div className="mb-6 text-right px-1">
                    <label className="block text-muted-foreground font-semibold text-sm mb-2.5 pr-2 pl-2">
                      {tabInfo?.id === "games"
                        ? "آيدي الحساب (Player ID)"
                        : isJaco
                          ? "اسم المستخدم JACO (Username)"
                          : isTelegram
                            ? "يوزر التليجرام (Telegram Username)"
                            : isTikTokPromo
                              ? "رابط حساب تيك توك المراد ترويجه"
                              : isPromo
                                ? "رابط الحساب / المنشور المراد ترويجه"
                                : tabInfo?.id === "other" || selectedService?.isManual
                                  ? "البريد الإلكتروني / رقم الهاتف / الحساب"
                                  : "الرابط (Link) / اليوزر"}
                    </label>
                    <input
                      type="text"
                      className="w-full h-14 px-5 py-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-foreground focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 outline-none transition-all font-mono text-base bidi-plaintext shadow-inner"
                      dir="auto"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder={
                        tabInfo?.id === "games"
                          ? "5123456789"
                          : isJaco || isTelegram
                            ? "@username"
                            : isTikTokPromo
                              ? "https://www.tiktok.com/@username"
                              : isPromo
                                ? "https://..."
                                : tabInfo?.id === "other" || selectedService?.isManual
                                  ? "user@example.com"
                                  : "https://..."
                      }
                      style={{ unicodeBidi: "plaintext" }}
                    />
                    <div className="text-muted-foreground/80 text-xs mt-2.5 flex items-center gap-1.5 justify-end px-2">
                      <AlertCircle size={13} className="text-cyan-400" />
                      {tabInfo?.id === "games"
                        ? "أدخل الآيدي بشكل صحيح."
                        : isJaco
                          ? "أدخل اسم المستخدم (اليوزر) الخاص بحسابك في تطبيق جاكو."
                          : isTelegram
                            ? "أدخل يوزر حساب التليجرام (@username) المراد تفعيل الاشتراك عليه."
                            : isTikTokPromo
                              ? "ضع رابط حساب تيك توك أو رابط الفيديو المراد ترويجه."
                              : isPromo
                                ? "ضع رابط الحساب أو المنشور المراد ترويجه على المنصة."
                                : tabInfo?.id === "other" || selectedService?.isManual
                                  ? "أدخل البريد الإلكتروني أو رقم الهاتف أو بيانات الحساب المطلوب التفعيل عليها."
                                  : "ضع الرابط الصحيح للترويج أو يوزر الحساب."}
                    </div>
                  </div>
                )}

                {(!isFixedPackage || isPromo) && (
                  <div className="mb-6 text-right px-1">
                    <label className="block text-muted-foreground font-semibold text-sm mb-2.5 pr-2 pl-2">
                      {isPromo ? "الكمية المطلوبة (وحدة)" : "الكمية المطلوبة"}
                    </label>
                    <input
                      type="number"
                      className="w-full h-14 px-5 py-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-foreground focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 outline-none transition-all font-mono text-base bidi-plaintext shadow-inner"
                      dir="auto"
                      value={quantity}
                      onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val.includes('.')) {
                          val = val.split('.')[0];
                          e.target.value = val;
                        }
                        setQuantity(val);
                      }}
                      placeholder={isPromo ? `${minQ}` : String(minQ)}
                      min={minQ}
                      max={maxQ}
                      step={"1"}
                      style={{ unicodeBidi: "plaintext" }}
                    />
                    {quantity && qNum < minQ && isPromo && (
                      <div className="text-destructive text-xs mt-2.5 flex items-center justify-end gap-1.5 px-2">
                        <AlertCircle size={13} /> {`الكمية أقل من الحد الأدنى (${minQ}) — تقابل ${convertPrice(promoMinEgp).formatted}`}
                      </div>
                    )}
                    {quantity && qNum < minQ && !isPromo && (
                      <div className="text-destructive text-xs mt-2.5 flex items-center justify-end gap-1.5 px-2">
                        <AlertCircle size={13} /> {`الكمية أقل من الحد الأدنى (${minQ})`}
                      </div>
                    )}
                    {quantity && qNum > maxQ && isPromo && (
                      <div className="text-destructive text-xs mt-2.5 flex items-center justify-end gap-1.5 px-2">
                        <AlertCircle size={13} /> {`الكمية تتجاوز الحد الأقصى (${maxQ}) — تقابل ${convertPrice(promoMaxEgp).formatted}`}
                      </div>
                    )}
                    {quantity && qNum > maxQ && !isPromo && (
                      <div className="text-destructive text-xs mt-2.5 flex items-center justify-end gap-1.5 px-2">
                        <AlertCircle size={13} /> {`الكمية تتجاوز الحد الأقصى (${maxQ})`}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 my-6">
                  {/* السعر الإجمالي */}
                  <div
                    className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 p-4 px-6 rounded-2xl border flex justify-between items-center shadow-xl backdrop-blur-xl"
                    style={{ borderColor: `${tabInfo?.color || 'var(--primary)'}45` }}
                  >
                    <span className="text-slate-300 font-extrabold text-sm md:text-base px-1">💵 السعر الإجمالي:</span>
                    <div className="flex items-center gap-3">
                      {originalFinalPrice > finalPrice && (
                        <span className="text-sm text-red-400 line-through opacity-70 font-mono" dir="ltr">
                          {convertPrice(originalFinalPrice).formatted}
                        </span>
                      )}
                      <strong
                        className="text-xl md:text-2xl font-black font-mono px-2 tracking-wide inline-flex items-center gap-1"
                        dir="ltr"
                        style={{ color: tabInfo?.color || 'var(--primary)' }}
                      >
                        {selectedCurrency === "USD" ? (
                          <>
                            <span>{convertPrice(finalPrice).symbol}</span>
                            <span>{convertPrice(finalPrice).amount.toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            <span>{convertPrice(finalPrice).amount.toFixed(2)}</span>
                            <span>{convertPrice(finalPrice).symbol}</span>
                          </>
                        )}
                      </strong>
                    </div>
                  </div>

                  {/* السعر برسوم الإيداع */}
                  {finalPrice > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-slate-900/80 p-4 px-6 rounded-2xl border border-amber-500/35 flex justify-between items-center shadow-lg backdrop-blur-xl">
                      <span className="text-amber-400 font-extrabold text-xs md:text-sm flex items-center gap-1.5">
                        💳 السعر برسوم الإيداع =
                      </span>
                      <strong className="text-lg md:text-xl font-black font-mono text-amber-300 tracking-wide inline-flex items-center gap-1" dir="ltr">
                        {selectedCurrency === "USD" ? (
                          <>
                            <span>
                              {convertPrice(
                                grossDepositRequiredForNet(
                                  finalPrice,
                                  getMethodFeePercent("wallet", siteSettings),
                                  2
                                )
                              ).symbol}
                            </span>
                            <span>
                              {convertPrice(
                                grossDepositRequiredForNet(
                                  finalPrice,
                                  getMethodFeePercent("wallet", siteSettings),
                                  2
                                )
                              ).amount.toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {convertPrice(
                                grossDepositRequiredForNet(
                                  finalPrice,
                                  getMethodFeePercent("wallet", siteSettings),
                                  2
                                )
                              ).amount.toFixed(2)}
                            </span>
                            <span>
                              {convertPrice(
                                grossDepositRequiredForNet(
                                  finalPrice,
                                  getMethodFeePercent("wallet", siteSettings),
                                  2
                                )
                              ).symbol}
                            </span>
                          </>
                        )}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="mt-4 px-1">
                  <button
                    type="button"
                    className={`w-full min-h-[56px] py-4 px-6 flex items-center justify-center gap-2.5 font-black text-lg text-slate-950 transition-all shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                      isAndroid
                        ? "rounded-full shadow-sky-500/30"
                        : isIOS
                        ? "rounded-[22px] backdrop-blur-md border border-white/20 shadow-black/60"
                        : "rounded-2xl glow-btn-primary hover:scale-[1.01]"
                    }`}
                    style={{
                      background: tabInfo?.color || 'var(--primary)',
                    }}
                    onClick={handleOrder}
                    disabled={!effectiveQuantity || (!hideLinkInput && !link) || finalPrice <= 0 || isInvalid}
                  >
                    <Send size={20} className="shrink-0" />
                    إتمام الدفع ⚡
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </motion.div>

      {showCheckout && selectedService && (
        <CheckoutModal
          service={selectedService}
          quantity={Number(effectiveQuantity)}
          priceEGP={finalPrice}
          link={link}
          settings={siteSettings}
          userProfile={userProfile}
          onClose={() => setShowCheckout(false)}
          useBalance
        />
      )}
    </motion.div>
  );
}
