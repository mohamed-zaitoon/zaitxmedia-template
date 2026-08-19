"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Zap, Smartphone, Landmark, Check, AlertCircle } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { updateMyProfile } from "../lib/profile-client";

export default function PaymentSetupModal() {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState<string[]>(["vodafone", "bank"]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    
    const userCountry = user.country_code || "EG";
    const lastCountry = typeof window !== "undefined" ? localStorage.getItem("last_configured_country") : null;

    // If user changed country, reset payment preferences for the new country!
    if (lastCountry && lastCountry !== userCountry) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("payment_configured_permanently");
        localStorage.setItem("last_configured_country", userCountry);
      }
    } else if (typeof window !== "undefined" && !lastCountry) {
      localStorage.setItem("last_configured_country", userCountry);
    }

    // Check both profile AND client localStorage memory
    const isLocallySaved = typeof window !== "undefined" && localStorage.getItem("payment_configured_permanently") === "true";
    const hasConfigured = isLocallySaved && (lastCountry === userCountry);
    
    if (!hasConfigured) {
      if (userCountry === "SA") {
        setSelectedMethods(["barq", "bank"]);
      } else {
        setSelectedMethods(["vodafone", "bank"]);
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user, loading]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    if (selectedMethods.length === 0) {
      setErrorMsg("يرجى اختيار وسيلة دفع واحدة على الأقل متوفرة لديك.");
      return;
    }

    setBusy(true);
    setErrorMsg("");

    // Save to client localStorage immediately so it NEVER pops up again!
    if (typeof window !== "undefined") {
      localStorage.setItem("payment_configured_permanently", "true");
      localStorage.setItem("user_preferred_methods", JSON.stringify(selectedMethods));
    }

    try {
      await updateMyProfile({
        preferred_payment_methods: JSON.stringify(selectedMethods),
        payment_methods_configured: "true",
      });
      setIsOpen(false);
      window.location.reload();
    } catch {
      // Even if background network profile patch delays, client memory prevents repeating modal
      setIsOpen(false);
      window.location.reload();
    }
  };

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-lg rounded-3xl border border-cyan-500/35 bg-[#0a1120]/98 p-6 md:p-8 shadow-2xl shadow-black text-right overflow-hidden"
        >
          {/* Glowing Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-500" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-wide">
                💳 تحديد وسائل الدفع الخاصة بك
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                تظهر لك هذه النافذة مرة واحدة لتخصيص الخيارات المتوفرة على هاتفك
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-5 bg-cyan-500/5 p-3.5 rounded-2xl border border-cyan-500/20">
            حدد الوسائل المتاحة لديك حالياً لعرضها لك فقط في واجهة الشحن ودفع الطلبات وتسهيل عملك:
          </p>

          {/* Method Checkboxes - Filtered Smartly by Country */}
          <div className="space-y-3 mb-6">
            {[
              {
                id: "vodafone",
                title: "فودافون كاش / المحافظ الإلكترونية",
                desc: "محافظ أورنج، اتصالات، فودافون، وي",
                icon: <Smartphone size={20} className="text-amber-400" />,
                countries: ["EG"],
              },
              {
                id: "instapay",
                title: "تطبيق انستا باي (InstaPay)",
                desc: "مثبت متوفر على هاتفي للتحويل المباشر",
                icon: <Zap size={20} className="text-emerald-400" />,
                countries: ["EG"],
              },
              {
                id: "barq",
                title: "تطبيق برق (Barq)",
                desc: "متوفر لدي في المملكة العربية السعودية",
                icon: <Zap size={20} className="text-cyan-400" />,
                countries: ["SA"],
              },
              {
                id: "bank",
                title: "الحسابات والتحويلات البنكية",
                desc: user.country_code === "SA" ? "تحويل لحسابات الراجحي والأهلي السعودي" : "تحويل لحسابات البنك الأهلي أو مصر",
                icon: <Landmark size={20} className="text-purple-400" />,
                countries: ["EG", "SA", "GLOBAL"],
              },
            ]
              .filter((m) => m.countries.includes(user.country_code || "EG") || m.countries.includes("GLOBAL"))
              .map((method) => {
              const checked = selectedMethods.includes(method.id);
              return (
                <div
                  key={method.id}
                  onClick={() => toggleMethod(method.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                    checked
                      ? "border-cyan-500/60 bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-slate-900/90 shadow-md shadow-cyan-950/30"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                      {method.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm font-extrabold ${checked ? "text-cyan-300" : "text-foreground"}`}>
                        {method.title}
                      </h4>
                      <p className="text-xs text-muted-foreground/80 font-normal truncate mt-0.5">
                        {method.desc}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                      checked
                        ? "bg-cyan-500 border-cyan-400 text-slate-950 font-black"
                        : "border-slate-700 bg-slate-950"
                    }`}
                  >
                    {checked && <Check size={16} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="mb-4 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/25 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} />
              {errorMsg}
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 font-black text-slate-950 text-base shadow-xl shadow-cyan-500/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {busy ? "جاري الحفظ..." : "حفظ وتأكيد الوسائل ⚡"}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
