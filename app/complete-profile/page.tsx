"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { updateMyProfile } from "../lib/profile-client";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import GenericCustomSelect from "../components/GenericCustomSelect";
import { validateCountryChange } from "../lib/geolocation";
import { toast } from "sonner";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("EG");
  const [preferredMethods, setPreferredMethods] = useState<string[]>(["vodafone", "bank"]);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    
    if (user.whatsapp) {
      router.push("/");
      return;
    }
    setName(user.name || "");
    setUsername(user.username || "");
    setChecking(false);
  }, [loading, user, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    if (!name || !whatsapp) {
      setErrorMsg("يرجى إكمال جميع الحقول");
      return;
    }
    if (preferredMethods.length === 0) {
      setErrorMsg("يرجى اختيار وسيلة دفع واحدة على الأقل متوفرة لديك");
      return;
    }
    if (!agreeTerms) {
      setErrorMsg("يجب الموافقة على الشروط والأحكام");
      return;
    }

    setBusy(true);
    try {
      const res = await updateMyProfile({
        name,
        username: username.trim().toLowerCase(),
        whatsapp,
        country_code: country,
        preferred_payment_methods: JSON.stringify(preferredMethods),
        payment_methods_configured: "true",
      });

      if (res.warnings && res.warnings.length > 0) {
        setErrorMsg(res.warnings[0]);
        setBusy(false);
        return;
      }
      toast.success("تم الحفظ بنجاح 💾");
      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ البيانات");
      setBusy(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="premium-loader-container">
        <div className="premium-loader-wrapper">
          <div className="premium-loader"></div>
          <div className="premium-loader-inner"></div>
        </div>
        <span className="premium-loader-text">جاري التحقق من الحساب...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          background: "rgba(17,17,17,0.95)",
          backdropFilter: "blur(20px)",
          padding: 36,
          borderRadius: 20,
          width: "100%",
          maxWidth: 420,
          border: "1px solid rgba(56,189,248,0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ background: "rgba(56,189,248,0.1)", padding: 16, borderRadius: "50%" }}>
              <CheckCircle size={32} color="#38bdf8" />
            </div>
          </div>
          <h2 style={{ color: "#fff", margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
            استكمال البيانات
          </h2>
          <p style={{ color: "#888", margin: 0, fontSize: 14 }}>
            أهلاً بك! نحتاج لبعض التفاصيل الإضافية لإكمال حسابك وتسهيل التواصل معك.
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", color: "#aaa", fontSize: 13, marginBottom: 6 }}>الاسم الكامل</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="الاسم الكامل"
            />
          </div>

          <div>
            <label style={{ display: "block", color: "#aaa", fontSize: 13, marginBottom: 6 }}>اسم المستخدم (المعرف @)</label>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }} dir="ltr">
              <span style={{ padding: "14px 12px", background: "rgba(255,255,255,0.06)", color: "#888", fontWeight: "bold", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                style={{ width: "100%", padding: 14, background: "transparent", color: "#fff", border: "none", outline: "none" }}
                placeholder="username"
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", color: "#aaa", fontSize: 13, marginBottom: 6 }}>الدولة</label>
            <GenericCustomSelect
              value={country}
              title="اختر الدولة"
              options={[
                { value: "EG", label: "مصر 🇪🇬" },
                { value: "SA", label: "السعودية 🇸🇦" },
              ]}
              onChange={async (val) => {
                if (val === country) return;
                const isAllowed = await validateCountryChange(val);
                if (isAllowed) setCountry(val);
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", color: "#aaa", fontSize: 13, marginBottom: 6 }}>رقم الواتساب</label>
            <div
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                overflow: "hidden",
              }}
              dir="ltr"
            >
              <span
                style={{
                  padding: "14px 12px",
                  background: "rgba(255,255,255,0.06)",
                  color: "#888",
                  fontWeight: "bold",
                  borderRight: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {country === "SA" ? "+966" : "+20"}
              </span>
              <input
                type="text"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/^0+/, ""))}
                style={{
                  width: "100%",
                  padding: 14,
                  background: "transparent",
                  color: "#fff",
                  border: "none",
                  outline: "none",
                }}
                placeholder={country === "SA" ? "5xxxxxxxx" : "10xxxxxxxxx"}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 16, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 16, textAlign: "right" }}>
            <label style={{ display: "block", color: "#38bdf8", fontWeight: "bold", fontSize: 13, marginBottom: 10 }}>
              💳 وسائل الدفع المتوفرة لديك (اختر لتظهر لك فقط):
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { id: "vodafone", label: "📱 فودافون كاش / المحافظ الإلكترونية", countries: ["EG"] },
                { id: "instapay", label: "⚡ تطبيق انستا باي (InstaPay) على هاتفي", countries: ["EG"] },
                { id: "barq", label: "🇸🇦 تطبيق برق (Barq)", countries: ["SA"] },
                { id: "bank", label: "🏛️ الحسابات والتحويلات البنكية", countries: ["EG", "SA", "GLOBAL"] },
              ]
                .filter((m) => m.countries.includes(country) || m.countries.includes("GLOBAL"))
                .map((m) => {
                const checked = preferredMethods.includes(m.id);
                return (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#fff", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setPreferredMethods((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        );
                      }}
                      style={{ accentColor: "#38bdf8", width: 18, height: 18 }}
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: "#888", marginTop: 10, lineHeight: 1.5 }}>
              💡 تظهر في خيارات الشحن والدفع الوسائل التي اخترتها فقط، ويمكنك تعديلها في أي وقت من الملف الشخصي.
            </p>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#888",
              cursor: "pointer",
              marginTop: 8
            }}
          >
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{ accentColor: "#38bdf8" }}
            />
            أوافق على{" "}
            <a href="/terms" target="_blank" style={{ color: "#38bdf8", textDecoration: "underline" }}>
              الشروط والأحكام
            </a>{" "}
            و{" "}
            <a href="/privacy" target="_blank" style={{ color: "#38bdf8", textDecoration: "underline" }}>
              سياسة الخصوصية
            </a>
          </label>

          {errorMsg && (
            <div
              style={{
                background: "rgba(255,68,68,0.1)",
                border: "1px solid rgba(255,68,68,0.3)",
                padding: "10px 14px",
                borderRadius: 8,
                color: "#ff4444",
                fontSize: 13,
                textAlign: "center",
                marginTop: 8
              }}
            >
              {errorMsg}
            </div>
          )}

          <button type="submit" disabled={busy} style={{...submitBtn, marginTop: 8}}>
            {busy ? "جاري الحفظ..." : "إكمال التسجيل"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};

const submitBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #38bdf8, #818cf8)",
  color: "#000",
  padding: 14,
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  width: "100%",
};
