"use client";
import dynamic from "next/dynamic";
const RechargesTab = dynamic(() => import("../AdminComponents").then(m => m.RechargesTab), { ssr: false });
export default function RechargesPage() { return <RechargesTab />; }
