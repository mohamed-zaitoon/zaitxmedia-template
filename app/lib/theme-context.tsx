"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth-context";

export type UIStyle = "glass" | "blur" | "xiaomi" | "material3";
export type UITheme = "cyber" | "purple" | "emerald" | "blue" | "crimson";

interface ThemeContextType {
  uiStyle: UIStyle;
  uiTheme: UITheme;
  floatingBar: boolean;
  uiCustomizedByUser: boolean;
  setUiStyle: (style: UIStyle) => Promise<void>;
  setUiTheme: (theme: UITheme) => Promise<void>;
  setFloatingBar: (floating: boolean) => Promise<void>;
  resetToAdminDefault: () => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Load synchronous cache from localStorage if available
  const getInitialStyle = (): UIStyle => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("zaitx_ui_style");
      if (cached && ["glass", "blur", "xiaomi", "material3"].includes(cached)) return cached as UIStyle;
    }
    return "glass";
  };

  const getInitialTheme = (): UITheme => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("zaitx_ui_theme");
      if (cached && ["cyber", "purple", "emerald", "blue", "crimson"].includes(cached)) return cached as UITheme;
    }
    return "cyber";
  };

  const getInitialFloating = (): boolean => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("zaitx_floating_bar");
      if (cached !== null) return cached === "true";
    }
    return true;
  };

  const [uiStyle, setUiStyleState] = useState<UIStyle>(getInitialStyle);
  const [uiTheme, setUiThemeState] = useState<UITheme>(getInitialTheme);
  const [floatingBar, setFloatingBarState] = useState<boolean>(getInitialFloating);
  const [uiCustomizedByUser, setUiCustomizedByUser] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const applyThemeToDOM = useCallback((style: UIStyle, theme: UITheme, floating: boolean) => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-ui-style", style);
    document.body.setAttribute("data-ui-style", style);

    document.documentElement.setAttribute("data-ui-theme", theme);
    document.body.setAttribute("data-ui-theme", theme);

    document.documentElement.setAttribute("data-floating-bar", floating ? "true" : "false");
    document.body.setAttribute("data-floating-bar", floating ? "true" : "false");

    if (typeof window !== "undefined") {
      localStorage.setItem("zaitx_ui_style", style);
      localStorage.setItem("zaitx_ui_theme", theme);
      localStorage.setItem("zaitx_floating_bar", floating ? "true" : "false");
    }
  }, []);

  // Apply immediately when state changes
  useEffect(() => {
    applyThemeToDOM(uiStyle, uiTheme, floatingBar);
  }, [uiStyle, uiTheme, floatingBar, applyThemeToDOM]);

  // Fetch initial preferences from server (User custom preference OR Admin site default)
  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch("/api/user/preferences", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.success) return;
        const style: UIStyle = data.preferences.uiStyle || "glass";
        const theme: UITheme = data.preferences.uiTheme || "cyber";
        const floating: boolean = data.preferences.floatingBar !== false;
        const isCustomized: boolean = Boolean(data.preferences.uiCustomizedByUser);

        setUiStyleState(style);
        setUiThemeState(theme);
        setFloatingBarState(floating);
        setUiCustomizedByUser(isCustomized);
        applyThemeToDOM(style, theme, floating);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, applyThemeToDOM]);

  const savePreferences = async (newStyle: UIStyle, newTheme: UITheme, newFloating: boolean, isCustom = true) => {
    applyThemeToDOM(newStyle, newTheme, newFloating);
    setUiStyleState(newStyle);
    setUiThemeState(newTheme);
    setFloatingBarState(newFloating);
    setUiCustomizedByUser(isCustom);

    try {
      await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uiStyle: newStyle,
          uiTheme: newTheme,
          floatingBar: newFloating,
          uiCustomizedByUser: isCustom,
        }),
      });
    } catch (err) {
      console.error("Failed to save theme preferences:", err);
    }
  };

  const setUiStyle = async (style: UIStyle) => {
    await savePreferences(style, uiTheme, floatingBar, true);
  };

  const setUiTheme = async (theme: UITheme) => {
    await savePreferences(uiStyle, theme, floatingBar, true);
  };

  const setFloatingBar = async (floating: boolean) => {
    await savePreferences(uiStyle, uiTheme, floating, true);
  };

  const resetToAdminDefault = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("zaitx_ui_style");
        localStorage.removeItem("zaitx_ui_theme");
        localStorage.removeItem("zaitx_floating_bar");
      }
      const res = await fetch("/api/user/preferences", { method: "DELETE" });
      const data = await res.json();
      if (data.success && data.defaultPreferences) {
        const style: UIStyle = data.defaultPreferences.uiStyle || "glass";
        const theme: UITheme = data.defaultPreferences.uiTheme || "cyber";
        const floating: boolean = data.defaultPreferences.floatingBar !== false;
        applyThemeToDOM(style, theme, floating);
        setUiStyleState(style);
        setUiThemeState(theme);
        setFloatingBarState(floating);
        setUiCustomizedByUser(false);
      }
    } catch (err) {
      console.error("Failed to reset theme preferences:", err);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        uiStyle,
        uiTheme,
        floatingBar,
        uiCustomizedByUser,
        setUiStyle,
        setUiTheme,
        setFloatingBar,
        resetToAdminDefault,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
