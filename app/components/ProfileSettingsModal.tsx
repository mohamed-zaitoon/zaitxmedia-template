"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { updateMyProfile } from "../lib/profile-client";
import { X, User } from "lucide-react";
import Swal from "sweetalert2";
import GenericCustomSelect from "./GenericCustomSelect";
import { validateCountryChange } from "../lib/geolocation";

export default function ProfileSettingsModal({ onClose }: any) {
  const { user, hasGoogleLinked, linkGoogle, unlinkGoogle } = useAuth();
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("EG");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.name || "");
    setWhatsapp(user.whatsapp || "");
    setCountry(user.country_code || "EG");
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateMyProfile({
        name: fullName.trim(),
        whatsapp: whatsapp.trim(),
        country_code: country,
      });
      Swal.fire({
        icon: "success",
        title: "تم الحفظ",
        timer: 1500,
        showConfirmButton: false,
        background: "#222",
        color: "#fff",
      });
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "خطأ",
        text: error.message,
        background: "#222",
        color: "#fff",
      });
    }
    setLoading(false);
    onClose();
  };

  const handleLinkGoogle = async () => {
    setLinking(true);
    const r = await linkGoogle();
    if (!r.success)
      Swal.fire({
        icon: "error",
        title: "خطأ",
        text: r.error,
        background: "#222",
        color: "#fff",
      });
    else
      Swal.fire({
        icon: "success",
        title: "تم ربط Google",
        background: "#222",
        color: "#fff",
      });
    setLinking(false);
  };

  const handleUnlink = async () => {
    const r = await unlinkGoogle();
    Swal.fire(
      r.success
        ? {
            icon: "success",
            title: "تم",
            text: "تم إلغاء ربط Google",
            background: "#222",
            color: "#fff",
          }
        : {
            icon: "error",
            title: "خطأ",
            text: r.error,
            background: "#222",
            color: "#fff",
          },
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dir="rtl"
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 16,
          width: "90%",
          maxWidth: 420,
          padding: 28,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
          }}
        >
          <X size={22} />
        </button>
        <h2
          style={{
            color: "#38bdf8",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <User size={22} /> إعدادات الحساب
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              style={{
                color: "#aaa",
                fontSize: 13,
                display: "block",
                marginBottom: 4,
              }}
            >
              الاسم الكامل
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
              placeholder="اسمك الكامل"
            />
          </div>
          <div>
            <label
              style={{
                color: "#aaa",
                fontSize: 13,
                display: "block",
                marginBottom: 4,
              }}
            >
              رقم الواتساب
            </label>
            <div
              style={{
                display: "flex",
                background: "#0a0a0a",
                border: "1px solid #333",
                borderRadius: 8,
                overflow: "hidden",
              }}
              dir="ltr"
            >
              <span
                style={{
                  padding: "12px 14px",
                  background: "#151515",
                  color: "#888",
                  fontWeight: "bold",
                  borderRight: "1px solid #333",
                }}
              >
                {country === "SA" ? "+966" : "+20"}
              </span>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/^0+/, ""))}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "transparent",
                  color: "#fff",
                  border: "none",
                  outline: "none",
                }}
                placeholder={country === "SA" ? "5xxxxxxxx" : "10xxxxxxxxx"}
              />
            </div>
          </div>
          <div>
            <label
              style={{
                color: "#aaa",
                fontSize: 13,
                display: "block",
                marginBottom: 4,
              }}
            >
              الدولة
            </label>
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

          <div
            style={{
              borderTop: "1px solid #333",
              paddingTop: 14,
              marginTop: 4,
            }}
          >
            <label
              style={{
                color: "#aaa",
                fontSize: 13,
                display: "block",
                marginBottom: 8,
              }}
            >
              طرق تسجيل الدخول
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0a0a0a",
                  padding: "10px 14px",
                  borderRadius: 8,
                }}
              >
                <span>📧</span>
                <span style={{ flex: 1, fontSize: 14 }}>
                  البريد الإلكتروني وكلمة المرور
                </span>
                <span
                  style={{
                    color: "#00ff80",
                    fontSize: 11,
                    background: "rgba(0,255,128,0.1)",
                    padding: "2px 8px",
                    borderRadius: 10,
                  }}
                >
                  مفعل
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0a0a0a",
                  padding: "10px 14px",
                  borderRadius: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span style={{ flex: 1, fontSize: 14 }}>Google</span>
                {hasGoogleLinked ? (
                  <button
                    onClick={handleUnlink}
                    style={{
                      background: "none",
                      border: "1px solid #ff4444",
                      color: "#ff4444",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    إلغاء الربط
                  </button>
                ) : (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={linking}
                    style={{
                      background: "none",
                      border: "1px solid #38bdf8",
                      color: "#38bdf8",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {linking ? "..." : "ربط Google"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 10,
              background: "linear-gradient(135deg, #38bdf8, #818cf8)",
              color: "#000",
              border: "none",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {loading ? "جاري..." : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "#fff",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};
