"use client";

import AppHeader from "./AppHeader";
import SiteFooter from "./SiteFooter";
import MobileBottomNavigation from "./MobileBottomNavigation";
import OneSignalProvider from "../OneSignalProvider";
import GlobalDiscountBanner from "../GlobalDiscountBanner";
import PaymentSetupModal from "../PaymentSetupModal";
import { useAuth } from "@/app/lib/auth-context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-dvh w-full min-w-0 bg-background">
      <OneSignalProvider userId={user?.id} />
      <PaymentSetupModal />
      <div className="graffiti-bg"></div>

      <div className="relative flex min-h-dvh w-full min-w-0 flex-col">
        <GlobalDiscountBanner />
        <AppHeader />

        <main className="centered-app-frame app-main-content flex min-w-0 flex-1 flex-col items-center space-y-6 py-6 pb-24 md:py-9">
          {children}
        </main>

        <SiteFooter />
        <MobileBottomNavigation />
      </div>
    </div>
  );
}
