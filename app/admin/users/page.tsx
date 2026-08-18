"use client";
import dynamic from "next/dynamic";
const UsersTab = dynamic(() => import("../AdminComponents").then(m => m.UsersTab), { ssr: false });
export default function UsersPage() { return <UsersTab />; }
