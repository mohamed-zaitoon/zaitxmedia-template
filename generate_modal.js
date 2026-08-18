const fs = require('fs');
const code = `"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, ShoppingBag, Wallet, Info, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useCurrency } from "../lib/currency-context";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function CheckoutModal({ 
  service, 
  quantity, 
  priceEGP, 
  link, 
  userProfile, 
  onClose 
}: any) {
  const router = useRouter();
  const { convertPrice } = useCurrency();
  
  const isTikTokCoins = service?.name?.includes("عملات") && (service?.name?.includes("تيك توك") || service?.name?.includes("تيك تيك"));
  const isSecretSub = service?.name?.includes("اشتراك مخفي") || service?.name?.includes("سوبر فان") || (service?.name?.includes("اشتراك") && (service?.name?.includes("تيك توك") || service?.name?.includes("تيك تيك") || service?.category === "اشتراكات"));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [success, setSuccess] = useState(false);

  // Link Wait State
  const [waitingForLink, setWaitingForLink] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [authLink, setAuthLink] = useState("");

  const currentBalance = Number(userProfile?.balance) || 0;
  const canAfford = currentBalance >= priceEGP;
  
  const convertedBalance = convertPrice(currentBalance);
  const convertedPrice = convertPrice(priceEGP);

  const formSchema = z.object({
    tiktokChoice: z.string(),
    username: z.string(),
    password: z.string(),
    whatsapp: z.string(),
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
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tiktokChoice: isTikTokCoins ? "link" : "",
      username: "",
      password: "",
      whatsapp: userProfile?.whatsapp || "",
    }
  });

  const watchChoice = useWatch({ control: form.control, name: "tiktokChoice" });

  useEffect(() => {
    if (waitingForLink && orderId) {
      const unsub = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.authLink) {
            setAuthLink(data.authLink);
          }
        }
      });
      return () => unsub();
    }
  }, [waitingForLink, orderId]);

  const handlePurchase = async (values: z.infer<typeof formSchema>) => {
    if (!canAfford) return;

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
          options
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        if (isTikTokCoins && values.tiktokChoice === "link") {
          setOrderId(data.orderId);
          setWaitingForLink(true);
        } else {
          setSuccess(true);
          setTimeout(() => {
            onClose();
            router.push("/account");
          }, 2000);
        }
      } else {
        setMsg({ text: data.error || "حدث خطأ أثناء إتمام الطلب", type: "error" });
      }
    } catch (error) {
      setMsg({ text: "حدث خطأ غير متوقع", type: "error" });
    }
    
    setBusy(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      dir="rtl"
    >
      <div
        style={{
          background: "#111",
          borderRadius: 20,
          maxWidth: 500,
          width: "100%",
          padding: "32px 24px",
          textAlign: "center",
          border: "1px solid #222",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        className="font-['Cairo'] text-white"
      >
        {!waitingForLink && (
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
            <p style={{ color: "#aaa" }}>جاري تحويلك لقائمة الطلبات...</p>
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
                <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>
                <h2 style={{ color: "#fff", marginBottom: 8 }}>يرجى الانتظار...</h2>
                <p style={{ color: "#aaa" }}>جاري تجهيز رابط التسجيل الآمن لك.</p>
              </>
            )}
          </div>
        ) : !canAfford ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, background: "rgba(255, 68, 68, 0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <AlertCircle size={32} color="#ff4444" />
            </div>
            <h2 style={{ color: "#fff", marginBottom: 12, fontSize: 24 }}>رصيدك غير كافٍ</h2>
            <p style={{ color: "#aaa", marginBottom: 24, fontSize: 16 }}>
              لا يوجد لديك رصيد كافٍ لإتمام هذه العملية. يرجى شحن رصيدك للمتابعة.
            </p>
            
            <div style={{ background: "#111", padding: 16, borderRadius: 12, marginBottom: 24, border: "1px solid #222" }}>
               <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                 <span style={{ color: "#888" }}>الرصيد الحالي:</span>
                 <span style={{ color: "#fff", fontWeight: "bold" }}>{convertedBalance.formatted}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between" }}>
                 <span style={{ color: "#888" }}>المبلغ المطلوب:</span>
                 <span style={{ color: "#ff4444", fontWeight: "bold" }}>{convertedPrice.formatted}</span>
               </div>
            </div>

            <Button
              onClick={() => {
                const requiredAmount = Math.ceil(priceEGP * 1.005);
                const defaultMethod = service?.country === "SA" ? "barq" : "vodafone";
                router.push(\`/recharge?amount=\${requiredAmount}&method=\${defaultMethod}\`);
              }}
              className="w-full bg-[#38bdf8] text-black hover:bg-[#0ea5e9] py-6 text-lg font-bold"
            >
              <Wallet size={20} className="mr-2" /> المتابعة لشحن الرصيد الآن
            </Button>
            <button
              onClick={onClose}
              style={{ width: "100%", background: "transparent", color: "#888", border: "none", padding: "16px", marginTop: 8, fontWeight: "bold", cursor: "pointer", fontSize: 14 }}
            >
              إلغاء
            </button>
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
                        <label className="flex items-center gap-3 cursor-pointer text-gray-300">
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
                          <Input placeholder="اليوزر (Username)" {...field} className="bg-[#111] border-[#222] text-white" dir="ltr" />
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
                          <Input placeholder="كلمة السر (Password)" type="password" {...field} className="bg-[#111] border-[#222] text-white" dir="ltr" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {isTikTokCoins && watchChoice === "qr" && (
                <div style={{ background: "#0a0a0a", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #1a1a1a", textAlign: "center" }}>
                  <QrCode size={40} color="#38bdf8" style={{ marginBottom: 12 }} />
                  <div style={{ color: "#fff", fontSize: 15, fontWeight: "bold", marginBottom: 8 }}>جارٍ تجهيز رمز QR لك</div>
                  <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                    يرجى المتابعة لإتمام الطلب، ثم الانتقال إلى <strong>صفحة طلباتي</strong> لمسح رمز الـ QR عند ظهوره.
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel className="text-gray-400">رقم الواتساب للتواصل</FormLabel>
                        <FormControl>
                          <Input placeholder="01xxxxxxxxx" {...field} className="bg-[#111] border-[#222] text-white" dir="ltr" />
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
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>{service.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#888", fontSize: 13 }}>الكمية:</span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>{quantity}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", paddingTop: 12, marginTop: 12 }}>
                  <span style={{ color: "#888", fontSize: 14 }}>الإجمالي المطلوب:</span>
                  <span style={{ color: "#38bdf8", fontSize: 18, fontWeight: "bold" }}>{convertedPrice.formatted}</span>
                </div>
              </div>

              <div style={{ background: canAfford ? "rgba(0,255,128,0.05)" : "rgba(255,68,68,0.05)", borderRadius: 12, padding: 16, textAlign: "right", marginBottom: 20, border: \`1px solid \${canAfford ? "rgba(0,255,128,0.2)" : "rgba(255,68,68,0.2)"}\`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Wallet size={24} color={canAfford ? "#00ff80" : "#ff4444"} />
                  <div>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>رصيد المحفظة</div>
                    <div style={{ color: "#888", fontSize: 12 }}>الرصيد الحالي الخاص بك</div>
                  </div>
                </div>
                <strong style={{ color: canAfford ? "#00ff80" : "#ff4444", fontSize: 18 }}>{convertedBalance.formatted}</strong>
              </div>

              {msg.text && (
                <div style={{ padding: 10, background: msg.type === "success" ? "rgba(0,255,128,0.1)" : "rgba(255,68,68,0.1)", color: msg.type === "success" ? "#00ff80" : "#ff4444", borderRadius: 8, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <AlertCircle size={16} /> {msg.text}
                </div>
              )}

              <p style={{ color: "#ffaa00", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <AlertCircle size={14} /> 
                تأكيد الطلب سيبدأ التنفيذ مباشرة وتخصم التكلفة.
              </p>
              
              <Button
                type="submit"
                disabled={busy}
                className="w-full font-bold py-6 text-lg"
                style={{
                  background: busy ? "#333" : "#38bdf8",
                  color: busy ? "#888" : "#000",
                }}
              >
                {busy ? "جاري التنفيذ..." : "إرسال الطلب"}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
`
fs.writeFileSync('app/components/CheckoutModal.tsx', code);
console.log('CheckoutModal.tsx written');
