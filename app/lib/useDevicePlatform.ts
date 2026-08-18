"use client";

import { useState, useEffect } from "react";

export type DevicePlatform = "android" | "ios" | "desktop";

export function useDevicePlatform(): {
  platform: DevicePlatform;
  isAndroid: boolean;
  isIOS: boolean;
  isDesktop: boolean;
} {
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const detectedPlatform: DevicePlatform = isAndroid
      ? "android"
      : isIOS
      ? "ios"
      : "desktop";

    setPlatform(detectedPlatform);

    // Apply platform attribute to document root for global CSS targeting
    document.documentElement.setAttribute("data-platform", detectedPlatform);
    document.body.setAttribute("data-platform", detectedPlatform);
  }, []);

  return {
    platform,
    isAndroid: platform === "android",
    isIOS: platform === "ios",
    isDesktop: platform === "desktop",
  };
}
