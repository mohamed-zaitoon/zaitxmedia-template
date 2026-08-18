"use client";
import dynamic from "next/dynamic";
const ManualServicesTab = dynamic(() => import("../AdminComponents").then(m => m.ManualServicesTab), { ssr: false });
export default function ManualSvcsPage() { return <ManualServicesTab />; }
