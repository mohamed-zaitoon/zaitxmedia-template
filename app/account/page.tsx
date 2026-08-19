"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { useCurrency } from "../lib/currency-context";
import { useUser } from "@clerk/nextjs";
import { getMyProfile, updateMyProfile } from "../lib/profile-client";
import GenericCustomSelect from "../components/GenericCustomSelect";
import { validateCountryChange } from "../lib/geolocation";
import {
  User,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Save,
  AlertCircle,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Palette,
} from "lucide-react";
import Swal from "sweetalert2";
import AppShell from "../components/layout/AppShell";
import PasskeyButton from "../components/PasskeyButton";
import { useTheme } from "../lib/theme-context";
import { toast } from "sonner";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    document.title = "حسابي | ZAITX MEDIA";
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      else setAuthChecking(false);
    }
  }, [loading, user, router]);

  if (authChecking) {
    return (
      <div className="premium-loader-container">
        <div className="premium-loader-wrapper">
          <div className="premium-loader"></div>
          <div className="premium-loader-inner"></div>
        </div>
        <span className="premium-loader-text">جاري التحميل...</span>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="w-full flex justify-center font-['Cairo'] pb-28 text-center">
        <div className="w-full max-w-2xl mt-2 px-3 sm:px-4 flex flex-col gap-6 items-center">
          
          {/* Quick Tab Nav */}
          <nav className="flex w-full items-center justify-center gap-3" aria-label="أقسام الحساب">
            <a href="#profile" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 text-sm font-bold text-primary hover:bg-primary/20 transition-all shadow-sm">
              <User size={18} /> الملف الشخصي
            </a>
            <a href="/orders" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-bold text-amber-400 hover:bg-amber-500/20 transition-all shadow-sm">
              <Package size={18} /> طلباتي
            </a>
          </nav>
          
          {/* Wallet Summary Card */}
          <WalletSummary user={user} />
          
          {/* Profile Section */}
          <div id="profile" className="w-full scroll-mt-24">
            <ProfileSection user={user} />
          </div>

        </div>
      </div>
    </AppShell>
  );
}

function WalletSummary({ user }: any) {
  const { selectedCurrency, convertPrice, rates } = useCurrency();
  const [balanceUsd, setBalanceUsd] = useState(Number(user?.balance) || 0);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const refresh = async () => {
      const profile = await getMyProfile();
      if (active && profile) setBalanceUsd(Number(profile.balance) || 0);
    };
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const floorBalanceUsd = Math.floor((balanceUsd + 1e-9) * 100) / 100;
  const displayed =
    selectedCurrency === "USD"
      ? `${floorBalanceUsd.toFixed(2)}$`
      : convertPrice(floorBalanceUsd * rates.usd).formatted;

  return (
    <div className="w-full rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#111c30] to-[#080d18] p-6 text-center flex flex-col items-center justify-center gap-3 shadow-xl shadow-black/40 relative overflow-hidden">
      <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-cyan-500 via-amber-400 to-cyan-500" />
      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
        <Wallet size={28} />
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">رصيد المحفظة المتاح</span>
      <strong className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight font-mono" dir="ltr">{displayed}</strong>
      <span className="text-[11px] text-muted-foreground/80 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
        الرصيد الأساسي بالدولار: {floorBalanceUsd.toFixed(2)}$
      </span>
      <a href="/recharge" className="mt-2 inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-cyan-400 px-8 font-black text-black shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all">
        شحن الرصيد الآن
      </a>
    </div>
  );
}

function ProfileSection({ user }: any) {
  const { user: clerkUser } = useUser();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("EG");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nameCooldownDays, setNameCooldownDays] = useState(0);
  const [usernameCooldownDays, setUsernameCooldownDays] = useState(0);

  const [preferredMethods, setPreferredMethods] = useState<string[]>(["vodafone", "bank"]);

  useEffect(() => {
    if (!user) return;
    getMyProfile().then((data) => {
      if (data?.whatsapp) {
        setFullName(data.name || "");
        setUsername(data.username || "");
        setWhatsapp(data.whatsapp || "");
        setCountry(data.country_code || "EG");
        setNameCooldownDays(data.nameCooldownRemainingDays || 0);
        setUsernameCooldownDays(data.usernameCooldownRemainingDays || 0);
        if (data.preferred_payment_methods) {
          try {
            const parsed = typeof data.preferred_payment_methods === "string" ? JSON.parse(data.preferred_payment_methods) : data.preferred_payment_methods;
            if (Array.isArray(parsed) && parsed.length > 0) setPreferredMethods(parsed);
          } catch {}
        }
      } else {
        window.location.href = "/complete-profile";
        return;
      }
      setLoading(false);
    }).catch((e) => {
      console.error("Error fetching profile:", e);
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateMyProfile({
        name: fullName.trim(),
        username: username.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        country_code: country,
        preferred_payment_methods: JSON.stringify(preferredMethods),
        payment_methods_configured: "true",
      });

      if (res.warnings && res.warnings.length > 0) {
        Swal.fire({
          icon: "warning",
          title: "تم الحفظ جزئياً",
          html: `<div class="text-right text-xs leading-6">${res.warnings.map((w: string) => `<p>⚠️ ${w}</p>`).join("")}</div>`,
          background: "#0c1322",
          color: "#fff",
        });
      } else {
        toast.success("تم الحفظ بنجاح 💾");
      }
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "خطأ",
        text: error.message,
        background: "#0c1322",
        color: "#fff",
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="w-full text-center py-10 text-muted-foreground text-sm">
        جاري تحميل بيانات الملف الشخصي...
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl border border-border/60 bg-[#0a1120] p-6 sm:p-8 shadow-xl text-center flex flex-col gap-6 items-center">
      {/* Avatar & User Details */}
      <div className="flex flex-col items-center justify-center gap-3 text-center w-full">
        <div
          onClick={() => document.getElementById("profile-upload")?.click()}
          className={`w-24 h-24 rounded-full bg-primary/15 border-2 border-primary/40 text-primary flex items-center justify-center text-3xl font-black overflow-hidden cursor-pointer relative shadow-lg hover:border-primary transition-all ${uploadingImage ? "opacity-50" : ""}`}
          title="تغيير الصورة الشخصية"
        >
          {user.imageUrl ? (
            <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (fullName || user.email)[0]?.toUpperCase()
          )}
          <input 
            type="file" 
            id="profile-upload" 
            className="hidden"
            accept="image/*" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !clerkUser) return;
              setUploadingImage(true);
              try {
                await clerkUser.setProfileImage({ file });
                window.location.reload();
              } catch(err: any) {
                Swal.fire({ icon: 'error', title: 'خطأ', text: err.message, background: '#0c1322', color: '#fff' });
              } finally {
                setUploadingImage(false);
              }
            }} 
          />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{fullName || "مستخدم ZAITX"}</h2>
          {username && (
            <span className="text-xs font-mono text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 mt-1 inline-block">
              @{username}
            </span>
          )}
          <p className="text-muted-foreground text-xs font-mono mt-1 dir-ltr block">{user.email}</p>
        </div>
      </div>

      <div className="w-full h-px bg-border/40" />

      {/* Form Fields */}
      <div className="space-y-4 w-full max-w-md mx-auto text-right">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-muted-foreground text-xs font-bold block">الاسم الكامل (تعديل كل 7 أيام)</label>
            {nameCooldownDays > 0 && (
              <span className="text-[10px] text-amber-400 font-medium">متبقي {nameCooldownDays} أيام لتعديل الاسم</span>
            )}
          </div>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-black/40 border border-border text-foreground text-sm outline-none focus:border-primary transition-all text-right"
            placeholder="اسمك الكامل"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-muted-foreground text-xs font-bold block">اسم المستخدم (تعديل كل 30 يوم)</label>
            {usernameCooldownDays > 0 && (
              <span className="text-[10px] text-amber-400 font-medium">متبقي {usernameCooldownDays} يوماً لتعديل المعرف</span>
            )}
          </div>
          <div className="flex flex-row items-stretch bg-black/40 border border-border rounded-xl overflow-hidden focus-within:border-primary transition-all w-full" dir="ltr">
            <span className="px-4 flex items-center justify-center bg-white/5 text-muted-foreground font-mono border-r border-border text-xs font-bold shrink-0">
              @
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
              className="w-full h-12 px-4 bg-transparent text-foreground border-none outline-none font-mono text-sm flex-1"
              placeholder="username"
            />
          </div>
        </div>

        <div>
          <label className="text-muted-foreground text-xs font-bold mb-1.5 block">رقم الواتساب</label>
          <div className="flex flex-row items-stretch bg-black/40 border border-border rounded-xl overflow-hidden focus-within:border-primary transition-all w-full" dir="ltr">
            <span className="px-4 flex items-center justify-center bg-white/5 text-muted-foreground font-mono border-r border-border text-xs font-bold shrink-0">
              {country === "SA" ? "+966" : "+20"}
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/^0+/, ""))}
              className="w-full h-12 px-4 bg-transparent text-foreground border-none outline-none font-mono text-sm flex-1"
              placeholder={country === "SA" ? "5xxxxxxxx" : "10xxxxxxxxx"}
            />
          </div>
        </div>

        <div>
          <label className="text-muted-foreground text-xs font-bold mb-1.5 block">الدولة</label>
          <GenericCustomSelect
            value={country}
            title="اختر الدولة"
            options={[
              { value: "EG", label: "🇪🇬 مصر" },
              { value: "SA", label: "🇸🇦 السعودية" },
            ]}
            onChange={async (newCountry) => {
              if (newCountry === country) return;
              const isAllowed = await validateCountryChange(newCountry);
              if (!isAllowed) return;

              setCountry(newCountry);
              const defaultMethods = newCountry === "SA" ? ["barq", "bank"] : newCountry === "EG" ? ["vodafone", "instapay", "bank"] : ["bank"];
              setPreferredMethods(defaultMethods);
              if (typeof window !== "undefined") {
                localStorage.removeItem("payment_configured_permanently");
                localStorage.setItem("last_configured_country", newCountry);
              }
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all mt-2 disabled:opacity-50"
        >
          <Save size={18} /> {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>

        <div className="pt-2">
          <PasskeyButton userId={user?.id || user?.email} userEmail={user?.email || ""} userRole={user?.role || "user"} />
        </div>
      </div>
    </div>
  );
}


