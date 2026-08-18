"use client";
import dynamic from "next/dynamic";
const WalletsTab = dynamic(() => import("../AdminComponents").then(m => m.WalletsTab), { ssr: false });
export default function WalletsPage() { return <WalletsTab />; }
