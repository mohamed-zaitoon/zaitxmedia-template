"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

export interface AnnouncementConfig {
  enabled: boolean;
  text: string;
  bg?: string;
  color?: string;
  link?: string;
}

export interface SiteAppearanceConfig {
  primaryColor: string;
  themePreset: "cyan" | "gold" | "emerald" | "violet" | "rose";
  siteTitle: string;
  announcement: AnnouncementConfig;
}

export interface CategoryAppearanceConfig {
  iconType?: "brand" | "custom_url" | "emoji";
  customUrl?: string;
  badgeText?: string;
  badgeColor?: string;
  glowColor?: string;
}

export interface PaymentGatewayConfig {
  enabled: boolean;
  name: string;
  numberOrAccount: string;
  instructions: string;
  iconUrl?: string;
}

interface SiteAppearanceContextType {
  appearance: SiteAppearanceConfig;
  categoryIcons: Record<string, CategoryAppearanceConfig>;
  paymentGateways: Record<string, PaymentGatewayConfig>;
  loading: boolean;
}

const defaultAppearance: SiteAppearanceConfig = {
  primaryColor: "#38bdf8",
  themePreset: "cyan",
  siteTitle: "ZAITX MEDIA",
  announcement: {
    enabled: false,
    text: "",
    bg: "#0284c7",
    color: "#ffffff",
    link: "",
  },
};

const defaultGateways: Record<string, PaymentGatewayConfig> = {
  vodafone: {
    enabled: true,
    name: "فودافون كاش (Vodafone Cash)",
    numberOrAccount: "01000000000",
    instructions: "قم بتحويل المبلغ إلى الرقم الموضح أعلاه ثم ادخل رقم المحول منه والرقم القومي للتأكيد.",
  },
  instapay: {
    enabled: true,
    name: "إنستا باي (InstaPay)",
    numberOrAccount: "zaitxmedia@instapay",
    instructions: "قم بالتحويل المباشر عبر تطبيق إنستا باي إلى اسم المستخدم أعلاه.",
  },
  barq: {
    enabled: true,
    name: "تحويل برق (SAR)",
    numberOrAccount: "SA0000000000000000000000",
    instructions: "قم بالتحويل عبر تطبيق برق بالريال السعودي.",
  },
  binance_pay: {
    enabled: true,
    name: "باينانس باي (Binance Pay - USD)",
    numberOrAccount: "BINANCE_PAY_ID",
    instructions: "قم بالمسح أو التحويل عبر Binance Pay بدولار USDT.",
  },
};

const SiteAppearanceContext = createContext<SiteAppearanceContextType>({
  appearance: defaultAppearance,
  categoryIcons: {},
  paymentGateways: defaultGateways,
  loading: true,
});

export function SiteAppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<SiteAppearanceConfig>(defaultAppearance);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, CategoryAppearanceConfig>>({});
  const [paymentGateways, setPaymentGateways] = useState<Record<string, PaymentGatewayConfig>>(defaultGateways);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAppearance = onSnapshot(
      doc(db, "settings", "site_appearance"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppearance({
            primaryColor: data.primaryColor || defaultAppearance.primaryColor,
            themePreset: data.themePreset || defaultAppearance.themePreset,
            siteTitle: data.siteTitle || defaultAppearance.siteTitle,
            announcement: {
              enabled: Boolean(data.announcement?.enabled),
              text: data.announcement?.text || "",
              bg: data.announcement?.bg || defaultAppearance.announcement.bg,
              color: data.announcement?.color || defaultAppearance.announcement.color,
              link: data.announcement?.link || "",
            },
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to site_appearance:", err);
        setLoading(false);
      }
    );

    const unsubIcons = onSnapshot(
      doc(db, "settings", "category_icons"),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().icons) {
          setCategoryIcons(docSnap.data().icons);
        }
      },
      (err) => console.error("Error listening to category_icons:", err)
    );

    const unsubGateways = onSnapshot(
      doc(db, "settings", "payment_gateways"),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().gateways) {
          setPaymentGateways({ ...defaultGateways, ...docSnap.data().gateways });
        }
      },
      (err) => console.error("Error listening to payment_gateways:", err)
    );

    return () => {
      unsubAppearance();
      unsubIcons();
      unsubGateways();
    };
  }, []);

  return (
    <SiteAppearanceContext.Provider
      value={{
        appearance,
        categoryIcons,
        paymentGateways,
        loading,
      }}
    >
      {children}
    </SiteAppearanceContext.Provider>
  );
}

export function useSiteAppearance() {
  return useContext(SiteAppearanceContext);
}
