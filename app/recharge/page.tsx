"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { db } from "@/app/lib/firebase";
import AppShell from "@/app/components/layout/AppShell";
import { doc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { CheckCircle, Clock, Copy, RefreshCw, ShieldAlert, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/app/lib/currency-context";
import { grossDepositRequiredForNet, getMethodFeePercent } from "@/lib/money/wallet";
import { calculateDepositFee } from "@/lib/deposit-fees";
import { isolateLtr } from "@/app/lib/bidi";
import { calculateTikTokCoinsFromEgp, calculateTikTokPriceEgp } from "@/lib/pricing/tiktok";

export default function RechargePage() {
  const { user, loading } = useAuth();
  const { rates, selectedCurrency } = useCurrency();
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

  const copyWalletDetails = async () => {
    const value = selected?.number || selected?.link;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("تم النسخ بنجاح");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("تعذر النسخ، حاول مرة أخرى");
    }
  };

  const hasFetchedWallets = useRef(false);

  useEffect(() => {
    if (loading) return;

    getDoc(doc(db, "settings", "site")).then((snapshot) => {
      const allWallets: any[] = snapshot.data()?.wallets || [];
      const countryCode = user?.country_code || "EG";

      // Group all wallets (active and inactive) by type
      const grouped: Record<string, any[]> = {};
      allWallets.forEach((w: any) => {
        let t = w.type || "vodafone";
        if (t === "fazer") t = "vodafone";
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

      // Build wallet list per country & user preferences:
      let relevantTypes: string[] = [];
      if (userPrefList && Array.isArray(userPrefList) && userPrefList.length > 0) {
        relevantTypes = userPrefList;
      } else if (countryCode === "SA") {
        relevantTypes = isMobilePhone ? ["bank"] : ["barq", "bank"];
      } else {
        relevantTypes = isMobilePhone ? ["vodafone", "bank"] : ["instapay", "vodafone", "bank"];
      }

      const finalWallets: any[] = [];

      for (const type of relevantTypes) {
        const list = (grouped[type] || []).filter((w: any) => {
          if (!w.countryCode) return true;
          return w.countryCode === countryCode || w.countryCode === "GLOBAL";
        });
        const activeList = list.filter((w: any) => w.isActive !== false);
        if (activeList.length > 0) {
          finalWallets.push(activeList[Math.floor(Math.random() * activeList.length)]);
        } else if (list.length > 0) {
          finalWallets.push({ ...list[0], disabled: true });
        } else {
          finalWallets.push({ type, disabled: true, number: "" });
        }
      }

      setWallets(finalWallets);
      if (finalWallets.length > 0) {
        const savedMethod = typeof window !== "undefined" ? localStorage.getItem("preferred_payment_method") : null;
        const matchingSaved = finalWallets.find(w => w.type === savedMethod && !w.disabled);
        const firstActive = finalWallets.find(w => !w.disabled);
        setMethod(matchingSaved?.type || firstActive?.type || finalWallets[0].type);
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
    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);

    let appOpened = false;
    const onBlur = () => { appOpened = true; };
    window.addEventListener("blur", onBlur, { once: true });

    if (isAndroid) {
      // Direct intent for Android package com.egyptianbanks.instapay
      const intentUrl = "intent://ipn.eg/#Intent;scheme=instapay;package=com.egyptianbanks.instapay;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.egyptianbanks.instapay;end;";
      window.location.href = intentUrl;
    } else if (isIOS) {
      // iOS custom scheme for InstaPay app with App Store fallback
      const appScheme = "instapay://";
      const appStoreUrl = "https://apps.apple.com/eg/app/instapay-egypt/id1592289787";
      const start = Date.now();
      window.location.href = appScheme;
      setTimeout(() => {
        if (Date.now() - start < 2200 && !appOpened) {
          window.location.href = appStoreUrl;
        }
      }, 1200);
    } else {
      const rawUrl = (selected?.link || selected?.number || "").match(/https?:\/\/[^\s]+/)?.[0] || "https://ipn.eg";
      window.open(rawUrl, "_blank");
    }

    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!appOpened && (isAndroid || isIOS)) {
        toast("إذا لم يكن تطبيق انستا باي مثبتاً لديك، يمكنك التبديل إلى فودافون كاش للمحافظ 📲");
      }
    }, 1800);
  };

  const selected = useMemo(
    () => wallets.find((w) => {
      const type = w.type === "fazer" ? "vodafone" : w.type;
      return type === method;
    }),
    [wallets, method],
  );
  const currency = method === "barq" ? "ر.س" : "ج.م";
  const fee = getMethodFeePercent(method, pricingConfig);
  const numericAmount = Number(amount);

  // EGP base limits
  const minimumEgp = Number.isFinite(Number(selected?.min)) && Number(selected?.min) > 0
    ? Number(selected.min)
    : 80;
  const maximumEgp = Number.isFinite(Number(selected?.max)) && Number(selected.max) > 0
    ? Number(selected.max)
    : 1000000;
  
  const grossEgp = method === "barq" ? numericAmount * rates.sar : numericAmount;

  const amountWithinLimits = Number.isFinite(numericAmount)
    && grossEgp >= minimumEgp - 0.01
    && grossEgp <= maximumEgp + 0.01;

  const effectiveGrossEgp = amountWithinLimits ? grossEgp : 0;
  const feeCalc = calculateDepositFee(
    effectiveGrossEgp,
    fee,
    depositFeeMinEgp,
    depositFeeMaxEgp
  );

  const displayFeeInCurrency = method === "barq" ? feeCalc.depositFee / rates.sar : feeCalc.depositFee;
  const displayNetInCurrency = method === "barq" ? feeCalc.netAmount / rates.sar : feeCalc.netAmount;
  const estimatedNetEgp = feeCalc.netAmount;
  const formatDepositBalance = (amountEgp: number) => {
    if (!Number.isFinite(amountEgp)) amountEgp = 0;
    if (selectedCurrency === "USD") return isolateLtr(`${(amountEgp / rates.usd).toFixed(2)} USD`);
    if (selectedCurrency === "SAR") return isolateLtr(`${(amountEgp / rates.sar).toFixed(2)} SAR`);
    return isolateLtr(`${amountEgp.toFixed(2)} EGP`);
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
    method === "barq" ? orderAmountEgp / rates.sar : orderAmountEgp;
  const formattedOrderAmount = method === "barq"
    ? isolateLtr(`${orderAmountInPaymentCurrency.toFixed(2)} SAR`)
    : isolateLtr(`${orderAmountInPaymentCurrency.toFixed(2)} EGP`);
  const requiredInPaymentCurrency =
    method === "barq" ? requiredEgp / rates.sar : requiredEgp;
  const calculatedTransferAmount = grossDepositRequiredForNet(
    requiredInPaymentCurrency,
    fee,
    method === "barq" ? 2 : 0,
  );
  const displayedTransferAmount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? numericAmount
      : calculatedTransferAmount;
  const formattedTransferAmount = method === "barq"
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
    if ((method === "bank" || method === "barq") && !receiptUrl) {
      toast.error(
        method === "barq"
          ? "يرجى رفع صورة إيصال التحويل لخدمة برق لتأكيد الإيداع"
          : "يرجى رفع صورة إيصال التحويل البنكي لتأكيد الإيداع"
      );
      return;
    }
    setBusy(true);
    try {
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
      <div className="mx-auto w-full max-w-3xl py-3 font-['Cairo']" dir="rtl">
        <h1 className="mb-5 flex items-center justify-center gap-2 text-xl font-bold text-primary">
          <Wallet size={22} /> شحن المحفظة
        </h1>
        {requiredEgp > 0 && !rechargeId && (
          <div className="mx-0 mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-center sm:mx-1 sm:px-5">
            <strong className="block text-emerald-400">
              شحن الرصيد لإتمام الطلب
            </strong>
            {requestedService && (
              <span className="mt-1 block text-sm text-foreground">
                {requestedService}
              </span>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-primary/20 bg-background/60 px-3 py-3">
                <span className="block text-xs text-muted-foreground">
                  إجمالي سعر الطلب
                </span>
                <strong className="mt-1 block text-lg text-primary" dir="ltr">
                  {formattedOrderAmount}
                </strong>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-background/60 px-3 py-3">
                <span className="block text-xs text-muted-foreground">
                  المبلغ المطلوب تحويله
                </span>
                <strong className="mt-1 block text-lg text-emerald-400" dir="ltr">
                  {formattedTransferAmount}
                </strong>
              </div>
            </div>
            <span className="mt-3 block text-xs leading-6 text-muted-foreground">
              تم حساب مبلغ التحويل بدقة لضمان إضافة الرصيد الكافي لإتمام طلبك.
            </span>
          </div>
        )}
        {rechargeId ? (
          <div className="mx-0 rounded-2xl border border-primary/30 bg-card px-4 py-7 text-center sm:mx-1 sm:px-6">
            {["verified", "approved"].includes(recharge?.status) ? (
              <CheckCircle className="mx-auto mb-4 text-emerald-500" size={54} />
            ) : recharge?.status === "manual_review" ? (
              <ShieldAlert className="mx-auto mb-4 text-amber-500" size={54} />
            ) : (
              <Clock className="mx-auto mb-4 animate-pulse text-primary" size={54} />
            )}
            <h2 className="mb-3 text-xl font-bold">
              {["verified", "approved"].includes(recharge?.status)
                ? "تمت إضافة الرصيد"
                : recharge?.status === "manual_review"
                  ? "تحول الطلب إلى مراجعة يدوية"
                  : "في انتظار رسالة التحويل"}
            </h2>
            {!["verified", "approved", "manual_review"].includes(recharge?.status) && (
              <div className="mx-auto mb-4 w-fit rounded-xl border border-border bg-background px-5 py-3 font-mono text-3xl font-black" dir="ltr">
                {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                {String(remainingSeconds % 60).padStart(2, "0")}
              </div>
            )}
            <p className="text-sm leading-7 text-muted-foreground">
              صافي الرصيد المتوقع: {formatDepositBalance(
                Number(recharge?.netDepositEgp)
                || Number(recharge?.estimatedCreditUsd || 0) * rates.usd,
              )}
            </p>
            {recharge?.status === "manual_review" && (
              <>
                <p className="mt-4 text-sm leading-7 text-amber-400">
                  سيظهر الطلب للأدمن للموافقة اليدوية، ويمكنك أيضًا بدء تحقق تلقائي جديد.
                </p>
                <button
                  onClick={retryVerification}
                  disabled={retrying}
                  className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-black disabled:opacity-50"
                >
                  <RefreshCw size={17} className={retrying ? "animate-spin" : ""} />
                  {retrying ? "جاري المحاولة..." : "إعادة المحاولة"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mx-0 space-y-5 rounded-2xl border border-border bg-card px-4 py-6 sm:mx-1 sm:px-6">
            <div>
              <label className="mb-2 block text-sm text-muted-foreground">وسيلة الإيداع</label>
              <select
                value={method}
                onChange={(e) => {
                  const val = e.target.value;
                  setMethod(val);
                  if (typeof window !== "undefined") localStorage.setItem("preferred_payment_method", val);
                }}
                className="h-12 w-full rounded-xl border border-border bg-input px-4 [&>option]:bg-background [&>option]:text-foreground"
              >
                {wallets.map((w, i) => {
                  return (
                    <option key={i} value={w.type} disabled={w.disabled}>
                      {w.type === "vodafone" && (w.disabled ? "فودافون كاش / محفظة (غير متاح حالياً)" : "فودافون كاش / محفظة")}
                      {w.type === "instapay" && (w.disabled ? "InstaPay (غير متاح حالياً)" : "InstaPay")}
                      {w.type === "barq" && (w.disabled ? "برق (غير متاح حالياً)" : "برق")}
                      {w.type === "bank" && (w.disabled ? "تحويل بنكي (غير متاح حالياً)" : "تحويل بنكي")}
                    </option>
                  );
                })}
              </select>
            </div>
             {selected?.disabled ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center text-sm font-bold text-amber-400 space-y-2">
                <div className="text-base font-black flex items-center justify-center gap-2">
                  <ShieldAlert size={20} />
                  وسيلة الإيداع هذه ({selected.type === "vodafone" ? "فودافون كاش / المحافظ" : selected.type === "instapay" ? "InstaPay" : selected.type === "barq" ? "برق" : "التحويل البنكي"}) غير متاحة حالياً.
                </div>
                <p className="text-xs text-muted-foreground/90 font-normal">
                  يرجى اختيار وسيلة إيداع أخرى متاحة من القائمة أعلاه لإكمال عملية الشحن.
                </p>
              </div>
            ) : selected ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
                {selected.type === "bank" ? (
                  <>
                    <span className="block text-xs text-muted-foreground">بيانات التحويل البنكي:</span>
                    {selected.bankName && (
                      <div className="text-sm bg-background/60 p-3 rounded-lg border border-border flex justify-between items-center shadow-sm">
                        <span className="text-muted-foreground">اسم البنك:</span>
                        <strong className="text-foreground">{selected.bankName}</strong>
                      </div>
                    )}
                    {selected.holderName && (
                      <div className="text-sm bg-background/60 p-3 rounded-lg border border-border flex justify-between items-center shadow-sm">
                        <span className="text-muted-foreground">صاحب الحساب:</span>
                        <strong className="text-foreground">{selected.holderName}</strong>
                      </div>
                    )}
                    {!selected.bankName && !selected.holderName && selected.name && (
                      <div className="text-sm bg-background/60 p-3 rounded-lg border border-border flex justify-between items-center shadow-sm">
                        <span className="text-muted-foreground">البنك والمستفيد:</span>
                        <strong className="text-foreground">{selected.name}</strong>
                      </div>
                    )}
                    {selected.number && (
                      <div className="text-sm bg-background/60 p-3 rounded-lg border border-border flex justify-between items-center gap-2 shadow-sm">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs text-muted-foreground">رقم الحساب:</span>
                          <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selected.number}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.number);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary transition-all duration-300"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    )}
                    {selected.link && (
                      <div className="text-sm bg-background/60 p-3 rounded-lg border border-border flex justify-between items-center gap-2 shadow-sm">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs text-muted-foreground">رقم الحساب الدولي (IBAN):</span>
                          <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selected.link}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.link);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary transition-all duration-300"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    )}
                    {selected.swift && (
                      <div className="text-sm bg-background/60 p-3 rounded-lg border border-border flex justify-between items-center gap-2 shadow-sm">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs text-muted-foreground">السويفت كود (Swift Code):</span>
                          <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selected.swift}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.swift);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary transition-all duration-300"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    )}
                  </>
                ) : selected.type === "instapay" ? (
                  <div className="flex flex-col gap-3.5">
                    <span className="block text-xs font-semibold text-muted-foreground">وسيلة الدفع: انستاباي (InstaPay)</span>

                    {/* Native App Launch Button (Mobile Only) */}
                    <button
                      type="button"
                      onClick={handleOpenInstaPayApp}
                      className="inline-flex md:hidden h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-black hover:opacity-90 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Zap size={18} className="fill-black" />
                      فتح تطبيق InstaPay مباشر للتحويل
                    </button>

                    {/* Separated Number Box */}
                    {selected.number && (
                      <div className="text-sm bg-background/70 p-3.5 rounded-xl border border-border flex justify-between items-center gap-2 shadow-sm">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs text-muted-foreground font-medium">📱 رقم تحويل إنستاباي (الهاتف / الحساب):</span>
                          <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selected.number}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.number);
                            toast.success("تم نسخ رقم تحويل انستاباي بنجاح 📋");
                          }}
                          className="rounded-lg bg-primary/10 hover:bg-primary/20 px-3 py-2 text-xs font-bold text-primary transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Copy size={14} />
                          نسخ الرقم
                        </button>
                      </div>
                    )}

                    {/* Separated Username / IPA Box */}
                    {(selected.username || selected.ipa || (selected.link && selected.link.includes("@"))) && (() => {
                      const ipaValue = selected.username || selected.ipa || selected.link;
                      return (
                        <div className="text-sm bg-background/70 p-3.5 rounded-xl border border-border flex justify-between items-center gap-2 shadow-sm">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-xs text-muted-foreground font-semibold">👤 اسم مستخدم إنستاباي / العنوان (IPA):</span>
                            <strong className="font-mono text-base text-emerald-400 break-all" dir="ltr">{ipaValue}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(ipaValue);
                              toast.success("تم نسخ اسم مستخدم انستاباي بنجاح 📋");
                            }}
                            className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-400 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <Copy size={14} />
                            نسخ اليوزر
                          </button>
                        </div>
                      );
                    })()}

                    {/* Account Holder Name */}
                    {selected.name && (
                      <div className="text-xs text-muted-foreground bg-background/60 p-2.5 rounded-lg border border-border/60 w-fit">
                        صاحب الحساب / المستفيد: <strong className="text-foreground font-bold">{selected.name}</strong>
                      </div>
                    )}

                    {/* QR Code (Desktop Only) */}
                    {selected.qr && (
                      <div className="hidden md:flex flex-col items-center gap-3 bg-background/80 p-4 rounded-xl border border-border shadow-sm text-center">
                        <span className="text-xs font-bold text-muted-foreground">امسح رمز الاستجابة السريع (QR Code) للتحويل:</span>
                        <div className="bg-white p-3 rounded-2xl border border-border flex justify-center items-center shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selected.qr} alt="InstaPay QR Code" className="max-w-[180px] h-auto object-contain rounded-lg" />
                        </div>
                        <span className="text-[11px] text-amber-400 font-semibold">⚠️ افتح تطبيق InstaPay على هاتفك وامسح الرمز لإتمام التحويل بسرعة</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="block text-xs text-muted-foreground">حوّل إلى</span>
                    <div className="mt-2 flex items-center justify-between gap-3 bg-background p-3 rounded-lg border border-border shadow-sm" dir="ltr">
                      <strong className="break-all font-mono text-lg">{selected.number || selected.link}</strong>
                      <button
                        type="button"
                        onClick={copyWalletDetails}
                        className={`rounded-lg bg-primary/15 p-2 text-primary transition-all duration-300 flex items-center justify-center min-w-[40px] min-h-[40px] ${
                          copied ? "scale-110 rotate-[-8deg] bg-emerald-500/20 text-emerald-400" : "hover:scale-105"
                        }`}
                        aria-label="نسخ بيانات التحويل"
                      >
                        {copied
                          ? <CheckCircle size={17} className="animate-bounce" />
                          : <Copy size={17} />}
                      </button>
                    </div>
                    {selected.name && <span className="block text-xs text-muted-foreground bg-background/50 p-2 rounded-lg w-fit">باسم: <strong className="text-foreground">{selected.name}</strong></span>}
                  </>
                )}
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm text-muted-foreground">
                المبلغ (بـ {currency}) — أرقام صحيحة بدون كسور
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
                className="h-13 w-full rounded-xl border border-border bg-input px-5 text-left font-mono text-base outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                dir="ltr"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>الحد الأدنى: <strong className="text-foreground">{minimumEgp} {currency}</strong></span>
                <span>الحد الأقصى: <strong className="text-foreground">{maximumEgp} {currency}</strong></span>
              </div>
              {amount && !amountWithinLimits && (
                <p className="mt-2 text-xs font-semibold text-red-400">
                  أدخل مبلغًا بين {minimumEgp} و{maximumEgp} {currency}
                </p>
              )}
            </div>
            {method !== "bank" && (
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  {method === "barq" ? "اسم المحول بالإنجليزية" : method === "instapay" ? "الرقم المرجعي من رسالة SMS" : "رقم الهاتف المحول منه"}
                </label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} className="h-13 w-full rounded-xl border border-border bg-input px-5 text-left font-mono text-base outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20" dir="ltr" />
              </div>
            )}

            {/* Receipt upload box for Bank Transfer and manual proofs */}
            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-3 text-right">
              <label className="block text-sm font-bold text-cyan-400">
                📄 رفع صورة إيصال التحويل {(method === "bank" || method === "barq") ? "(إجباري)" : "(اختياري)"}
              </label>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-cyan-500/30 rounded-xl p-4 bg-background/50 hover:bg-background/80 transition-all cursor-pointer">
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
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/20 file:text-cyan-400 hover:file:bg-cyan-500/30 cursor-pointer"
                />
                {uploadingReceipt && (
                  <p className="mt-2 text-xs text-cyan-400 font-bold animate-pulse">جاري رفع صورة الإيصال إلى الخادم السحابي...</p>
                )}
                {receiptUrl && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-bold">
                    <CheckCircle size={15} /> تم رفع الإيصال بنجاح
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="underline text-cyan-400 mr-2 font-mono">
                      معاينة الإيصال
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className={`grid grid-cols-1 gap-2 ${user?.country_code === "SA" ? "sm:grid-cols-2" : ""}`}>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                <span className="block text-xs text-muted-foreground">سعر الدولار</span>
                <bdi className="mt-1 block text-sm font-bold text-primary" dir="ltr">
                  {user?.country_code === "SA"
                    ? `1 USD = ${(rates.usd / rates.sar).toFixed(2)} SAR`
                    : `1 USD = ${rates.usd.toFixed(2)} EGP`}
                </bdi>
              </div>
              {user?.country_code === "SA" && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                  <span className="block text-xs text-muted-foreground">سعر الريال</span>
                  <bdi className="mt-1 block text-sm font-bold text-primary" dir="ltr">
                    1 SAR = {rates.sar.toFixed(2)} EGP
                  </bdi>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-center">
              <span className="block text-xs text-muted-foreground">الرصيد الذي سيُضاف إلى المحفظة</span>
              <strong className="mt-1 block text-2xl font-black text-emerald-400 font-mono" dir="ltr">
                {amountWithinLimits ? displayNetInCurrency.toFixed(2) : "0.00"} {currency}
              </strong>
            </div>
            {amountWithinLimits && feeCalc.netAmount > 0 && tiktokCoins > 0 && tiktokCoins <= tiktokMaxCoins && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-center">
                <span className="block text-xs text-muted-foreground">العملات المتوقعة</span>
                <strong className="block text-lg font-bold text-emerald-400">
                  هذا المبلغ سوف يشحن لك {tiktokCoins.toLocaleString()} عمله تيك توك 🔥
                </strong>
                {originalTiktokCoins > 0 && tiktokCoins > originalTiktokCoins && (
                  <span className="block text-xs text-amber-300 font-semibold bg-amber-500/10 py-1.5 px-3 rounded-lg border border-amber-500/20">
                    (بدلاً من {originalTiktokCoins.toLocaleString()} عملة قبل الخصم — بزيادة هدية {(tiktokCoins - originalTiktokCoins).toLocaleString()} عملة 🔥!)
                  </span>
                )}
                <div className="h-[1px] bg-border my-1" />
                <p className="text-xs text-muted-foreground leading-5">
                  💡 للخدمات الأخرى: يرجى الدفع والطلب المباشر من خلال أقسام الموقع.
                </p>
              </div>
            )}
            {selected?.disabled && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-400">
                ⚠️ هذه الوسيلة غير متاحة حالياً — يرجى اختيار وسيلة أخرى أو التواصل مع الدعم
              </div>
            )}
            <button
              disabled={busy || uploadingReceipt || !user || !selected || selected.disabled || !amountWithinLimits || (method !== "bank" && !reference) || (method === "bank" && !receiptUrl)}
              onClick={submit}
              className="h-12 w-full rounded-xl bg-primary font-bold text-black disabled:opacity-40"
            >
              {busy ? "جاري التسجيل..." : method === "bank" ? "إرسال طلب التحويل البنكي للمراجعة 📄" : "تأكيد الإيداع"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
