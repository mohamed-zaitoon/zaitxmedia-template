import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "لوحة تحكم ZAITX MEDIA",
  icons: {
    // Admin-specific icons generated from `admin-logo-source.png`
    icon: [{ url: "/admin-logo-icon-512.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/admin-logo-icon-512.png",
    apple: "/admin-logo-apple-touch.png",
  },
  manifest: "/admin-manifest.webmanifest",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

import { AdminLayoutClient } from "./AdminLayoutClient";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <head>
        <link rel="icon" href="/admin-logo-icon-512.png" type="image/png" />
        <link rel="apple-touch-icon" href="/admin-logo-apple-touch.png" />
      </head>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </>
  );
}
