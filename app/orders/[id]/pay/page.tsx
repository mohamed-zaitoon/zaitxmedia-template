"use client";

import { useEffect, useState, useRef, use } from "react";
import { useAuth } from "../../../../app/lib/auth-context";
import { CheckCircle, Clock, Copy, Info, AlertCircle, RefreshCw, ArrowRight, ExternalLink, QrCode } from "lucide-react";
import { db } from "../../../../app/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import Countdown from "react-countdown";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../../../app/components/ui/form";
import { Input } from "../../../../app/components/ui/input";
import { Card, CardContent } from "../../../../app/components/ui/card";
import { Button } from "../../../../app/components/ui/button";
import AppShell from "../../../../app/components/layout/AppShell";
import { toast } from "sonner";
import Link from "next/link";
import { isolateLtr } from "../../../lib/bidi";
import CustomWalletSelect from "@/app/components/CustomWalletSelect";

const tn = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/,/g, "")
    .replace(/٬/g, "")
    .replace(/٫/g, ".")
    .replace(/[^\d.]/g, "");

export default function OrderPayPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [verificationExpired, setVerificationExpired] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Form Schema based on selected wallet type
  const formSchema = z.object({
    walletType: z.string().min(1, "اختر طريقة الدفع"),
    reference: z.string().min(3, selectedWallet?.type === "barq" ? "يرجى إدخال الاسم" : "يرجى إدخال الرقم/المرجع")
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      walletType: "",
      reference: "",
    },
  });

  const watchWalletType = useWatch({ control: form.control, name: "walletType" });

  useEffect(() => {
    document.title = "دفع الطلب | ZAITX MEDIA";
  }, []);

  const hasFetchedWallets = useRef(false);

  // Fetch wallets settings
  useEffect(() => {
    if (user && !hasFetchedWallets.current) {
      hasFetchedWallets.current = true;
      getDoc(doc(db, "settings", "site")).then((s) => {
        if (s.exists() && s.data().wallets) {
          const activeWallets = s.data().wallets.filter((w: any) => w.isActive !== false);
          const grouped: Record<string, any[]> = {};
          
          activeWallets.forEach((w: any) => {
             let t = w.type || "vodafone";
             if (t === "fazer") t = "vodafone";
             if (!grouped[t]) grouped[t] = [];
             grouped[t].push({ ...w, type: t });
          });
          
          if (!grouped["barq"] && grouped["vodafone"]) {
            grouped["barq"] = grouped["vodafone"].map((v: any) => ({ ...v, type: "barq" }));
          }

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

          const isMobilePhone = typeof window !== "undefined" && (
            /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
          );

          const countryCode = user?.country_code || "EG";
          let relevantTypes: string[] = [];
          if (countryCode === "SA") {
            relevantTypes = ["barq", "bank"];
          } else {
            relevantTypes = ["instapay", "vodafone", "bank"];
          }

          const randomizedWallets: any[] = [];
          for (const type of relevantTypes) {
             const rawList = grouped[type] || [];
             const listByCountry = rawList.filter((w: any) => {
               if (!w.countryCode) return true;
               return w.countryCode === countryCode || w.countryCode === "GLOBAL";
             });
             if (listByCountry.length > 0) {
                 const list = listByCountry.filter((w: any) => w.isActive !== false);
                 if (list.length > 0) {
                     randomizedWallets.push(list[Math.floor(Math.random() * list.length)]);
                 } else {
                     randomizedWallets.push({ ...listByCountry[0], disabled: true });
                 }
             } else {
                 randomizedWallets.push({ type, disabled: true, number: "" });
             }
          }
          
          setWallets(randomizedWallets);
          if (randomizedWallets.length > 0) {
             const firstActive = randomizedWallets.find(w => !w.disabled) || randomizedWallets[0];
             setSelectedWallet(firstActive);
             form.setValue("walletType", firstActive.type);
          }
        }
      });
    }
  }, [user]);

  // Listen to order document to handle real-time payment updates with API fallback
  useEffect(() => {
    if (loading) return;
    if (!user || !resolvedParams.id) return;
    
    setLoadError("");

    async function fetchOrderViaApi() {
      try {
        const res = await fetch(`/api/orders/${resolvedParams.id}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.order) {
          setOrder(data.order);
          setLoadError("");
          setIsInitializing(false);
          return true;
        } else if (data.error) {
          setLoadError(data.error);
          setIsInitializing(false);
          return true;
        }
      } catch (e) {
        console.warn("API fallback order fetch failed:", e);
      }
      return false;
    }

    const unsubscribe = onSnapshot(
      doc(db, "orders", resolvedParams.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const orderData = { id: docSnap.id, ...docSnap.data() } as any;

          if (orderData.user_id !== user.id) {
            setLoadError("لا يمكنك عرض هذا الطلب من الحساب الحالي.");
            setIsInitializing(false);
            return;
          }

          setOrder(orderData);
          setLoadError("");
          setIsInitializing(false);

          if (orderData.paymentStatus === "paid" || orderData.paymentStatus === "manual_review") {
            const storageKey = `order_paid_${orderData.id}`;
            if (!sessionStorage.getItem(storageKey)) {
              sessionStorage.setItem(storageKey, "true");
              toast.success("تم تأكيد الدفع بنجاح!", {
                description: "جاري تجهيز طلبك الآن.",
                duration: 8000,
              });
            }
          }
        } else {
          fetchOrderViaApi().then((handled) => {
            if (!handled) {
              setLoadError("الطلب غير موجود أو تم حذفه.");
              setIsInitializing(false);
            }
          });
        }
      },
      (error) => {
        console.warn("Order client listener failed, attempting server API fallback:", error);
        fetchOrderViaApi().then((handled) => {
          if (!handled) {
            setLoadError("تعذر تحميل الطلب الآن. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.");
            setIsInitializing(false);
          }
        });
      },
    );

    return () => unsubscribe();
  }, [user?.id, resolvedParams.id]);

  useEffect(() => {
    if (watchWalletType) {
       const match = wallets.find(w => w.type === watchWalletType);
       if (match) setSelectedWallet(match);
    }
  }, [watchWalletType, wallets]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      toast.success("تم النسخ بنجاح");
      setTimeout(() => setCopied(""), 2000);
    } catch {
      toast.error("تعذر النسخ، حاول مرة أخرى");
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!order || order.paymentStatus !== "awaiting_payment") return;

    setBusy(true);

    try {
      const response = await fetch(`/api/orders/${order.id}/payment/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodKey: selectedWallet.type,
          reference: values.reference,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "PAYMENT_CONFIRM_FAILED");
    } catch (err) {
      toast.error(err instanceof Error && err.message !== "PAYMENT_CONFIRM_FAILED"
        ? err.message
        : "حدث خطأ أثناء حفظ بيانات التحويل، حاول مرة أخرى.");
    }
    setBusy(false);
  };

  const isVerifying = order?.paymentStatus === "verifying";
  const isPaid = order?.paymentStatus === "paid";
  const configuredDeadline = order?.verificationDeadline
    ? new Date(order.verificationDeadline).getTime()
    : 0;
  const verificationStartedAt =
    order?.verificationStartedAt?.toMillis?.() ||
    (order?.verificationStartedAt
      ? new Date(order.verificationStartedAt).getTime()
      : 0);
  const countdownDeadline =
    verificationStartedAt > 0
      ? Math.min(configuredDeadline || Infinity, verificationStartedAt + 5 * 60 * 1000)
      : configuredDeadline;

  useEffect(() => {
    if (!isVerifying || !countdownDeadline) {
      setVerificationExpired(false);
      return;
    }
    setVerificationExpired(Date.now() >= countdownDeadline);
  }, [isVerifying, countdownDeadline]);

  useEffect(() => {
    if (!isVerifying || !order?.id || !countdownDeadline) return;

    let stopped = false;
    const recheck = async () => {
      if (stopped || Date.now() > countdownDeadline) return;
      try {
        await fetch(`/api/orders/${order.id}/payment/recheck`, {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        // The Firestore listener remains active; retry on the next interval.
      }
    };

    recheck();
    const interval = window.setInterval(recheck, 5000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [isVerifying, order?.id, countdownDeadline]);

  if (loading || (user && isInitializing)) {
    return (
      <div className="premium-loader-container">
        <div className="premium-loader-wrapper">
          <div className="premium-loader"></div>
          <div className="premium-loader-inner"></div>
        </div>
        <span className="premium-loader-text">جاري تحميل الطلب...</span>
      </div>
    );
  }

  if (!user || loadError || !order) {
    return (
      <AppShell>
        <div className="flex min-h-[55vh] w-full items-center justify-center px-4 text-center" dir="rtl">
          <Card className="w-full border-destructive/30 bg-card">
            <CardContent className="flex flex-col items-center p-8">
              <AlertCircle size={42} className="mb-4 text-destructive" />
              <h1 className="mb-3 text-xl font-bold">تعذر فتح صفحة الدفع</h1>
              <p className="mb-6 text-sm leading-7 text-muted-foreground">
                {!user ? "يرجى تسجيل الدخول لعرض طلبك." : loadError}
              </p>
              <Link
                href={!user ? "/login" : "/orders"}
                className="rounded-xl bg-primary px-6 py-3 font-bold text-black"
              >
                {!user ? "تسجيل الدخول" : "عرض طلباتي"}
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full min-w-0 flex justify-center font-['Cairo']">
        <div className="w-full min-w-0 max-w-3xl py-3 sm:py-6">
          
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">{isPaid ? "حالة الطلب" : "إتمام الدفع"}</h1>
            <Link href="/" className="text-muted-foreground hover:text-primary flex items-center gap-2 text-sm">
                الرئيسية <ArrowRight size={16} />
            </Link>
          </div>

          {isPaid ? (
            <Card className="bg-primary/5 border-primary/30 mb-8 overflow-hidden shadow-lg shadow-primary/5">
              <CardContent className="p-8 md:p-12 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                   <CheckCircle size={40} className="text-primary" />
                </div>
                <h2 className="text-primary text-2xl md:text-3xl font-bold mb-6">تم الدفع بنجاح!</h2>
                {order?.authLink || order?.delivered_link ? (
                  <div className="mb-8 w-full max-w-md rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center shadow-lg backdrop-blur-md">
                    <h3 className="text-base font-black text-primary mb-2.5 flex items-center justify-center gap-2">
                      <ExternalLink size={20} /> رابط تسجيل الدخول جاهز!
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      قام المشرف بإرسال رابط تسجيل الدخول الخاص بك. اضغط على الزر أدناه لتأكيد الدخول عبر تيك توك:
                    </p>
                    <a
                      href={order.authLink || order.delivered_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 text-sm font-black text-slate-950 shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all no-underline"
                    >
                      <ExternalLink size={18} /> تسجيل الدخول إلى تيك توك 🚀
                    </a>
                  </div>
                ) : order?.qr_image ? (
                  <div className="mb-8 w-full max-w-md rounded-2xl border border-primary/30 bg-slate-950/90 p-5 text-center shadow-xl">
                    <div className="mb-3 flex items-center justify-center gap-2 font-black text-primary text-sm">
                      <QrCode size={20} /> صورة رمز QR جاهزة
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      امسح الرمز التالي باستخدام تطبيق تيك توك لتأكيد تسجيل الدخول:
                    </p>
                    <img src={order.qr_image} alt="QR لتسجيل الدخول إلى تيك توك" className="mx-auto max-w-[220px] rounded-xl bg-white p-3 shadow-md" />
                  </div>
                ) : (
                  <p className="text-muted-foreground mb-8 text-base leading-8">
                    {order?.fulfillmentType === "auth_link" || order?.options?.tiktokChoice === "link"
                      ? "⏳ انتظر قليلاً، جاري إرسال رابط تسجيل الدخول لك الآن من الأدمن..."
                      : order?.fulfillmentType === "qr" || order?.options?.tiktokChoice === "qr"
                      ? "⏳ انتظر قليلاً، جاري تجهيز صورة QR الخاصة بك..."
                      : "⚡ جاري تجهيز وتنفيذ طلبك الآن..."}
                  </p>
                )}
                <div className="bg-card p-6 rounded-2xl text-right border border-border w-full max-w-md shadow-sm mb-6">
                   <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-muted-foreground">رقم الطلب:</span>
                      <span className="text-foreground font-mono">#{order.id.substring(0,8)}</span>
                   </div>
                   <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground">الخدمة:</span>
                      <span className="text-foreground font-bold">{order.service_name}</span>
                   </div>
                </div>
                <Link href="/" className="bg-primary text-black font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors">
                  العودة للرئيسية
                </Link>
              </CardContent>
            </Card>
          ) : isVerifying ? (
          <Card className="bg-primary/5 border-primary/30 mb-8 overflow-hidden shadow-lg shadow-primary/5">
            <CardContent className="p-5 sm:p-8 md:p-12 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                 <Clock size={40} className="text-primary animate-pulse" />
              </div>
              <h2 className="text-primary text-2xl md:text-3xl font-bold mb-6">في انتظار رسالة التحويل...</h2>
              <p className="text-muted-foreground mb-8">
                 {verificationExpired
                   ? "انتهت مدة التحقق التلقائي، لكن طلبك ما زال محفوظاً ويمكن مراجعته دون إعادة تحميل الصفحة."
                   : `قمنا بتسجيل بيانات التحويل الخاصة بك، نحن بانتظار وصول رسالة تأكيد الدفع من ${order.paymentMethodKey === "instapay" ? "انستاباي" : "فودافون كاش"}.`}
              </p>

              <div className="bg-card rounded-2xl p-5 sm:p-6 mb-8 w-full max-w-sm border border-border shadow-sm">
                 <div className="text-sm text-muted-foreground mb-3">الوقت المتبقي للتحقق التلقائي</div>
                 <div className="text-4xl font-bold text-foreground font-mono tracking-widest" dir="ltr">
                    {countdownDeadline ? (
                      <Countdown
                        date={countdownDeadline}
                        onComplete={() => setVerificationExpired(true)}
                        renderer={({ hours, minutes, seconds, completed }) => {
                          if (completed) return <span>00:00</span>;
                          const totalMinutes = hours * 60 + minutes;
                          return (
                            <span>
                              {String(totalMinutes).padStart(2, "0")}:
                              {String(seconds).padStart(2, "0")}
                            </span>
                          );
                        }}
                      />
                    ) : "00:00"}
                 </div>
              </div>

              <div className="bg-card p-6 rounded-2xl text-right border border-border w-full max-w-md shadow-sm">
                 <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">رقم الطلب:</span>
                    <span className="text-foreground font-mono">#{order.id.substring(0,8)}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">المبلغ المطلوب:</span>
                    <bdi className="text-primary font-bold text-lg" dir="ltr">
                      {isolateLtr(`${Number(order.totalPayableEgp).toFixed(2)} EGP`)}
                    </bdi>
                 </div>
                 <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">وسيلة الدفع:</span>
                    <span className="text-foreground font-bold">{order.paymentMethodKey === "barq" ? "برق" : order.paymentMethodKey === "vodafone" ? "فودافون كاش" : "انستاباي"}</span>
                 </div>
              </div>
              <div className="mt-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
                 <AlertCircle size={16} className="text-primary" />
                 لا تقم بإغلاق هذه الصفحة، سيتم تحديثها تلقائياً فور وصول المبلغ.
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-card border-border mb-8 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-4 sm:p-7 md:p-10">
                <div className="bg-[#111] p-5 rounded-xl border border-[#222] mb-8">
                   <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                       <span className="text-muted-foreground">الخدمة:</span>
                       <span className="font-bold">{order?.service_name}</span>
                   </div>
                   <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                       <span className="text-muted-foreground">الكمية:</span>
                       <span className="font-bold">{order?.quantity}</span>
                   </div>
                   <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-[#222]">
                       <span className="text-muted-foreground font-bold">المبلغ الإجمالي المطلوب تحويله:</span>
                       <bdi className="text-primary font-bold text-xl" dir="ltr">{isolateLtr(`${Number(order?.totalPayableEgp).toFixed(2)} EGP`)}</bdi>
                   </div>
                </div>


                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
                    {/* Section 1: Payment Method */}
                    <div className="space-y-5">
                      <h2 className="text-lg md:text-xl flex items-center gap-3 font-bold text-foreground">
                        <span className="bg-primary/20 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                        اختر وسيلة التحويل
                      </h2>

                      <FormField
                        control={form.control}
                        name="walletType"
                        render={({ field }: any) => (
                          <FormItem>
                            <CustomWalletSelect
                              value={field.value}
                              onChange={field.onChange}
                              options={wallets}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedWallet && (
                        <div className="bg-primary/5 p-5 md:p-6 rounded-2xl border border-primary/20 space-y-4">
                          <p className="text-muted-foreground text-sm">قم بتحويل مبلغ <bdi className="font-bold text-foreground" dir="ltr">{isolateLtr(`${Number(order?.totalPayableEgp).toFixed(2)} EGP`)}</bdi> إلى التفاصيل التالية:</p>
                          
                          {selectedWallet.type === "bank" ? (
                            <div className="space-y-3.5">
                              {selectedWallet.bankName && (
                                <div className="text-sm bg-background p-4 rounded-xl border border-border flex justify-between items-center shadow-sm">
                                  <span className="text-muted-foreground">اسم البنك:</span>
                                  <strong className="text-foreground">{selectedWallet.bankName}</strong>
                                </div>
                              )}
                              {selectedWallet.holderName && (
                                <div className="text-sm bg-background p-4 rounded-xl border border-border flex justify-between items-center shadow-sm">
                                  <span className="text-muted-foreground">صاحب الحساب:</span>
                                  <strong className="text-foreground">{selectedWallet.holderName}</strong>
                                </div>
                              )}
                              {!selectedWallet.bankName && !selectedWallet.holderName && selectedWallet.name && (
                                <div className="text-sm bg-background p-4 rounded-xl border border-border flex justify-between items-center shadow-sm">
                                  <span className="text-muted-foreground">البنك والمستفيد:</span>
                                  <strong className="text-foreground">{selectedWallet.name}</strong>
                                </div>
                              )}
                              {selectedWallet.number && (
                                <div className="text-sm bg-background p-4 rounded-xl border border-border flex justify-between items-center gap-3 shadow-sm">
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <span className="text-xs text-muted-foreground">رقم الحساب:</span>
                                    <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selectedWallet.number}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(selectedWallet.number)}
                                    className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary border border-primary/20 transition-all shrink-0 cursor-pointer"
                                    aria-label="نسخ"
                                  >
                                    <Copy size={16} />
                                  </button>
                                </div>
                              )}
                              {selectedWallet.link && (
                                <div className="text-sm bg-background p-4 rounded-xl border border-border flex justify-between items-center gap-3 shadow-sm">
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <span className="text-xs text-muted-foreground">رقم الحساب الدولي (IBAN):</span>
                                    <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selectedWallet.link}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(selectedWallet.link)}
                                    className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary border border-primary/20 transition-all shrink-0 cursor-pointer"
                                    aria-label="نسخ"
                                  >
                                    <Copy size={16} />
                                  </button>
                                </div>
                              )}
                              {selectedWallet.swift && (
                                <div className="text-sm bg-background p-4 rounded-xl border border-border flex justify-between items-center gap-3 shadow-sm">
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <span className="text-xs text-muted-foreground">السويفت كود (Swift Code):</span>
                                    <strong className="font-mono text-base text-foreground break-all" dir="ltr">{selectedWallet.swift}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(selectedWallet.swift)}
                                    className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary border border-primary/20 transition-all shrink-0 cursor-pointer"
                                    aria-label="نسخ"
                                  >
                                    <Copy size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : selectedWallet.type === "instapay" ? (
                            <div className="space-y-4">
                              {/* Link Button */}
                              {(selectedWallet.link || selectedWallet.number)?.includes("http") && (() => {
                                const rawUrl = (selectedWallet.link || selectedWallet.number).match(/https?:\/\/[^\s]+|instapay:\/\/[^\s]+/)?.[0] || "#";
                                const deepLink = rawUrl.startsWith("https://ipn.eg") || rawUrl.startsWith("https://www.instapay") || rawUrl.startsWith("https://instapay")
                                  ? rawUrl.replace(/^https:\/\//, "instapay://")
                                  : rawUrl;
                                return (
                                  <a
                                    href={deepLink}
                                    rel="noreferrer"
                                    className="inline-flex md:hidden h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-black hover:opacity-90 transition-all mb-3 text-center no-underline"
                                  >
                                    ⚡ فتح الانستاباي للتحويل
                                  </a>
                                );
                              })()}
                              
                              {/* QR Code (desktop only) */}
                              {selectedWallet.qr && (
                                <div className="hidden md:flex flex-col items-center gap-3 bg-background p-4 rounded-xl border border-border shadow-sm mb-2 text-center">
                                  <span className="text-xs text-muted-foreground">امسح رمز الاستجابة السريع (QR Code) للتحويل:</span>
                                  <div className="bg-white p-3 rounded-2xl border border-border flex justify-center items-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={selectedWallet.qr} alt="InstaPay QR Code" className="max-w-[180px] h-auto object-contain rounded-lg" />
                                  </div>
                                  <span className="text-[10px] text-amber-400 font-semibold">⚠️ افتح تطبيق InstaPay وامسح الرمز لإتمام العملية</span>
                                </div>
                              )}
                              
                              {/* Manual copy box hidden for InstaPay per user request */}
                              
                              {(selectedWallet.name || selectedWallet.holderName) && (() => {
                                const holderStr = selectedWallet.holderName || selectedWallet.name;
                                return (
                                  <div className="flex items-center justify-between gap-3 text-sm bg-background/80 p-3.5 rounded-xl border border-border/80 w-full shadow-sm">
                                    <strong className="text-foreground font-black text-base">{holderStr}</strong>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(holderStr)}
                                      className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary border border-primary/20 transition-all shrink-0 cursor-pointer"
                                      aria-label="نسخ"
                                    >
                                      <Copy size={16} />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col md:flex-row justify-between md:items-center bg-background p-5 rounded-xl border border-border shadow-sm gap-4">
                                <div className="flex flex-col gap-1.5 w-full">
                                  <span className="text-xs text-muted-foreground font-medium">
                                    الرقم
                                  </span>
                                  <strong className="text-lg sm:text-xl md:text-2xl text-foreground tracking-wide font-mono break-all" dir="ltr">{selectedWallet.number}</strong>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => copyToClipboard(selectedWallet.number)}
                                  className={`p-3 rounded-lg flex items-center justify-center border border-primary/30 cursor-pointer transition-all duration-300 bg-primary/10 text-primary hover:bg-primary/20 shrink-0 ${
                                    copied === selectedWallet.number ? "scale-105 border-emerald-500/40 text-emerald-400" : ""
                                  }`}
                                  aria-label="نسخ"
                                >
                                  {copied === selectedWallet.number ? <CheckCircle size={18} className="animate-bounce" /> : <Copy size={18} />}
                                </button>
                              </div>

                              {(selectedWallet.name || selectedWallet.holderName) && (() => {
                                const holderStr = selectedWallet.holderName || selectedWallet.name;
                                return (
                                  <div className="flex items-center justify-between gap-3 text-sm bg-background/80 p-3.5 rounded-xl border border-border/80 w-full shadow-sm mt-2">
                                    <strong className="text-foreground font-black text-base">{holderStr}</strong>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(holderStr)}
                                      className="rounded-lg bg-primary/10 hover:bg-primary/20 p-2 text-primary border border-primary/20 transition-all shrink-0 cursor-pointer"
                                      aria-label="نسخ"
                                    >
                                      <Copy size={16} />
                                    </button>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="w-full h-px bg-border" />

                    {selectedWallet?.type === "bank" ? (
                      <div className="flex justify-center pt-2 w-full">
                        <a
                          href={`https://wa.me/201206126529?text=${encodeURIComponent(
                            `السلام عليكم، قمت بطلب الرقم #${order?.id || ""} بقيمة ${Number(order?.totalPayableEgp).toFixed(2)} EGP وأريد تأكيد التحويل البنكي.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full sm:w-[80%] h-14 text-base md:text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all text-center"
                        >
                          تأكيد التحويل البنكي عبر واتساب 💬
                        </a>
                      </div>
                    ) : (
                      <>
                        {/* Section 2: Transfer Details */}
                        <div className="space-y-5">
                          <h2 className="text-lg md:text-xl flex items-center gap-3 font-bold text-foreground">
                            <span className="bg-primary/20 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                            تأكيد التحويل
                          </h2>

                          <FormField
                            control={form.control}
                            name="reference"
                            render={({ field }: any) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground text-sm font-semibold mb-2 block">
                                  {selectedWallet?.type === "instapay" 
                                    ? "الرقم المرجعي من رسالة SMS" 
                                    : selectedWallet?.type === "barq"
                                    ? "اسم صاحب التحويل بالإنجليزية"
                                    : "رقم الهاتف المحول منه"}
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder={
                                    selectedWallet?.type === "instapay" ? "9206cb26" : 
                                    selectedWallet?.type === "barq" ? "AHMED ALI" : "01012345678"
                                  } {...field} className="h-12 bg-input border-border text-foreground text-base focus-visible:ring-primary rounded-xl" dir="ltr" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex justify-center pt-2">
                          <Button type="submit" disabled={busy || !selectedWallet} className="w-full sm:w-[80%] h-14 text-base md:text-lg font-bold bg-primary text-black hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20 transition-all">
                            {busy ? <RefreshCw className="animate-spin mr-2" /> : null}
                            {busy ? "جاري التأكيد..." : "لقد قمت بالتحويل"}
                          </Button>
                        </div>
                      </>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </>
        )}
        </div>
      </div>
    </AppShell>
  );
}
