"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { db } from "@/app/lib/firebase";
import AppShell from "@/app/components/layout/AppShell";
import { doc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { CheckCircle, Clock, Copy, HelpCircle, RefreshCw, ShieldAlert, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/app/lib/currency-context";
import { grossDepositRequiredForNet, getMethodFeePercent } from "@/lib/money/wallet";
import { calculateDepositFee } from "@/lib/deposit-fees";
import { isolateLtr } from "@/app/lib/bidi";
import { calculateTikTokCoinsFromEgp, calculateTikTokPriceEgp } from "@/lib/pricing/tiktok";
import CustomWalletSelect from "@/app/components/CustomWalletSelect";

export default function RechargePage() {
  const { user, loading } = useAuth();
  const { rates, selectedCurrency, symbols } = useCurrency();
  const [wallets, setWallets] = useState<any[]>([]);
  const [method, setMethod] = useState("vodafone");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [rechargeId, setRechargeId] = useState("");
  const [recharge, setRecharge] = useState<any>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [requiredEgp, setRequiredEgp] = useState(0);
  const [orderAmountEgp, setOrderAmountEgp] = useState(0);
  const [requestedService, setRequestedService] = useState("");
  const [depositFeePercent, setDepositFeePercent] = useState(0.57);
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [depositFeeMinEgp, setDepositFeeMinEgp] = useState(0.5);
  const [depositFeeMaxEgp, setDepositFeeMaxEgp] = useState(20);
  const [tiktokUsdRate, setTiktokUsdRate] = useState(50);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tiktokMaxCoins, setTiktokMaxCoins] = useState(2500000);
  const [globalDiscountConfig, setGlobalDiscountConfig] = useState<{ enabled: boolean; discountPercent: number; maxDiscountUsd?: number }>({ enabled: false, discountPercent: 0 });
  const [isCellularConnection, setIsCellularConnection] = useState(false);
  const [selectedWalletIndexMap, setSelectedWalletIndexMap] = useState<Record<string, number>>({});
  const [siteInstructions, setSiteInstructions] = useState<Record<string, string[]>>({
    vodafone: [
      "ارسل المبلغ أولا",
      "اكتب المبلغ الذي قمت بتحويله في الخانه المطلوبه",
      "قم بكتابه الرقم الخاص بك الذي قمت بالتحويل لنا من خلاله في الخانه المطلوبه",
      "اضغط على تأكيد الايداع",
    ],
    instapay: [
      "أرسل المبلغ إلى حسابنا البنكي عبر InstaPay",
      "اكتب المبلغ الذي أرسلته بالجنيه المصري",
      "اكتب الرقم المرجعي للتحويل من رسالة SMS",
      "اضغط على تأكيد الايداع",
    ],
    barq: [
      "أرسل المبلغ إلى حسابنا في تطبيق برق (Barq)",
      "اكتب المبلغ بالريال السعودي",
      "اكتب اسم المحول باللغة الإنجليزية كما هو في التطبيق",
      "اضغط على تأكيد الايداع",
    ],
    bank: [
      "أرسل المبلغ إلى حسابنا البنكي المعروض",
      "اكتب المبلغ الإجمالي المحول",
      "ارفع صورة إيصال التحويل البنكي بوضوح",
      "اضغط على تأكيد الايداع",
    ],
    binance_pay: [
      "أرسل المبلغ بالدولار الأمريكي (USD) عبر Binance Pay",
      "اكتب المبلغ المطلوب بالدولار في الخانة المخصصة",
      "انسخ Binance ID الخاص بحسابنا (405960486) وقم بالتحويل من تطبيق Binance",
      "اضغط على تأكيد الإيداع لمتابعة حالة الطلب",
    ],
  });
  const [showInstructionsModal, setShowInstructionsModal] = useState(true);
  const [binancePayDetails, setBinancePayDetails] = useState<{
    depositId?: string;
    merchantTradeNo?: string;
    recipientBinanceId?: string;
    amountUsd?: number;
    checkoutUrl?: string;
    qrcodeLink?: string;
  } | null>(null);

  useEffect(() => {
    const checkNetwork = () => {
      if (typeof window === "undefined") return;
      const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const isMobileWidth = window.innerWidth < 768;
      const isMobileDevice = isMobileUA || isMobileWidth;

      // On Desktop PC / Laptop, it is NEVER cellular!
      if (!isMobileDevice || window.innerWidth >= 768) {
        setIsCellularConnection(false);
        return;
      }

      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        const typeStr = String(conn.type || "").toLowerCase();
        // Strictly require type to be cellular/mobile
        const isCellular = typeStr === "cellular" || typeStr === "mobile";
        setIsCellularConnection(isCellular);
      } else {
        setIsCellularConnection(false);
      }
    };
    checkNetwork();

    const conn = typeof window !== "undefined" ? ((navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection) : null;
    if (conn && conn.addEventListener) {
      conn.addEventListener("change", checkNetwork);
      return () => conn.removeEventListener("change", checkNetwork);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const required = Number(params.get("requiredEgp"));
    const orderAmount = Number(params.get("orderAmountEgp"));
    if (Number.isFinite(required) && required > 0) {
      setRequiredEgp(required);
      setOrderAmountEgp(
        Number.isFinite(orderAmount) && orderAmount > 0 ? orderAmount : required,
      );
      setRequestedService(params.get("service") || "");
    }
  }, []);

  const copyToClipboard = async (text: string, label: string = "تم النسخ بنجاح 📋") => {
    if (!text) return;
    try {
      if (typeof window !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      toast.success(label);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        setCopied(true);
        toast.success(label);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("تعذر النسخ، يرجى النسخ يدوياً ⚠️");
      }
    }
  };

  const copyWalletDetails = async () => {
    const value = selected?.number || selected?.link;
    if (!value) return;
    await copyToClipboard(value, "تم نسخ رقم التحويل بنجاح 📋");
  };

  const hasFetchedWallets = useRef(false);

  useEffect(() => {
    if (loading) return;

    getDoc(doc(db, "settings", "site")).then((snapshot) => {
      const siteData = snapshot.data();
      const allWallets: any[] = siteData?.wallets || [];
      if (siteData?.methodInstructions && typeof siteData.methodInstructions === "object") {
        const loadedInstr: Record<string, string[]> = { ...siteData.methodInstructions };
        Object.keys(loadedInstr).forEach((k) => {
          const list = [...(loadedInstr[k] || [])];
          if (list.length >= 3) {
            const s1 = list[1] || "";
            const s2 = list[2] || "";
            const isS1Ref = /رقم|الرقم|مرجعي|اسم|إيصال|ايصال/i.test(s1);
            const isS2Amount = /مبلغ|المبلغ/i.test(s2);
            if (isS1Ref && isS2Amount) {
              list[1] = s2;
              list[2] = s1;
              loadedInstr[k] = list;
            }
          }
        });
        setSiteInstructions((prev) => ({ ...prev, ...loadedInstr }));
      }
      const countryCode = user?.country_code || "EG";

      // Group all wallets (active and inactive) by type
      const grouped: Record<string, any[]> = {};
      allWallets.forEach((w: any) => {
        let t = w.type || "vodafone";
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push({ ...w, type: t });
      });

      if (!grouped["barq"] && grouped["vodafone"]) {
        grouped["barq"] = grouped["vodafone"].map((v: any) => {
          let num = v.number || "";
          if (num) {
            if (!num.startsWith("+20") && num.startsWith("0")) num = "+20" + num.substring(1);
            else if (!num.startsWith("+20")) num = "+20" + num;
          }
          return { ...v, type: "barq", number: num };
        });
      }

      // Detect if device is a mobile phone
      const isMobilePhone = typeof window !== "undefined" && (
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
      );

      // Parse user payment preferences from localStorage OR user profile
      let userPrefList: string[] = [];
      const localPref = typeof window !== "undefined" ? localStorage.getItem("user_preferred_methods") : null;
      if (localPref) {
        try {
          userPrefList = JSON.parse(localPref);
        } catch {}
      }
      if ((!userPrefList || userPrefList.length === 0) && user?.preferred_payment_methods) {
        try {
          userPrefList = typeof user.preferred_payment_methods === "string"
            ? JSON.parse(user.preferred_payment_methods)
            : user.preferred_payment_methods;
        } catch {
          userPrefList = [];
        }
      }

      // Build wallet list per country (strictly isolated per country)
      let relevantTypes: string[] = [];
      const customTypes = Object.keys(grouped).filter(t => !["vodafone", "instapay", "barq", "bank", "binance_pay", "binance"].includes(t) || t === "custom");

      if (countryCode === "SA") {
        // Saudi Arabia (SA): Barq, Bank Transfer, Custom, Binance Pay (last!)
        relevantTypes = ["barq", "bank", ...customTypes, "binance_pay"].filter(t => t !== "vodafone" && t !== "instapay");
      } else {
        // Egypt (EG) & International: InstaPay, Vodafone Cash, Bank Transfer, Custom, Binance Pay (last!)
        relevantTypes = ["instapay", "vodafone", "bank", ...customTypes, "binance_pay"].filter(t => t !== "barq");
      }

      const finalWallets: any[] = [];
      const initialIndices: Record<string, number> = {};

      for (const type of relevantTypes) {
        const list = (grouped[type] || grouped[type === "binance_pay" ? "binance" : type] || []).filter((w: any) => {
          if (!w.countryCode) return true;
          return w.countryCode === countryCode || w.countryCode === "GLOBAL";
        });
        const activeList = list.filter((w: any) => w.isActive !== false);
        if (activeList.length > 0) {
          finalWallets.push(...activeList);
          initialIndices[type] = Math.floor(Math.random() * activeList.length);
        } else if (type === "binance_pay") {
          finalWallets.push({
            type: "binance_pay",
            countryCode: "GLOBAL",
            number: "405960486",
            name: "Binance Pay",
            min: 1,
            max: 10000,
            isActive: true,
          });
        } else if (list.length > 0) {
          finalWallets.push({ ...list[0], disabled: true });
        } else {
          finalWallets.push({ type, disabled: true, number: "" });
        }
      }

      setWallets(finalWallets);
      setSelectedWalletIndexMap(initialIndices);
      if (finalWallets.length > 0) {
        const defaultType = countryCode === "SA" ? "barq" : "instapay";
        const matchingDefault = finalWallets.find(w => w.type === defaultType && !w.disabled);
        const firstActive = finalWallets.find(w => !w.disabled);
        setMethod(matchingDefault?.type || firstActive?.type || finalWallets[0].type);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.country_code]);

  useEffect(() => {
    getDoc(doc(db, "settings", "pricing")).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPricingConfig(data);
        const fee = Number(data?.deposit_fee_percent ?? data?.depositFeePercent ?? 0.57);
        const minFee = Number(data?.deposit_fee_min_egp ?? data?.depositFeeMinEgp ?? 0.5);
        const maxFee = Number(data?.deposit_fee_max_egp ?? data?.depositFeeMaxEgp ?? 20);
        setDepositFeePercent(Number.isFinite(fee) && fee >= 0 ? fee : 0.57);
        setDepositFeeMinEgp(Number.isFinite(minFee) && minFee >= 0 ? minFee : 0.5);
        setDepositFeeMaxEgp(Number.isFinite(maxFee) && maxFee >= 0 ? maxFee : 20);
        setTiktokUsdRate(Number(data?.usd_rate ?? data?.tiktok_usd_rate ?? 50));
        setGlobalDiscountConfig({
          enabled: Boolean(data?.global_usd_discount_enabled ?? data?.globalUsdDiscountEnabled),
          discountPercent: Number(data?.global_usd_discount_percent ?? data?.globalUsdDiscountPercent ?? 0),
          maxDiscountUsd: Number(data?.global_usd_discount_max_amount ?? data?.globalUsdDiscountMaxAmount ?? data?.max_discount_usd ?? data?.maxDiscountUsd ?? 0),
        });
        const mc = Number(data?.tiktok_max_coins);
        if (Number.isFinite(mc) && mc > 0) setTiktokMaxCoins(mc);
      }
    }).catch(console.error);

    getDocs(query(collection(db, "tiers"), orderBy("min"))).then((snapshot) => {
      setTiers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!rechargeId) return;
    let stopped = false;
    const refresh = async () => {
      const response = await fetch(`/api/recharges/${rechargeId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!stopped && response.ok) {
        setRecharge(data.recharge);
        const deadline = new Date(data.recharge.verificationDeadline || 0).getTime();
        if (deadline) setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    const recheck = window.setInterval(() => {
      void fetch(`/api/recharges/${rechargeId}/recheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    }, 5000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.clearInterval(recheck);
    };
  }, [rechargeId]);

  useEffect(() => {
    if (!rechargeId || ["verified", "approved", "manual_review"].includes(recharge?.status)) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rechargeId, recharge?.status]);

  const retryVerification = async () => {
    setRetrying(true);
    try {
      const response = await fetch(`/api/recharges/${rechargeId}/recheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إعادة المحاولة");
      setRemainingSeconds(300);
      setRecharge((current: any) => ({ ...current, status: "matching", paymentStatus: "verifying" }));
      toast.success("بدأت محاولة تحقق جديدة لمدة 5 دقائق");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إعادة المحاولة");
    } finally {
      setRetrying(false);
    }
  };

  const handleOpenInstaPayApp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window === "undefined") return;

    const targetUrl = selected?.link || "ipn://";
    let appOpened = false;

    const handleAppLaunchDetect = () => {
      appOpened = true;
    };

    window.addEventListener("pagehide", handleAppLaunchDetect, { once: true });
    window.addEventListener("blur", handleAppLaunchDetect, { once: true });

    // Attempt to launch InstaPay app directly
    window.location.href = targetUrl;

    // Wait 0.001 seconds (1ms) to verify if the app opened or is missing
    window.setTimeout(() => {
      window.removeEventListener("pagehide", handleAppLaunchDetect);
      window.removeEventListener("blur", handleAppLaunchDetect);
      if (!appOpened && document.visibilityState === "visible") {
        toast.error("تطبيق InstaPay غير مثبت على جهازك ⚠️");
      }
    }, 1);
  };

  const activeMatchingWallets = useMemo(() => {
    const countryCode = user?.country_code || "EG";
    return wallets.filter((w) => {
      if (w.type !== method) return false;
      if (w.disabled) return false;
      if (!w.countryCode) return true;
      return w.countryCode === countryCode || w.countryCode === "GLOBAL";
    });
  }, [wallets, method, user?.country_code]);

  const selected = useMemo(() => {
    if (activeMatchingWallets.length === 0) {
      return wallets.find((w) => w.type === method);
    }
    const idx = selectedWalletIndexMap[method] ?? 0;
    return activeMatchingWallets[idx % activeMatchingWallets.length];
  }, [activeMatchingWallets, selectedWalletIndexMap, method, wallets]);
  const isBinancePay = method === "binance_pay" || method === "binance";
  const isSaudiUser = !isBinancePay && (selectedCurrency === "SAR" || user?.country === "SA" || method === "barq");
  const currencySymbol = isBinancePay ? "$" : isSaudiUser ? (symbols.sar || "﷼") : (symbols.egp || "£");
  const fee = getMethodFeePercent(method, pricingConfig);
  const numericAmount = Number(amount);

  const isSarCurrency = !isBinancePay && (isSaudiUser || method === "barq" || selected?.countryCode === "SA");

  const rawMin = Number.isFinite(Number(selected?.min)) && Number(selected?.min) > 0
    ? Number(selected.min)
    : (isBinancePay ? 1 : isSarCurrency ? 8 : 80);
  const rawMax = Number.isFinite(Number(selected?.max)) && Number(selected?.max) > 0
    ? Number(selected.max)
    : (isBinancePay ? 10000 : isSarCurrency ? 100000 : 1000000);

  const minimumInCurrency = rawMin;
  const maximumInCurrency = rawMax;

  const validSarRate = (Number.isFinite(rates.sar) && rates.sar > 0) ? rates.sar : ((rates.usd || 50) / 3.75);

  const minimumEgp = isSarCurrency ? rawMin * validSarRate : rawMin;
  const maximumEgp = isSarCurrency ? rawMax * validSarRate : rawMax;

  const grossEgp = isBinancePay
    ? numericAmount * (rates.usd || 54.55)
    : isSarCurrency
      ? numericAmount * validSarRate
      : numericAmount;

  const amountWithinLimits = Number.isFinite(numericAmount)
    && numericAmount > 0
    && numericAmount >= minimumInCurrency - 0.01
    && numericAmount <= maximumInCurrency + 0.01;

  const effectiveMinFeeEgp = isBinancePay
    ? (Number(pricingConfig?.binancePayDepositFeeMin ?? pricingConfig?.binance_pay_deposit_fee_min) || 0) * (rates.usd || 54.55)
    : isSarCurrency && Number(pricingConfig?.sarDepositFeeMin ?? pricingConfig?.sar_deposit_fee_min) > 0
      ? Number(pricingConfig?.sarDepositFeeMin ?? pricingConfig?.sar_deposit_fee_min) * validSarRate
      : depositFeeMinEgp;

  const effectiveMaxFeeEgp = isBinancePay
    ? (Number(pricingConfig?.binancePayDepositFeeMax ?? pricingConfig?.binance_pay_deposit_fee_max) || 0) * (rates.usd || 54.55)
    : isSarCurrency && Number(pricingConfig?.sarDepositFeeMax ?? pricingConfig?.sar_deposit_fee_max) > 0
      ? Number(pricingConfig?.sarDepositFeeMax ?? pricingConfig?.sar_deposit_fee_max) * validSarRate
      : depositFeeMaxEgp;

  const effectiveGrossEgp = amountWithinLimits ? grossEgp : 0;
  const feeCalc = calculateDepositFee(
    effectiveGrossEgp,
    fee,
    effectiveMinFeeEgp,
    effectiveMaxFeeEgp
  );

  const displayFeeInCurrency = isBinancePay
    ? feeCalc.depositFee / (rates.usd || 54.55)
    : isSarCurrency
      ? feeCalc.depositFee / validSarRate
      : feeCalc.depositFee;

  const displayNetInCurrency = isBinancePay
    ? feeCalc.netAmount / (rates.usd || 54.55)
    : isSarCurrency
      ? feeCalc.netAmount / validSarRate
      : feeCalc.netAmount;
  const estimatedNetEgp = feeCalc.netAmount;
  const formatDepositBalance = (amountEgp: number) => {
    if (!Number.isFinite(amountEgp)) amountEgp = 0;
    if (selectedCurrency === "USD") return isolateLtr(`${symbols.usd || "$"}${(amountEgp / rates.usd).toFixed(2)}`);
    if (selectedCurrency === "SAR") return isolateLtr(`${symbols.sar || "﷼"} ${(amountEgp / validSarRate).toFixed(2)}`);
    return isolateLtr(`${symbols.egp || "£"} ${amountEgp.toFixed(2)}`);
  };
  const estimatedCredit = formatDepositBalance(estimatedNetEgp);

  const tiktokCoins = useMemo(() => {
    if (!amountWithinLimits || feeCalc.netAmount <= 0) return 0;

    const maxCoinsCostEgp = calculateTikTokPriceEgp(tiktokMaxCoins, tiers, tiktokUsdRate, globalDiscountConfig);
    if (feeCalc.netAmount > maxCoinsCostEgp + 1e-4) {
      return 0; // Deposit exceeds TikTok coins limit cost
    }

    const calculated = calculateTikTokCoinsFromEgp(feeCalc.netAmount, tiers, tiktokUsdRate, 645, globalDiscountConfig, tiktokMaxCoins);
    if (calculated > tiktokMaxCoins) return 0;
    return calculated;
  }, [feeCalc.netAmount, amountWithinLimits, tiers, tiktokUsdRate, globalDiscountConfig, tiktokMaxCoins]);

  const originalTiktokCoins = useMemo(() => {
    if (!amountWithinLimits || feeCalc.netAmount <= 0) return 0;
    const calculated = calculateTikTokCoinsFromEgp(feeCalc.netAmount, tiers, tiktokUsdRate, 645, null, tiktokMaxCoins);
    if (calculated > tiktokMaxCoins) return 0;
    return calculated;
  }, [feeCalc.netAmount, amountWithinLimits, tiers, tiktokUsdRate, tiktokMaxCoins]);
  const orderAmountInPaymentCurrency =
    isSarCurrency ? orderAmountEgp / rates.sar : orderAmountEgp;
  const formattedOrderAmount = isSarCurrency
    ? isolateLtr(`${orderAmountInPaymentCurrency.toFixed(2)} SAR`)
    : isolateLtr(`${orderAmountInPaymentCurrency.toFixed(2)} EGP`);
  const requiredInPaymentCurrency =
    isSarCurrency ? requiredEgp / rates.sar : requiredEgp;
  const calculatedTransferAmount = grossDepositRequiredForNet(
    requiredInPaymentCurrency,
    fee,
    isSarCurrency ? 2 : 0,
  );
  const displayedTransferAmount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? numericAmount
      : calculatedTransferAmount;
  const formattedTransferAmount = isSarCurrency
    ? isolateLtr(`${displayedTransferAmount.toFixed(2)} SAR`)
    : isolateLtr(`${displayedTransferAmount.toFixed(2)} EGP`);

  useEffect(() => {
    if (requiredEgp <= 0 || !selected || selected.disabled) return;
    const requiredInPaymentCurrency =
      method === "barq" ? requiredEgp / rates.sar : requiredEgp;
    const prefilledAmount = Math.round(
      grossDepositRequiredForNet(
        requiredInPaymentCurrency,
        fee,
        method === "barq" ? 2 : 0,
      ) * 100
    ) / 100;
    const limitedAmount = Math.max(minimumEgp, prefilledAmount);
    setAmount(String(limitedAmount));
  }, [
    fee,
    method,
    minimumEgp,
    rates.sar,
    requiredEgp,
    selected,
  ]);

  const handleReceiptUpload = async (file: File) => {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/recharges/upload-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || "تعذر رفع صورة الإيصال");
      }
      setReceiptUrl(data.url);
      toast.success("تم رفع صورة الإيصال بنجاح ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء رفع الإيصال");
      setReceiptFile(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const submit = async () => {
    if (selected?.disabled) {
      toast.error("هذه الوسيلة غير متاحة حالياً، يرجى اختيار وسيلة أخرى");
      return;
    }
    if (method === "bank" && !receiptUrl) {
      toast.error("يرجى رفع صورة إيصال التحويل البنكي لتأكيد الإيداع");
      return;
    }
    setBusy(true);
    try {
      if (method === "binance_pay" || method === "binance") {
        const response = await fetch("/api/v1/payment/binance-pay/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountUsd: numericAmount,
            currency: "USD",
            userBinanceOrderId: reference,
            reference: reference,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "تعذر إنشاء طلب الإيداع عبر Binance Pay");
        const bDetails = data.data || data;
        setRechargeId(bDetails.depositId || bDetails.merchantTradeNo);
        setBinancePayDetails(bDetails);
        toast.success("تم إنشاء طلب الإيداع بنجاح 🟡 في انتظار التحويل عبر Binance Pay");
        return;
      }

      const response = await fetch("/api/recharges/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          amount: numericAmount,
          reference: reference || (method === "bank" ? "BANK_TRANSFER" : method === "barq" ? "BARQ_TRANSFER" : ""),
          receiptUrl,
          walletIdentifier: selected?.number || selected?.link || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الإيداع");
      setRechargeId(data.rechargeId);
      if (method === "bank" || receiptUrl) {
        toast.success("تم إرسال طلب الإيداع بنجاح ✅ وهو قيد المراجعة الإدارية من الدعم.");
      } else {
        toast.success("تم تسجيل التحويل وننتظر رسالة التأكيد");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl py-2 px-2 sm:px-4 font-['Cairo'] text-right" dir="rtl">
        <h1 className="mb-3 flex items-center justify-center gap-2 text-lg sm:text-xl font-bold text-primary">
          <Wallet size={22} /> شحن المحفظة
        </h1>
        {requiredEgp > 0 && !rechargeId && (
          <div className="mx-0 mb-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center">
            <strong className="block text-emerald-400 text-sm">
              شحن الرصيد لإتمام الطلب
            </strong>
            {requestedService && (
              <span className="mt-0.5 block text-xs text-foreground font-semibold">
                {requestedService}
              </span>
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-primary/20 bg-background/60 px-3 py-2">
                <span className="block text-[11px] text-muted-foreground">
                  إجمالي سعر الطلب
                </span>
                <strong className="mt-0.5 block text-base text-primary font-mono" dir="ltr">
                  {formattedOrderAmount}
                </strong>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-background/60 px-3 py-2">
                <span className="block text-[11px] text-muted-foreground">
                  المبلغ المطلوب تحويله
                </span>
                <strong className="mt-0.5 block text-base text-emerald-400 font-mono" dir="ltr">
                  {formattedTransferAmount}
                </strong>
              </div>
            </div>
          </div>
        )}

        {rechargeId ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-card p-5 text-center shadow-xl">
            {["verified", "approved"].includes(recharge?.status) ? (
              <CheckCircle className="mx-auto mb-3 text-emerald-500" size={48} />
            ) : recharge?.status === "manual_review" ? (
              <ShieldAlert className="mx-auto mb-3 text-amber-500" size={48} />
            ) : (
              <Clock className="mx-auto mb-3 animate-pulse text-primary" size={48} />
            )}
            <h2 className="mb-2 text-lg font-bold">
              {["verified", "approved"].includes(recharge?.status)
                ? "تمت إضافة الرصيد"
                : recharge?.status === "manual_review"
                  ? "تحول الطلب إلى مراجعة يدوية"
                  : "في انتظار رسالة التحويل"}
            </h2>
            {!["verified", "approved", "manual_review"].includes(recharge?.status) && (
              <>
                <div className="mx-auto mb-3 w-fit rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 font-mono text-2xl md:text-3xl font-black text-amber-400 shadow-lg" dir="ltr">
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                  {String(remainingSeconds % 60).padStart(2, "0")}
                </div>

                <div className="my-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-center text-xs text-red-300 font-bold space-y-1.5 leading-relaxed">
                  <div className="flex items-center justify-center gap-2 text-red-400 font-black text-xs sm:text-sm">
                    <ShieldAlert size={18} className="shrink-0 animate-bounce" />
                    ⚠️ تحذير هام جداً بناءً على شروط الاستخدام:
                  </div>
                  <p>
                    يرجى عدم إغلاق هذه الصفحة أثناء جاري التحقق التلقائي من الإيداع (مدة 5 دقائق).
                  </p>
                </div>
              </>
            )}
            <p className="text-xs sm:text-sm leading-6 text-muted-foreground">
              صافي الرصيد المتوقع: {formatDepositBalance(
                Number(recharge?.netDepositEgp)
                || Number(recharge?.estimatedCreditUsd || 0) * rates.usd,
              )}
            </p>
            {recharge?.status === "manual_review" && (
              <>
                <p className="mt-3 text-xs sm:text-sm leading-6 text-amber-400">
                  سيظهر الطلب للأدمن للموافقة اليدوية، ويمكنك أيضًا بدء تحقق تلقائي جديد.
                </p>
                <button
                  onClick={retryVerification}
                  disabled={retrying}
                  className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-black disabled:opacity-50"
                >
                  <RefreshCw size={15} className={retrying ? "animate-spin" : ""} />
                  {retrying ? "جاري المحاولة..." : "إعادة المحاولة"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-xl space-y-4">
            {/* Live USD / SAR Exchange Rate Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 shadow-sm">
              {isSarCurrency ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇸🇦</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200">سعر الريال لدينا:</span>
                  </div>
                  <strong className="font-mono text-sm sm:text-base font-black text-emerald-400" dir="ltr">
                    {validSarRate.toFixed(2)} ج.م = 1 ﷼
                  </strong>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-base">💵</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200">سعر الدولار لدينا:</span>
                  </div>
                  <strong className="font-mono text-sm sm:text-base font-black text-emerald-400" dir="ltr">
                    {(rates.usd || 54.55).toFixed(2)} ج.م = 1$
                  </strong>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* Right Column: Wallet Selection + ALL Wallet & Transfer Details */}
              <div className="lg:col-span-6 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-200">اختر وسيلة الإيداع</label>
                  <CustomWalletSelect
                    value={method}
                    onChange={(val) => {
                      setMethod(val);
                      if (typeof window !== "undefined") localStorage.setItem("preferred_payment_method", val);
                    }}
                    options={wallets}
                  />
                </div>

                {/* Selected Wallet Transfer Details Box */}
                {selected?.disabled ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-xs font-bold text-amber-400 space-y-2">
                    <div className="text-sm font-black flex items-center justify-center gap-2">
                      <ShieldAlert size={18} />
                      وسيلة الإيداع هذه ({selected.type === "vodafone" ? "فودافون كاش / محفظه الكترونية" : selected.type === "instapay" ? "InstaPay" : selected.type === "barq" ? "برق" : selected.type === "binance_pay" || selected.type === "binance" ? "Binance Pay" : "التحويل البنكي"}) غير متاحة حالياً.
                    </div>
                    <p className="text-[11px] text-muted-foreground/90 font-medium">
                      يرجى اختيار وسيلة إيداع أخرى متاحة من القائمة أعلاه.
                    </p>
                  </div>
                ) : selected ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col gap-2.5 shadow-sm">
                    {selected.type === "bank" ? (
                      <>
                        <span className="block text-xs font-bold text-slate-300">بيانات التحويل البنكي:</span>
                        {selected.bankName && (
                          <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">اسم البنك:</span>
                              <strong className="text-foreground font-bold text-xs">{selected.bankName}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.bankName, "تم نسخ اسم البنك بنجاح 📋")}
                              className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        )}
                        {selected.holderName && (
                          <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">المستفيد:</span>
                              <strong className="text-foreground font-bold text-xs">{selected.holderName}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.holderName, "تم نسخ اسم صاحب الحساب بنجاح 📋")}
                              className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        )}
                        {selected.number && (
                          <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">رقم الحساب:</span>
                              <strong className="font-mono text-xs text-foreground break-all" dir="ltr">{selected.number}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.number, "تم نسخ رقم الحساب بنجاح 📋")}
                              className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        )}
                        {selected.link && (
                          <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">IBAN:</span>
                              <strong className="font-mono text-xs text-foreground break-all" dir="ltr">{selected.link}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.link, "تم نسخ IBAN بنجاح 📋")}
                              className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        )}
                      </>
                    ) : selected.type === "instapay" ? (
                      <div className="flex flex-col gap-2.5">
                        <span className="block text-xs font-bold text-slate-300">بيانات تحويل إنستاباي (InstaPay)</span>
                        <button
                          type="button"
                          onClick={handleOpenInstaPayApp}
                          className="inline-flex md:hidden h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 font-black text-black text-xs transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          <Zap size={16} className="fill-black shrink-0" />
                          <span>التحويل المباشر من InstaPay</span>
                        </button>
                        {selected.number && (
                          <div className="hidden md:flex text-xs bg-background/80 p-3 rounded-lg border border-border justify-between items-center gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">📱 رقم تحويل إنستاباي:</span>
                              <strong className="font-mono text-xs text-foreground break-all" dir="ltr">{selected.number}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selected.number, "تم نسخ رقم تحويل انستاباي بنجاح 📋")}
                              className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        )}
                        {(selected.username || selected.ipa || (selected.link && selected.link.includes("@"))) && (() => {
                          const ipaValue = selected.username || selected.ipa || selected.link;
                          return (
                            <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[10px] text-muted-foreground font-semibold">👤 اسم مستخدم IPA:</span>
                                <strong className="font-mono text-xs text-emerald-400 break-all" dir="ltr">{ipaValue}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(ipaValue, "تم نسخ IPA بنجاح 📋")}
                                className="rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 p-2 text-emerald-400 border border-emerald-500/20 shrink-0 cursor-pointer"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          );
                        })()}
                        {/* Account Holder Name */}
                        {(selected.name || selected.holderName) && (() => {
                          const holderNameStr = selected.holderName || selected.name;
                          return (
                            <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[10px] text-muted-foreground font-semibold">اسم صاحب الحساب:</span>
                                <strong className="text-foreground font-bold text-xs">{holderNameStr}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(holderNameStr, "تم النسخ بنجاح 📋")}
                                className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          );
                        })()}
                        {/* QR Code (Desktop Web Only) */}
                        {selected.qr && (
                          <div className="hidden md:flex flex-col items-center gap-2 bg-background/90 p-3 rounded-xl border border-border shadow-sm text-center">
                            <span className="text-[11px] font-bold text-slate-200">امسح رمز QR للتحويل المباشر:</span>
                            <div className="bg-white p-2 rounded-xl border border-border flex justify-center items-center shadow-md w-44 h-44 mx-auto">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={selected.qr} alt="InstaPay QR Code" className="w-full h-full max-w-[160px] max-h-[160px] object-contain rounded-lg" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (selected.type === "binance_pay" || selected.type === "binance") ? (
                      <div className="flex flex-col gap-2.5">
                        <span className="block text-xs font-bold text-amber-400">وسيلة الدفع: Binance Pay 🟡</span>
                        <div className="text-xs bg-slate-900/90 p-3 rounded-xl border border-amber-500/30 flex justify-between items-center gap-2 shadow-sm">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-[10px] text-amber-400 font-bold">🟡 Binance Pay ID الخاص بحسابنا:</span>
                            <strong className="font-mono text-base text-slate-100 break-all" dir="ltr">
                              {selected?.number || "405960486"}
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selected?.number || "405960486", "تم نسخ Binance ID بنجاح 📋")}
                            className="rounded-lg bg-amber-500/15 hover:bg-amber-500/25 p-2 text-amber-400 border border-amber-500/30 shrink-0 cursor-pointer"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/25 text-xs">
                          {isSarCurrency ? (
                            <>
                              <span className="text-slate-300 font-bold">🇸🇦 سعر الريال لدينا:</span>
                              <strong className="text-emerald-400 font-mono font-black" dir="ltr">{validSarRate.toFixed(2)} ج.م = 1 ﷼</strong>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-300 font-bold">💵 سعر الدولار لدينا:</span>
                              <strong className="text-emerald-400 font-mono font-black" dir="ltr">{(rates.usd || 54.55).toFixed(2)} ج.م = 1$</strong>
                            </>
                          )}
                        </div>
                        {binancePayDetails && (
                          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Order ID:</span>
                              <div className="flex items-center gap-1.5">
                                <strong className="font-mono text-cyan-400 font-bold" dir="ltr">{binancePayDetails.merchantTradeNo || binancePayDetails.depositId}</strong>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(binancePayDetails.merchantTradeNo || binancePayDetails.depositId || "", "تم نسخ Order ID بنجاح 📋")}
                                  className="text-[11px] p-1 rounded bg-cyan-500/15 text-cyan-400 cursor-pointer"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">المبلغ بالدولار:</span>
                              <strong className="font-mono text-emerald-400 font-black">${binancePayDetails.amountUsd} USD</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {(selected.number || selected.link) && (
                          <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-slate-300">📱 رقم التحويل:</span>
                            <div className="flex items-center justify-between gap-2 bg-background p-3 rounded-lg border border-border" dir="ltr">
                              <strong className="break-all font-mono text-sm text-emerald-400">{selected.number || selected.link}</strong>
                              <button
                                type="button"
                                onClick={copyWalletDetails}
                                className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                              >
                                {copied ? <CheckCircle size={16} className="animate-bounce" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                        )}
                        {(selected.name || selected.holderName) && (() => {
                          const holderNameStr = selected.holderName || selected.name;
                          return (
                            <div className="text-xs bg-background/80 p-3 rounded-lg border border-border flex justify-between items-center gap-2">
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[10px] text-muted-foreground font-semibold">اسم صاحب الحساب:</span>
                                <strong className="text-foreground font-bold text-xs">{holderNameStr}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(holderNameStr, "تم النسخ بنجاح 📋")}
                                className="rounded-lg bg-primary/15 hover:bg-primary/25 p-2 text-primary shrink-0 cursor-pointer"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          );
                        })()}
                        {selected.qr && (
                          <div className="hidden md:flex flex-col items-center gap-2 bg-background/90 p-3 rounded-xl border border-border shadow-sm text-center">
                            <span className="text-[11px] font-bold text-slate-200">امسح رمز QR للتحويل المباشر:</span>
                            <div className="bg-white p-2 rounded-xl border border-border flex justify-center items-center shadow-md w-44 h-44 mx-auto">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={selected.qr} alt={`${selected.type} QR Code`} className="w-full h-full max-w-[160px] max-h-[160px] object-contain rounded-lg" />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/25 text-xs">
                          {isSarCurrency ? (
                            <>
                              <span className="text-slate-300 font-bold">🇸🇦 سعر الريال لدينا:</span>
                              <strong className="text-emerald-400 font-mono font-black" dir="ltr">{validSarRate.toFixed(2)} ج.م = 1 ﷼</strong>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-300 font-bold">💵 سعر الدولار لدينا:</span>
                              <strong className="text-emerald-400 font-mono font-black" dir="ltr">{(rates.usd || 54.55).toFixed(2)} ج.م = 1$</strong>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Left Column: Embedded Instructions + Inputs + Summary + Action Button */}
              <div className="lg:col-span-6 space-y-3">
                
                {/* Embedded Step-by-Step Instructions Box */}
                {selected && (
                  <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3 space-y-2">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
                      <HelpCircle size={16} className="text-cyan-400 shrink-0" />
                      <span className="text-xs font-black text-slate-200">
                        تعليمات الإيداع عبر {
                          method === "vodafone" ? "فودافون كاش / المحافظ" :
                          method === "instapay" ? "انستاباي (InstaPay)" :
                          method === "barq" ? "برق (Barq)" :
                          method === "binance_pay" || method === "binance" ? "Binance Pay" :
                          method === "bank" ? "التحويل البنكي" : "وسيلة الدفع"
                        } 📋
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      {(siteInstructions[method] || [
                        "أرسل المبلغ أولاً",
                        "اكتب المبلغ الخانة المطلوبة",
                        "اكتب الرقم المرجعي أو رقم الهاتف",
                        "اضغط على تأكيد الإيداع",
                      ]).map((step: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                          <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 border border-cyan-500/30">
                            {idx + 1}
                          </span>
                          <span className="text-slate-300 font-semibold leading-snug text-xs">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-200">
                    المبلغ (بـ {currencySymbol}) — أرقام صحيحة بدون كسور
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9]/g, "");
                      setAmount(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "." || e.key === "," || e.key === "-" || e.key === "e" || e.key === "E") {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (/[^0-9]/.test(pasted)) e.preventDefault();
                    }}
                    type="text"
                    inputMode="numeric"
                    min={minimumEgp}
                    max={maximumEgp}
                    pattern="[0-9]*"
                    placeholder="100"
                    className="h-12 w-full rounded-xl border border-border/80 bg-input px-4 text-left font-mono text-base outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
                    dir="ltr"
                  />
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground px-1">
                    <span>الحد الأدنى: <strong className="text-foreground">{minimumInCurrency} {currencySymbol}</strong></span>
                    <span>الحد الأقصى: <strong className="text-foreground">{maximumInCurrency} {currencySymbol}</strong></span>
                  </div>
                  <div className="flex items-center justify-between bg-cyan-500/10 px-3 py-2 rounded-xl border border-cyan-500/20 text-xs mt-1.5">
                    {isSarCurrency ? (
                      <>
                        <span className="text-slate-300 font-bold">🇸🇦 سعر الريال لدينا:</span>
                        <strong className="text-cyan-400 font-mono font-black" dir="ltr">{validSarRate.toFixed(2)} ج.م = 1 ﷼</strong>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-300 font-bold">💵 سعر الدولار لدينا:</span>
                        <strong className="text-cyan-400 font-mono font-black" dir="ltr">{(rates.usd || 54.55).toFixed(2)} ج.م = 1$</strong>
                      </>
                    )}
                  </div>
                  {amount && !amountWithinLimits && (
                    <p className="text-xs font-bold text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                      أدخل مبلغًا بين {minimumInCurrency} و{maximumInCurrency} {currencySymbol}
                    </p>
                  )}
                </div>

                {method !== "bank" && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-200">
                      {method === "barq"
                        ? "اسم المحول بالإنجليزية"
                        : method === "instapay"
                          ? "الرقم المرجعي من رسالة SMS"
                          : (method === "binance_pay" || method === "binance")
                            ? "رقم المعاملة (Binance Order ID)"
                            : "رقم الهاتف المحول منه"}
                    </label>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={(method === "binance_pay" || method === "binance") ? "أدخل رقم Binance Order ID هنا (مثال: 228394857)" : ""}
                      className="h-12 w-full rounded-xl border border-border/80 bg-input px-4 text-left font-mono text-base outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Receipt upload box ONLY for Bank Transfer */}
                {method === "bank" && (
                  <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 space-y-2 text-right">
                    <label className="block text-xs font-bold text-cyan-400">
                      📄 رفع صورة إيصال التحويل البنكي (إجباري)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      disabled={uploadingReceipt}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setReceiptFile(file);
                          handleReceiptUpload(file);
                        }
                      }}
                      className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-500/20 file:text-cyan-400 hover:file:bg-cyan-500/30 cursor-pointer"
                    />
                    {receiptUrl && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                        <CheckCircle size={14} /> تم رفع الإيصال بنجاح
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-center">
                  <span className="block text-[11px] text-muted-foreground mb-0.5">الرصيد الذي سيُضاف إلى المحفظة</span>
                  <div className="flex flex-row items-center justify-center gap-1.5 text-xl font-black text-emerald-400 font-mono" dir="ltr">
                    <span className="shrink-0">{currencySymbol}</span>
                    <span>{amountWithinLimits ? displayNetInCurrency.toFixed(2) : "0.00"}</span>
                  </div>
                </div>

                {amountWithinLimits && feeCalc.netAmount > 0 && tiktokCoins > 0 && tiktokCoins <= tiktokMaxCoins && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 space-y-1 text-center">
                    <strong className="block text-xs font-bold text-emerald-400">
                      هذا المبلغ يشحن لك {tiktokCoins.toLocaleString()} عمله تيك توك 🔥
                    </strong>
                  </div>
                )}

                <button
                  disabled={busy || uploadingReceipt || !user || !selected || selected.disabled || !amountWithinLimits || (method !== "bank" && !reference) || (method === "bank" && !receiptUrl)}
                  onClick={submit}
                  className="btn-ultra-primary w-full h-12 py-3 text-sm font-black rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  {busy ? "جاري المعالجة..." : "تأكيد الإيداع"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
