import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function GET() {
  try {
    await requireAdmin();
    const docSnap = await adminDb.collection("settings").doc("banned_ips").get();
    const ips: string[] = docSnap.exists && Array.isArray(docSnap.data()?.ips)
      ? docSnap.data()!.ips
      : [];
    return NextResponse.json({ success: true, ips });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ success: false, error: "Unable to fetch banned IPs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const ip = String(body.ip || "").trim();
    if (!ip) return NextResponse.json({ success: false, error: "عنوان IP مطلوب" }, { status: 400 });

    const ref = adminDb.collection("settings").doc("banned_ips");
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const list = snap.exists && Array.isArray(snap.data()?.ips) ? snap.data()!.ips : [];
      if (!list.includes(ip)) {
        list.push(ip);
        t.set(ref, { ips: list, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });

    return NextResponse.json({ success: true, message: `تم حظر IP (${ip}) بنجاح` });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ success: false, error: "Unable to ban IP" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const ip = searchParams.get("ip")?.trim();
    if (!ip) return NextResponse.json({ success: false, error: "عنوان IP مطلوب" }, { status: 400 });

    const ref = adminDb.collection("settings").doc("banned_ips");
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (snap.exists && Array.isArray(snap.data()?.ips)) {
        const list = snap.data()!.ips.filter((item: string) => item !== ip);
        t.set(ref, { ips: list, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });

    return NextResponse.json({ success: true, message: `تم إلغاء حظر IP (${ip}) بنجاح` });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ success: false, error: "Unable to unban IP" }, { status: 500 });
  }
}
