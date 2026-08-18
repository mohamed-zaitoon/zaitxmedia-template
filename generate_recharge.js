const fs = require('fs');

const code = `
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { ArrowRight, Wallet, CheckCircle, Clock, Copy, Info, AlertCircle, RefreshCw } from "lucide-react";
import { db } from "../lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import Countdown from "react-countdown";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

const tn = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/,/g, "")
    .replace(/٬/g, "")
    .replace(/٫/g, ".")
    .replace(/[^\\d.]/g, "");

export default function RechargePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const requestedAmount = searchParams?.get("amount");
  const requestedMethod = searchParams?.get("method");
  
  const [wallets, setWallets] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [copied, setCopied] = useState("");

  const [activeRequest, setActiveRequest] = useState<any>(null);

  // Zod Schema based on selected wallet
  const rechargeSchema = z.object({
    walletType: z.string().min(1, "اختر طريقة الدفع"),
    amount: z.string().refine((val) => {
      const num = Number(tn(val));
      if (isNaN(num)) return false;
      if (selectedWallet && (num < selectedWallet.min || num > selectedWallet.max)) return false;
      if (selectedWallet && selectedWallet.type !== "barq" && !Number.isInteger(num)) return false;
      return true;
    }, (val) => {
      const num = Number(tn(val));
      if (selectedWallet && selectedWallet.type !== "barq" && !Number.isInteger(num)) {
         return { message: "لا نقبل الكسور للتحويلات البنكية المصرية. يرجى إدخال مبلغ صحيح." };
      }
      return { message: \`المبلغ يجب أن يكون بين \${Math.max(100, selectedWallet?.min || 100)} و \${selectedWallet?.max || 99999}\` };
    }),
    reference: z.string().min(3, selectedWallet?.type === "barq" ? "يرجى إدخال الاسم" : "يرجى إدخال الرقم/المرجع")
  });

  const form = useForm<z.infer<typeof rechargeSchema>>({
    resolver: zodResolver(rechargeSchema),
    defaultValues: {
      walletType: "",
      amount: requestedAmount || "",
      reference: "",
    },
  });

  const watchAmount = useWatch({ control: form.control, name: "amount" });
  const watchWalletType = useWatch({ control: form.control, name: "walletType" });

  useEffect(() => {
    document.title = "شحن الرصيد | ZAITX MEDIA";
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
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
          
          if (grouped["vodafone"]) {
              grouped["barq"] = grouped["vodafone"].map((v: any) => {
                 let num = v.number || "";
                 if (num) {
                   if (!num.startsWith("+20") && num.startsWith("0")) num = "+20" + num.substring(1);
                   else if (!num.startsWith("+20")) num = "+20" + num;
                 }
                 return { ...v, type: "barq", number: num };
              });
          }
          
          const randomizedWallets: any[] = [];
          for (const type of ["vodafone", "instapay", "barq"]) {
             if (grouped[type] && grouped[type].length > 0) {
                 const list = grouped[type];
                 randomizedWallets.push(list[Math.floor(Math.random() * list.length)]);
             } else if (type === "instapay") {
                 randomizedWallets.push({ type: "instapay", name: "انستاباي", disabled: true, number: "" });
             }
          }
          
          const countryCode = user?.country_code || "EG";
          const filteredWallets = randomizedWallets.filter(w => {
              if (countryCode === "SA") return w.type === "barq";
              return w.type !== "barq";
          });
          
          setWallets(filteredWallets);
          if (filteredWallets.length > 0) {
             const defaultWallet = requestedMethod ? filteredWallets.find(w => w.type === requestedMethod) || filteredWallets[0] : filteredWallets[0];
             setSelectedWallet(defaultWallet);
             form.setValue("walletType", defaultWallet.type);
          }
        }
      });
      
      const q = query(collection(db, "recharges"), where("userId", "==", user.id));
      const unsubscribe = onSnapshot(q, (snap) => {
        const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        hist.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setHistory(hist);
        
        const active = hist.find((h: any) => 
           (h.status === "awaiting_payment" || h.status === "matching" || h.status === "manual_review") && 
           (!h.superseded) &&
           (h.verificationDeadline && h.verificationDeadline.toMillis() > Date.now())
        );
        setActiveRequest(active || null);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Update selectedWallet when select changes
  useEffect(() => {
    if (watchWalletType) {
       const match = wallets.find(w => w.type === watchWalletType);
       if (match) setSelectedWallet(match);
    }
  }, [watchWalletType, wallets]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 2000);
  };

  const onSubmit = async (values: z.infer<typeof rechargeSchema>) => {
    if (activeRequest) {
       setMsg({ text: "لديك طلب شحن قيد الانتظار بالفعل.", type: "error" });
       return;
    }

    setBusy(true);
    setMsg({ text: "", type: "" });

    try {
      const numAmount = Number(tn(values.amount));
      let feeMultiplier = 1;
      if (selectedWallet.type === "vodafone") feeMultiplier = 0.995;
      else if (selectedWallet.type === "instapay") feeMultiplier = 0.99;
      else if (selectedWallet.type === "barq") feeMultiplier = 0.995;

      const deductedAmount = numAmount * feeMultiplier;
      const expectedAmountPiasters = Math.round(deductedAmount * 100);
      let payload: any = {
        userId: user?.id,
        userEmail: user?.email,
        amount: numAmount,
        expectedAmountPiasters,
        method: selectedWallet.type,
        destination: selectedWallet.number,
        status: "awaiting_payment",
        createdAt: serverTimestamp(),
        verificationDeadline: new Date(Date.now() + 5 * 60 * 1000)
      };

      if (selectedWallet.type === "vodafone") {
         let phone = values.reference.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
         if (!phone.startsWith("+20") && phone.startsWith("0")) phone = "+20" + phone.substring(1);
         else if (!phone.startsWith("+20")) phone = "+20" + phone;
         payload.payerPhoneNormalized = phone;
         payload.originalPhone = values.reference;
      } else if (selectedWallet.type === "barq") {
         payload.payerNameNormalized = values.reference.trim().toLowerCase().replace(/\\s+/g, " ").replace(/[^\\w\\s']/g, "");
         payload.originalName = values.reference;
      } else {
         payload.reference = values.reference;
      }

      await addDoc(collection(db, "recharges"), payload);
      
      setMsg({ text: "تم تسجيل طلبك! ننتظر وصول الحوالة الآن.", type: "success" });
      form.reset({ ...values, reference: "" });
    } catch (err) {
      setMsg({ text: "حدث خطأ أثناء تقديم الطلب، حاول مرة أخرى.", type: "error" });
    }
    setBusy(false);
  };

  const getStatusText = (status: string) => {
     switch(status) {
       case "awaiting_payment": return "في انتظار التحويل";
       case "matching": return "جارٍ مطابقة البيانات";
       case "verified": return "تم تأكيد الدفع بنجاح";
       case "manual_review": return "مراجعة يدوية";
       case "expired": return "انتهت المهلة";
       case "rejected": return "مرفوض";
       case "approved": return "مكتمل";
       case "pending": return "قيد المراجعة";
       default: return status;
     }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#060a13] text-white pb-10 font-['Cairo']" dir="rtl">
      <header className="flex justify-between items-center px-6 py-4 bg-[#0c1322]/80 backdrop-blur-md border-b border-[#1e3050] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#38bdf8]/10 p-2 rounded-xl">
            <Wallet size={24} className="text-[#38bdf8]" />
          </div>
          <h1 className="text-[#38bdf8] m-0 text-xl md:text-2xl font-bold">شحن الرصيد</h1>
        </div>
        <Button variant="outline" className="border-[#1e3050] bg-transparent text-white hover:bg-[#1e3050]" onClick={() => router.push("/store")}>
          <ArrowRight size={18} className="ml-2" /> العودة
        </Button>
      </header>

      <main className="max-w-3xl mx-auto mt-10 px-4">
        {activeRequest ? (
          <Card className="bg-[#38bdf8]/5 border-[#38bdf8]/30 mb-8 overflow-hidden">
            <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-[#38bdf8]/20 rounded-full flex items-center justify-center mb-4">
                 <Clock size={32} className="text-[#38bdf8]" />
              </div>
              <h2 className="text-[#38bdf8] text-2xl font-bold mb-4">{getStatusText(activeRequest.status)}</h2>

              <div className="bg-[#0c1322] rounded-xl p-4 mb-6 min-w-[200px] border border-[#1e3050]">
                 <div className="text-sm text-[#8899b4] mb-2">الوقت المتبقي للتحقق</div>
                 <div className="text-3xl font-bold text-white font-mono tracking-widest" dir="ltr">
                    <Countdown date={activeRequest.verificationDeadline.toMillis()} onComplete={() => window.location.reload()} />
                 </div>
              </div>

              <div className="bg-[#0c1322] p-4 rounded-xl text-right border border-[#1e3050] w-full max-w-sm">
                 <div className="flex justify-between mb-2">
                    <span className="text-[#8899b4]">طريقة الدفع:</span>
                    <span className="text-white font-bold">{activeRequest.method === "barq" ? "برق" : activeRequest.method === "vodafone" ? "فودافون كاش" : "انستاباي"}</span>
                 </div>
                 <div className="flex justify-between mb-2">
                    <span className="text-[#8899b4]">المبلغ المتوقع:</span>
                    <span className="text-white font-bold">{activeRequest.amount} ج.م</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-[#8899b4]">{activeRequest.method === "barq" ? "اسم المرسل" : "المرجع"}:</span>
                    <span className="text-white font-bold">{activeRequest.originalName || activeRequest.originalPhone || activeRequest.reference}</span>
                 </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-[#0c1322] border-[#1e3050] mb-8">
              <CardContent className="p-6">
                <div className="p-3 bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-xl mb-6">
                  <div className="text-[#ff4444] text-sm flex items-center gap-2 font-bold mb-1">
                    <AlertCircle size={16} /> تنبيه هام:
                  </div>
                  <p className="text-[#ff4444]/80 text-sm m-0">لا يمكن استرداد الرصيد بأي حال من الأحوال بعد إضافته لمحفظتك.</p>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <h2 className="text-xl flex items-center gap-3 font-bold text-white border-b border-[#1e3050] pb-4">
                      <span className="bg-[#38bdf8] text-black w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                      طريقة الدفع والتفاصيل
                    </h2>

                    <FormField
                      control={form.control}
                      name="walletType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8899b4]">اختر طريقة التحويل</FormLabel>
                          <select
                            {...field}
                            className="w-full p-4 rounded-xl bg-[#111b2e] border border-[#1e3050] text-white outline-none focus:border-[#38bdf8] transition-colors"
                          >
                            <option value="" disabled>اختر طريقة الدفع</option>
                            {wallets.map((w, i) => (
                              <option key={i} value={w.type} disabled={w.disabled || (w.type === "instapay" && w.disabled)}>
                                {w.type === "vodafone" && "فودافون كاش / محافظ"}
                                {w.type === "instapay" && (w.disabled ? "انستاباي (غير متاح حالياً)" : "انستاباي")}
                                {w.type === "barq" && "برق (السعودية)"}
                              </option>
                            ))}
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedWallet && (
                      <div className="bg-[#38bdf8]/5 p-5 rounded-xl border border-dashed border-[#38bdf8]/30">
                        <p className="text-[#8899b4] text-sm mb-3">قم بتحويل المبلغ إلى التفاصيل التالية:</p>
                        
                        <div className="flex justify-between items-center bg-[#060a13] p-4 rounded-xl mb-3 border border-[#1e3050]">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#8899b4]">
                              {selectedWallet.type === "instapay" ? "اليوزر (عنوان الدفع)" : "الرقم"}
                            </span>
                            <strong className="text-lg text-white tracking-wider" dir="ltr">{selectedWallet.number}</strong>
                          </div>
                          <button 
                            type="button"
                            onClick={() => copyToClipboard(selectedWallet.number)}
                            className="text-[#38bdf8] hover:text-white flex items-center gap-2 bg-transparent border-none cursor-pointer transition-colors"
                          >
                            {copied === selectedWallet.number ? <CheckCircle size={18} /> : <Copy size={18} />}
                            {copied === selectedWallet.number ? "تم النسخ" : "نسخ"}
                          </button>
                        </div>

                        {selectedWallet.name && (
                          <div className="flex items-center gap-2 text-[#8899b4] text-sm mb-3">
                            <Info size={16} /> باسم: <strong className="text-white">{selectedWallet.name}</strong>
                          </div>
                        )}

                        <div className="flex gap-4 text-xs text-[#8899b4]">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                            الحد الأدنى: <strong className="text-white">{selectedWallet.min} ج.م</strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                            الحد الأقصى: <strong className="text-white">{selectedWallet.max} ج.م</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    <h2 className="text-xl flex items-center gap-3 font-bold text-white border-b border-[#1e3050] pb-4 pt-4">
                      <span className="bg-[#38bdf8] text-black w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                      بيانات التحويل
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#8899b4]">
                              {selectedWallet?.type === "barq" ? "المبلغ (جنيه مصري)" : "المبلغ المحول (ج.م)"}
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="مثال: 100" {...field} type="text" inputMode="decimal" className="bg-[#111b2e] border-[#1e3050]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#8899b4]">
                              {selectedWallet?.type === "instapay" 
                                ? "الرقم المرجعي (Reference)" 
                                : selectedWallet?.type === "barq"
                                ? "اسم صاحب التحويل بالإنجليزية"
                                : "رقم الهاتف المحول منه"}
                            </FormLabel>
                            <FormControl>
                              <Input placeholder={
                                selectedWallet?.type === "instapay" ? "مثال: 9206cb26" : 
                                selectedWallet?.type === "barq" ? "مثال: AHMED ALI" : "مثال: 01xxxxxxxxx"
                              } {...field} className="bg-[#111b2e] border-[#1e3050]" dir="ltr" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {watchAmount && !isNaN(Number(tn(watchAmount))) && Number(tn(watchAmount)) > 0 && selectedWallet && (
                      <div className="p-4 bg-[#38bdf8]/5 border border-[#38bdf8]/20 rounded-xl">
                        <label className="text-sm text-[#8899b4] block mb-2">الرصيد الذي سيصلك فعلياً:</label>
                        <div className="text-2xl font-bold text-[#38bdf8]">
                          {(Number(tn(watchAmount)) * (selectedWallet.type === "instapay" ? 0.99 : 0.995)).toFixed(2)} ج.م
                        </div>
                        <div className="text-xs text-[#8899b4] flex items-center gap-2 mt-2">
                          <Info size={14} className="text-[#38bdf8]" />
                          يتم خصم {selectedWallet.type === "instapay" ? "1%" : "0.5%"} رسوم بوابة الدفع.
                        </div>
                      </div>
                    )}

                    {msg.text && (
                      <div className={\`p-4 rounded-xl text-sm \${msg.type === "success" ? "bg-[#10b981]/10 text-[#10b981]" : "bg-[#ff4444]/10 text-[#ff4444]"}\`}>
                        {msg.text}
                      </div>
                    )}

                    <Button type="submit" disabled={busy || !selectedWallet} className="w-full py-6 text-lg font-bold bg-[#38bdf8] text-black hover:bg-[#0284c7]">
                      {busy ? <RefreshCw className="animate-spin mr-2" /> : null}
                      {busy ? "جاري التأكيد..." : "تأكيد الإيداع"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card className="bg-[#0c1322] border-[#1e3050]">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-white border-b border-[#1e3050] pb-4 mb-4">سجل الشحن</h2>
              <div className="flex flex-col gap-3">
                {history.map((h, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#111b2e] p-4 rounded-xl border border-[#1e3050]">
                    <div className="flex flex-col gap-1">
                      <strong className="text-white text-lg">{h.amount} ج.م</strong>
                      <span className="text-xs text-[#8899b4]">{h.createdAt?.toDate().toLocaleString("ar-EG") || "الآن"}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold \${
                        (h.status === "verified" || h.status === "approved") ? "bg-[#10b981]/10 text-[#10b981]" :
                        (h.status === "rejected" || h.status === "expired") ? "bg-[#ff4444]/10 text-[#ff4444]" :
                        "bg-[#38bdf8]/10 text-[#38bdf8]"
                      }\`}>
                        {(h.status === "verified" || h.status === "approved") && <CheckCircle size={14} />}
                        {(h.status === "rejected" || h.status === "expired") && <AlertCircle size={14} />}
                        {(h.status === "awaiting_payment" || h.status === "matching" || h.status === "manual_review" || h.status === "pending") && <RefreshCw size={14} className="animate-spin" />}
                        {getStatusText(h.status)}
                      </div>
                      
                      {(h.status === "expired" || h.status === "manual_review") && !activeRequest && !h.superseded && (
                        <button 
                          type="button"
                          onClick={() => {
                             form.setValue("amount", h.amount.toString());
                             form.setValue("reference", h.originalName || h.originalPhone || h.reference || "");
                             window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="bg-transparent border-none text-[#38bdf8] text-xs underline cursor-pointer hover:text-white"
                        >
                           إعادة المحاولة
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
`

fs.writeFileSync('app/recharge/page.tsx', code);
console.log('Recharge Page Generated');
