"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertCircle, ShoppingBag, Wallet, Info, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useCurrency, ceilTo2Decimals } from "../lib/currency-context";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { grossDepositRequiredForNet } from "@/lib/money/wallet";
import { isolateLtr } from "../lib/bidi";

function getFullFormattedWhatsapp(profile: any) {
  if (!profile) return "+20";
  let raw = String(profile.whatsapp || profile.phone || "").trim();
  const countryCode = profile.country_code === "SA" ? "+966" : "+20";
  if (!raw) return countryCode;
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (raw.startsWith("0")) raw = raw.slice(1);
  return `${countryCode}${raw}`;
}

export default function CheckoutModal({ 
  service, 
  quantity, 
  priceEGP, 
  link, 
  userProfile, 
  onClose 
}: any) {
  const router = useRouter();
  const { rates, selectedCurrency, symbols } = useCurrency();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isTikTokCoins = service?.name?.includes("عملات") && (service?.name?.includes("تيك توك") || service?.name?.includes("تيك تيك"));
  const isSecretSub = service?.name?.includes("اشتراك مخفي") || service?.name?.includes("سوبر فان") || (service?.name?.includes("اشتراك") && (service?.name?.includes("تيك توك") || service?.name?.includes("تيك تيك") || service?.category === "اشتراكات"));
  const isChatGPT = service?.name?.toLowerCase().includes("chatgpt") || service?.category?.toLowerCase().includes("chatgpt") || service?.category?.includes("شات جي بي تي");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [success, setSuccess] = useState(false);

  // Link Wait State
  const [waitingForLink, setWaitingForLink] = useState(false);
  const [waitingForQr, setWaitingForQr] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [authLink, setAuthLink] = useState("");
  const [qrImage, setQrImage] = useState("");

  const [feePercent, setFeePercent] = useState<number>(0.5);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        const p = Number(d.deposit_fee_percent ?? d.depositFeePercent ?? 0.5);
        if (Number.isFinite(p) && p >= 0) {
          setFeePercent(p);
        }
      }
    });
    return () => unsub();
  }, []);

  const currentBalance = Number(userProfile?.balance) || 0;
  const currentBalanceEgp = currentBalance * rates.usd;
  // Use Math.round to avoid floating point precision issues (e.g. 672.7299999999999 >= 672.73)
  const canAfford = Math.round(currentBalanceEgp * 100) >= Math.round(priceEGP * 100);
  const missingBalanceEgp = Math.max(0, Number(priceEGP) - currentBalanceEgp);
  const usesSar = userProfile?.country_code === "SA";
  const toLocalAmount = (amountEgp: number) =>
    usesSar ? amountEgp / rates.sar : amountEgp;
  const formatLocalAmount = (amountEgp: number) => {
    if (selectedCurrency === "USD") {
      const amt = ceilTo2Decimals(amountEgp / rates.usd);
      return isolateLtr(`${symbols.usd || "$"}${amt.toFixed(2)}`);
    }
    if (usesSar || selectedCurrency === "SAR") {
      const amt = ceilTo2Decimals(amountEgp / rates.sar);
      return isolateLtr(`${amt.toFixed(2)} ${symbols.sar || "﷼"}`);
    }
    const amt = ceilTo2Decimals(amountEgp);
    return isolateLtr(`${amt.toFixed(2)} ${symbols.egp || "£"}`);
  };
  const missingBalanceLocal = toLocalAmount(missingBalanceEgp);
  const rechargeAmountWithFee = grossDepositRequiredForNet(
    missingBalanceLocal,
    feePercent,
    usesSar ? 2 : 0,
  );
  const formattedRechargeAmount = usesSar
    ? isolateLtr(`${(Math.round(rechargeAmountWithFee * 100) / 100).toFixed(2)} SAR`)
    : isolateLtr(`${(Math.round(rechargeAmountWithFee * 100) / 100).toFixed(2)} EGP`);

  const formSchema = z.object({
    tiktokChoice: z.string(),
    username: z.string(),
    password: z.string(),
    whatsapp: z.string(),
    googleAccount: z.string(),
    verificationCode: z.string(),
  }).superRefine((data, ctx) => {
    if (isTikTokCoins) {
       if (data.tiktokChoice === "userpass") {
          if (!data.username) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال اليوزر", path: ["username"] });
          if (!data.password) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال كلمة السر", path: ["password"] });
       }
       if (data.tiktokChoice === "qr" && !data.whatsapp) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "رقم الواتساب مطلوب للتواصل", path: ["whatsapp"] });
       }
    } else if (isSecretSub) {
       if (!data.username) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال اليوزر", path: ["username"] });
       if (!data.password) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال كلمة السر", path: ["password"] });
    } else if (isChatGPT) {
       if (!data.googleAccount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال حساب جوجل (الإيميل)", path: ["googleAccount"] });
       if (!data.password) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال كلمة المرور", path: ["password"] });
       if (!data.verificationCode) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال رمز التحقق", path: ["verificationCode"] });
       if (!data.whatsapp) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مطلوب إدخال رقم الواتساب للتواصل", path: ["whatsapp"] });
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tiktokChoice: isTikTokCoins ? "link" : "",
      username: "",
      password: "",
      whatsapp: getFullFormattedWhatsapp(userProfile),
      googleAccount: "",
      verificationCode: "",
    }
  });

  const watchChoice = useWatch({ control: form.control, name: "tiktokChoice" });

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      if (isTikTokCoins && form.getValues("tiktokChoice") === "link") {
        form.setValue("tiktokChoice", "qr");
      }
    }
  }, [isTikTokCoins, form]);

  useEffect(() => {
    if ((waitingForLink || waitingForQr) && orderId) {
      const unsub = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (waitingForLink && data.authLink) {
            setAuthLink(data.authLink);
          }
          if (waitingForQr && data.qr_image) {
            setQrImage(data.qr_image);
          }
        }
      });
      return () => unsub();
    }
  }, [waitingForLink, waitingForQr, orderId]);

  const handlePurchase = async (values: z.infer<typeof formSchema>) => {
    setBusy(true);
    setMsg({ text: "", type: "" });

    try {
      const options: any = {};
      if (isTikTokCoins) {
        options.tiktokChoice = values.tiktokChoice;
        if (values.tiktokChoice === "userpass") {
          options.username = values.username;
          options.password = values.password;
        }
        if (values.tiktokChoice === "qr") {
          options.whatsapp = values.whatsapp;
        }
      } else if (isSecretSub) {
        options.username = values.username;
        options.password = values.password;
      } else if (isChatGPT) {
        options.googleAccount = values.googleAccount;
        options.password = values.password;
        options.verificationCode = values.verificationCode;
        options.whatsapp = values.whatsapp;
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userProfile.id,
          serviceId: service.service || service.id || "custom_service",
          serviceName: service.name,
          quantity,
          priceEGP,
          link,
          options,
        }),
      });
      const data = await res.json();
      
      if (res.ok) {
        if (typeof window !== "undefined") {
          localStorage.setItem("zaitx_active_order_id", data.orderId);
        }
        onClose();
        router.push(`/orders/${data.orderId}/pay`);
      } else {
        setMsg({ text: data.error || "حدث خطأ أثناء إتمام الطلب", type: "error" });
      }
    } catch (error) {
      setMsg({ text: "حدث خطأ غير متوقع", type: "error" });
    }
    
    setBusy(false);
  };

  if (!mounted || typeof window === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      dir="rtl"
    >
      <div
        style={{
          background: "rgba(10, 16, 30, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: 28,
          maxWidth: 520,
          width: "100%",
          padding: "36px 28px",
          textAlign: "center",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        className="font-['Cairo'] text-white"
      >
        {!(waitingForLink || waitingForQr) && (
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,0.05)", border: "none", color: "#888", cursor: "pointer", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={18} />
          </button>
        )}

        {success ? (
          <div style={{ padding: "20px 0" }}>
            <CheckCircle size={64} color="#00ff80" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ color: "#00ff80", marginBottom: 8 }}>تم استلام طلبك بنجاح!</h2>
            <p style={{ color: "#aaa" }}>تم الخصم من رصيدك، جاري فتح حالة الطلب...</p>
          </div>
        ) : waitingForLink ? (
          <div style={{ padding: "20px 0" }}>
            {authLink ? (
              <>
                <CheckCircle size={64} color="#38bdf8" style={{ margin: "0 auto 16px" }} />
                <h2 style={{ color: "#fff", marginBottom: 16 }}>الرابط جاهز!</h2>
                <a 
                  href={authLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", background: "#38bdf8", color: "#000", padding: "12px 24px", borderRadius: 8, fontWeight: "bold", textDecoration: "none", marginBottom: 16 }}
                  onClick={() => {
                    setSuccess(true);
                    setTimeout(() => {
                      onClose();
                      router.push("/account");
                    }, 3000);
                  }}
                >
                  تسجيل الدخول من تيك توك
                </a>
                <p style={{ color: "#888", fontSize: 12 }}>عند الانتهاء من التسجيل سيتم توجيهك.</p>
              </>
            ) : (
              <>
                <div style={{ width: 40, height: 40, border: "4px solid #333", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <h2 style={{ color: "#fff", marginBottom: 8 }}>يرجى الانتظار...</h2>
                <p style={{ color: "#aaa" }}>جاري تجهيز رابط التسجيل الآمن لك.</p>
              </>
            )}
          </div>
        ) : waitingForQr ? (
          <div style={{ padding: "20px 0" }}>
            {qrImage ? (
              <>
                <CheckCircle size={64} color="#38bdf8" style={{ margin: "0 auto 16px" }} />
                <h2 style={{ color: "#fff", marginBottom: 16 }}>رمز QR جاهز!</h2>
                <img src={qrImage} alt="QR Code" style={{ maxWidth: "200px", margin: "0 auto 16px", borderRadius: "8px" }} />
                <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>يرجى مسح الرمز باستخدام تطبيق تيك توك لتأكيد الدخول.</p>
                <Button
                  onClick={() => {
                    setSuccess(true);
                    setTimeout(() => {
                      onClose();
                      router.push("/account");
                    }, 3000);
                  }}
                  className="bg-[#38bdf8] text-black hover:bg-[#0ea5e9] font-bold"
                >
                  تم مسح الرمز بنجاح
                </Button>
              </>
            ) : (
              <>
                <div style={{ width: 40, height: 40, border: "4px solid #333", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <h2 style={{ color: "#fff", marginBottom: 8 }}>يرجى الانتظار...</h2>
                <p style={{ color: "#aaa" }}>جاري تجهيز رمز QR لك، لا تغلق هذه الصفحة.</p>
              </>
            )}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePurchase)}>
              <ShoppingBag size={40} color="#38bdf8" style={{ margin: "0 auto 12px" }} />
              <h2 style={{ color: "#fff", margin: "0 0 20px 0", fontSize: 20 }}>تأكيد الطلب</h2>

              {isTikTokCoins ? (
                <div style={{ background: "#0a0a0a", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #1a1a1a", textAlign: "right" }}>
                  <h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 12px 0" }}>اختر طريقة الشحن:</h3>
                  <FormField
                    control={form.control}
                    name="tiktokChoice"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-3 space-y-0">
                        <label className="flex md:hidden items-center gap-3 cursor-pointer text-gray-300">
                          <input type="radio" value="link" checked={field.value === "link"} onChange={() => field.onChange("link")} className="accent-[#38bdf8] w-4 h-4" />
                          الشحن بلينك (سريع وآمن)
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer text-gray-300">
                          <input type="radio" value="qr" checked={field.value === "qr"} onChange={() => field.onChange("qr")} className="accent-[#38bdf8] w-4 h-4" />
                          مسح QR Code
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer text-gray-300">
                          <input type="radio" value="userpass" checked={field.value === "userpass"} onChange={() => field.onChange("userpass")} className="accent-[#38bdf8] w-4 h-4" />
                          يوزر وباسورد
                        </label>
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {((isTikTokCoins && watchChoice === "userpass") || isSecretSub) && (
                <div style={{ background: "#0a0a0a", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #1a1a1a", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffaa00", marginBottom: 12, fontSize: 13, background: "rgba(255, 170, 0, 0.1)", padding: 8, borderRadius: 8 }}>
                    <Info size={16} /> يرجى تعطيل التحقق بخطوتين قبل إرسال الطلب لتجنب التأخير.
                  </div>
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormControl>
                          <Input placeholder="اسم المستخدم / اليوزر" {...field} className="bg-[#111] border-[#222] text-white" dir="auto" style={{ unicodeBidi: "plaintext" }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="كلمة المرور" type="password" {...field} className="bg-[#111] border-[#222] text-white" dir="auto" style={{ unicodeBidi: "plaintext" }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {isChatGPT && (
                <div style={{ background: "#0c1726", borderRadius: 16, padding: 18, marginBottom: 20, border: "1px solid #263b5f", textAlign: "right" }}>
                  <div style={{ fontWeight: "bold", fontSize: 14, color: "#38bdf8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    🔑 بيانات حساب جوجل لشحن ChatGPT Plus
                  </div>
                  <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 14, background: "rgba(251,191,36,0.08)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.2)" }}>
                    ⚠️ ملاحظة هامة: يرجى إدخال حساب جوجل الرئيسي المسجل به الاشتراك (وليس حساب ChatGPT مستقل).
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="googleAccount"
                    render={({ field }) => (
                      <FormItem style={{ marginBottom: 12 }}>
                        <FormLabel style={{ fontSize: 13, color: "#cbd5e1" }}>1. حساب جوجل (Google Email)</FormLabel>
                        <FormControl>
                          <Input placeholder="user@gmail.com" {...field} className="bg-[#111b2e] border-[#263b5f] text-white h-11 px-4" dir="auto" style={{ unicodeBidi: "plaintext" }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem style={{ marginBottom: 12 }}>
                        <FormLabel style={{ fontSize: 13, color: "#cbd5e1" }}>2. كلمة المرور (Password)</FormLabel>
                        <FormControl>
                          <Input placeholder="كلمة المرور الخاصة بحساب جوجل" type="password" {...field} className="bg-[#111b2e] border-[#263b5f] text-white h-11 px-4" dir="auto" style={{ unicodeBidi: "plaintext" }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="verificationCode"
                    render={({ field }) => (
                      <FormItem style={{ marginBottom: 12 }}>
                        <FormLabel style={{ fontSize: 13, color: "#cbd5e1" }}>3. رمز التحقق (2FA / Verification Code)</FormLabel>
                        <FormControl>
                          <Input placeholder="123456" {...field} className="bg-[#111b2e] border-[#263b5f] text-white h-11 px-4" dir="auto" style={{ unicodeBidi: "plaintext" }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel style={{ fontSize: 13, color: "#cbd5e1" }}>4. رقم الواتساب للتواصل</FormLabel>
                        <FormControl>
                          <Input placeholder="+201012345678" inputMode="tel" {...field} className="bg-[#111b2e] border-[#263b5f] text-white h-11 px-4" dir="auto" style={{ unicodeBidi: "plaintext" }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}


              <div style={{ background: "#0a0a0a", borderRadius: 12, padding: 16, textAlign: "right", marginBottom: 20, border: "1px solid #1a1a1a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#888", fontSize: 13 }}>الخدمة:</span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold", unicodeBidi: "plaintext" }} dir="auto">
                    <bdi>{service.name}</bdi>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#888", fontSize: 13 }}>الكمية:</span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>{quantity}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", paddingTop: 12, marginTop: 12 }}>
                  <span style={{ color: "#888", fontSize: 14 }}>إجمالي سعر الطلب:</span>
                  <span style={{ color: "#38bdf8", fontSize: 18, fontWeight: "bold" }}>{formatLocalAmount(Number(priceEGP))}</span>
                </div>
              </div>

              <div style={{ background: "rgba(0,255,128,0.05)", borderRadius: 12, padding: 16, textAlign: "right", marginBottom: 20, border: `1px solid rgba(0,255,128,0.2)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Wallet size={24} color="#00ff80" />
                  <div>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>طريقة الدفع</div>
                    <div style={{ color: "#888", fontSize: 12 }}>خصم مباشر من رصيد المحفظة</div>
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#888", fontSize: 11 }}>رصيدك</div>
                  <strong style={{ color: canAfford ? "#00ff80" : "#ff4444", fontSize: 15 }}>
                    {formatLocalAmount(currentBalanceEgp)}
                  </strong>
                </div>
              </div>

              {msg.text && (
                <div style={{ padding: 10, background: msg.type === "success" ? "rgba(0,255,128,0.1)" : "rgba(255,68,68,0.1)", color: msg.type === "success" ? "#00ff80" : "#ff4444", borderRadius: 8, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <AlertCircle size={16} /> {msg.text}
                </div>
              )}

              <p style={{ color: "#ffaa00", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <AlertCircle size={14} /> 
                {canAfford
                  ? "سيتم خصم قيمة الطلب من رصيد المحفظة."
                  : "رصيدك غير كافٍ؛ اشحن المحفظة أولاً."}
              </p>

              {!canAfford && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.22)", borderRadius: 12, padding: 12 }}>
                    <span style={{ display: "block", color: "#aaa", fontSize: 11, marginBottom: 6 }}>سعر الطلب الأصلي</span>
                    <strong style={{ color: "#38bdf8", fontSize: 16 }}>{formatLocalAmount(Number(priceEGP))}</strong>
                  </div>
                  <div style={{ background: "rgba(0,255,128,0.08)", border: "1px solid rgba(0,255,128,0.22)", borderRadius: 12, padding: 12 }}>
                    <span style={{ display: "block", color: "#aaa", fontSize: 11, marginBottom: 6 }}>المبلغ المطلوب شحنه</span>
                    <strong style={{ color: "#00ff80", fontSize: 16 }}>{formattedRechargeAmount}</strong>
                  </div>
                </div>
              )}
              
              {/* ⚠️ التنبيهات والتعليمات فوق زر الدفع مباشرة */}
              {(service?.alertNote || service?.notice || service?.categoryAlert) && (
                <div className="bg-gradient-to-br from-amber-950/70 via-amber-900/35 to-slate-950 border-2 border-amber-500/60 text-amber-100 p-4 md:p-5 rounded-2xl text-right mb-4 shadow-[0_0_25px_rgba(245,158,11,0.22)] relative overflow-hidden backdrop-blur-md">
                  <div className="flex items-center gap-2.5 text-amber-400 font-black text-base mb-2">
                    <AlertCircle size={22} className="text-amber-400 shrink-0 animate-pulse" />
                    <span>⚠️ تنبيه وملاحظة هامة جداً:</span>
                  </div>
                  <div className="leading-relaxed whitespace-pre-line text-sm text-amber-100 font-bold pr-1">
                    {service.alertNote || service.notice || service.categoryAlert}
                  </div>
                </div>
              )}

              {(service?.instructions || service?.shippingInstructions || service?.categoryInstructions) && (
                <div className="bg-gradient-to-br from-cyan-950/70 via-cyan-900/35 to-slate-950 border-2 border-cyan-500/60 text-cyan-100 p-4 md:p-5 rounded-2xl text-right mb-4 shadow-[0_0_25px_rgba(6,182,212,0.22)] relative overflow-hidden backdrop-blur-md">
                  <div className="flex items-center gap-2.5 text-cyan-400 font-black text-base mb-2">
                    <Info size={22} className="text-cyan-400 shrink-0" />
                    <span>📋 تعليمات الشحن وتطبيق الطلب:</span>
                  </div>
                  <div className="leading-relaxed whitespace-pre-line text-sm text-slate-100 font-bold pr-1">
                    {service.instructions || service.shippingInstructions || service.categoryInstructions}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                {canAfford ? (
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full font-black h-13 min-h-[52px] text-base rounded-xl shadow-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-sky-500 text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {busy ? "جاري الخصم وصنع الطلب..." : "إتمام الطلب والدفع من الرصيد ⚡"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full font-black h-13 min-h-[52px] text-base rounded-xl shadow-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                    onClick={() => {
                      const params = new URLSearchParams({
                        requiredEgp: missingBalanceEgp.toFixed(2),
                        orderAmountEgp: Number(priceEGP).toFixed(2),
                        service: String(service?.name || ""),
                      });
                      onClose();
                      router.push(`/recharge?${params.toString()}`);
                    }}
                  >
                    شحن الرصيد ⚡
                  </Button>
                )}
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>,
    document.body
  );
}
