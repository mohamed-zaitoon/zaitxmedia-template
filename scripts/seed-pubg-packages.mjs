import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "node:fs";

import dotenv from "dotenv";

async function run() {
  if (fs.existsSync(".env.production.local")) {
    dotenv.config({ path: ".env.production.local" });
  } else if (fs.existsSync(".env.local")) {
    dotenv.config({ path: ".env.local" });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "eldawlystore-75acf";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || "";
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n");

  console.log("Client Email:", clientEmail ? "Found" : "Missing");
  console.log("Private Key:", privateKey ? `Found (${privateKey.length} chars)` : "Missing");

  let app;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else if (clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    app = initializeApp({ projectId });
  }

  const db = getFirestore(app);

  // 1. Fetch pricing settings to get current usdRate
  const pricingSnap = await db.collection("settings").doc("pricing").get();
  const pricingData = pricingSnap.data() || {};
  const usdRate = Number(pricingData.usd_rate || pricingData.tiktok_usd_rate || 50);

  console.log("Current USD Rate:", usdRate);

  const pubgPackages = [
    {
      id: "pubg_60_uc",
      name: "60 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "1.11",
      price_usd: 1.11,
      price: Math.ceil(((1.11 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((1.11 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_325_uc",
      name: "300+25 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "5.59",
      price_usd: 5.59,
      price: Math.ceil(((5.59 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((5.59 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_660_uc",
      name: "600+60 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "11.19",
      price_usd: 11.19,
      price: Math.ceil(((11.19 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((11.19 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_1800_uc",
      name: "1500+300 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "27.99",
      price_usd: 27.99,
      price: Math.ceil(((27.99 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((27.99 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_3850_uc",
      name: "3000+850 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "52.99",
      price_usd: 52.99,
      price: Math.ceil(((52.99 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((52.99 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_8100_uc",
      name: "6000+2100 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "105.99",
      price_usd: 105.99,
      price: Math.ceil(((105.99 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((105.99 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_16200_uc",
      name: "12000+4200 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "211.98",
      price_usd: 211.98,
      price: Math.ceil(((211.98 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((211.98 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_24300_uc",
      name: "18000+6300 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "308.97",
      price_usd: 308.97,
      price: Math.ceil(((308.97 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((308.97 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_32400_uc",
      name: "24000+8400 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "411.96",
      price_usd: 411.96,
      price: Math.ceil(((411.96 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((411.96 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
    {
      id: "pubg_40500_uc",
      name: "30000+10500 UC | PUBG MOBILE",
      category: "PUBG MOBILE",
      priceUsd: "453.19",
      price_usd: 453.19,
      price: Math.ceil(((453.19 * usdRate) - 1e-9) * 100) / 100,
      price_egp: Math.ceil(((453.19 * usdRate) - 1e-9) * 100) / 100,
      min: "1",
      max: "1",
      desc: "شحن يدوي بواسطة الآي دي (Player ID)",
    },
  ];

  const manualRef = db.collection("settings").doc("manual_services");
  const manualSnap = await manualRef.get();
  const existingServices = (manualSnap.exists && manualSnap.data()?.services) || [];

  const newIds = new Set(pubgPackages.map((p) => p.id));
  const filteredExisting = existingServices.filter((s) => !newIds.has(s.id));
  const mergedServices = [...filteredExisting, ...pubgPackages];

  await manualRef.set({
    services: mergedServices,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`✅ Saved ${pubgPackages.length} PUBG MOBILE UC packages to settings/manual_services!`);
  console.log("Total manual services count now:", mergedServices.length);
}

run().catch(console.error);
