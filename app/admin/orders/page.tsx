"use client";
import dynamic from "next/dynamic";
const OrdersTab = dynamic(() => import("../AdminComponents").then(m => m.OrdersTab), { ssr: false });
export default function OrdersPage() { return <OrdersTab />; }
