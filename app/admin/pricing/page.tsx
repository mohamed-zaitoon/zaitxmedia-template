"use client";
import dynamic from "next/dynamic";
const PricingTab = dynamic(() => import("../AdminComponents").then(m => m.PricingTab), { ssr: false });
export default function PricingPage() { return <PricingTab />; }
