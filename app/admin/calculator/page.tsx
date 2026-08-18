"use client";
import dynamic from "next/dynamic";
const CalculatorTab = dynamic(() => import("../AdminComponents").then(m => m.CalculatorTab), { ssr: false });
export default function CalculatorPage() { return <CalculatorTab />; }
