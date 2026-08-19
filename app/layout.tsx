import "./globals.css";
import type { Metadata, Viewport } from "next";
import CountryBlocker from "./components/CountryBlocker";
import SiteAvailabilityGate from "./components/SiteAvailabilityGate";


export const viewport: Viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://zaitxmedia.com"),
  title: {
    default: "ZAITX MEDIA",
    template: "ZAITX MEDIA",
  },
  description:
    "موقع (ZAITX MEDIA) — المنصة الأولى والأسرع لشحن عملات تيك توك وشحن الألعاب بأرخص الأسعار في مصر والسعودية والوطن العربي تسليم فوري وآمن 100%.",
  keywords: [
    "هرم شحن عملات",
    "هرم لشحن تيك توك",
    "هرم استور",
    "الدولي استور",
    "الدولي للشحن",
    "شحن عملات تيك توك",
    "شحن عملات بارخص الاسعار",
    "شحن تيك توك رخيص",
    "شحن كوينز تيك توك",
    "شحن العاب",
    "شحن تيك توك فودافون كاش",
    "شحن انستاباي تيك توك",
    "ZAITX MEDIA",
    "زايتكس ميديا"
  ].join(", "),
  alternates: {
    canonical: "https://zaitxmedia.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "ZAITX MEDIA | شحن عملات تيك توك بأرخص الأسعار",
    description: "أسرع وأرخص موقع لشحن عملات تيك توك وشحن الألعاب بأسعار تنافسية وتسليم فوري.",
    url: "https://zaitxmedia.com",
    siteName: "ZAITX MEDIA",
    images: [
      {
        url: "https://zaitxmedia.com/zaitx-logo.png",
        width: 512,
        height: 512,
        alt: "ZAITX MEDIA - شحن عملات تيك توك",
      },
    ],
    type: "website",
    locale: "ar_EG",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZAITX MEDIA | شحن عملات تيك توك بأرخص الأسعار",
    description: "شحن عملات تيك توك وشحن ألعاب بأرخص الأسعار وتسليم فوري.",
    images: ["https://zaitxmedia.com/zaitx-logo.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/zaitx-logo-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/zaitx-logo-512.png",
    apple: [{ url: "/zaitx-logo-touch.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "ZAITX MEDIA",
    statusBarStyle: "black-translucent",
  },
};

import { ClerkProvider } from '@clerk/nextjs'
import { arSA } from '@clerk/localizations'
import { dark } from '@clerk/themes'
import { AuthProvider } from './lib/auth-context';
import { CurrencyProvider } from './lib/currency-context';
import { ThemeProvider } from './lib/theme-context';
import { Providers } from './providers';
import { Toaster } from '@/app/components/ui/sonner';

import SeoSchema from './components/SeoSchema';
import { CartProvider } from './lib/cart-context';
import CartDrawer from './components/CartDrawer';

import ContentProtection from './components/ContentProtection';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      localization={arSA}
      appearance={{ baseTheme: dark, variables: { colorPrimary: '#38bdf8' } } as any}
    >
      <html lang="ar" dir="rtl">
        <head>
          <meta name="theme-color" content="#070a12" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <SeoSchema />
        </head>
        <body>
          <ContentProtection />
          <Providers>
            <AuthProvider>
              <ThemeProvider>
                <CurrencyProvider>
                  <CartProvider>
                    <SiteAvailabilityGate>
                      <CountryBlocker>{children}</CountryBlocker>
                    </SiteAvailabilityGate>
                    <CartDrawer />
                    <Toaster position="top-center" richColors />
                  </CartProvider>
                </CurrencyProvider>
              </ThemeProvider>
            </AuthProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
