"use client";
import dynamic from "next/dynamic";
const SettingsTab = dynamic(() => import("../AdminComponents").then(m => m.SettingsTab), { ssr: false });
export default function SettingsPage() { return <SettingsTab />; }
