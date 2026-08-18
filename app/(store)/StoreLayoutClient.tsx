"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";


import { useAuth } from "../lib/auth-context";
import AppShell from "../components/layout/AppShell";

export default function StoreLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [u, setU] = useState<any>(null);
  const [p, setP] = useState<any>(null);

  useEffect(() => {
    if (loading) return;
    if (pathname === "/") return;
    if (!user) {
      router.push("/login");
      return;
    }
    setU(user);
    setP(user);
    if (!user.whatsapp) router.push("/complete-profile");
  }, [loading, pathname, user, router]);

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
