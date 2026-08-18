"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

export default function SiteAvailabilityGate({ children }: { children: React.ReactNode }) {
  const [siteEnabled, setSiteEnabled] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "site"),
      (snapshot) => setSiteEnabled(snapshot.data()?.site_enabled !== false),
      () => setSiteEnabled(true),
    );
    return unsubscribe;
  }, []);

  const isAdminHost = typeof window !== "undefined"
    && window.location.hostname.startsWith("admin.");
  const isAdminEnrollment = typeof window !== "undefined"
    && window.location.pathname.startsWith("/notifications/admin-enroll");

  if (!siteEnabled && !isAdminHost && !isAdminEnrollment) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#050914] p-6 text-center text-white" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-[#0c1527] p-8 shadow-2xl shadow-black/40">
          <div className="mb-5 text-6xl">🛠️</div>
          <h1 className="mb-3 text-2xl font-black text-cyan-400">الموقع متوقف مؤقتًا</h1>
          <p className="m-0 text-sm leading-8 text-slate-300">
            نجري حاليًا بعض أعمال الصيانة والتحديث. سنعود للعمل قريبًا، شكرًا لتفهمك.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
