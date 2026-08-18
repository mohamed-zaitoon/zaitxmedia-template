import { auth } from "@clerk/nextjs/server";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rechargeRef = adminDb.collection("recharges").doc(id);
  let snapshot = await rechargeRef.get();
  if (!snapshot.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let data = snapshot.data()!;
  if (data.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (["verified", "approved"].includes(data.status) || data.paymentStatus === "paid") {
    return NextResponse.json({ success: true, status: "matched" });
  }

  if (body.restart === true) {
    await rechargeRef.update({
      status: "matching",
      paymentStatus: "verifying",
      verificationStartedAt: FieldValue.serverTimestamp(),
      verificationDeadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    snapshot = await rechargeRef.get();
    data = snapshot.data()!;
  } else {
    const deadline = new Date(data.verificationDeadline || 0).getTime();
    if (deadline && Date.now() >= deadline) {
      await rechargeRef.update({
        status: "manual_review",
        paymentStatus: "manual_review",
        manualReviewAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "manual_review" });
    }
  }

  const recentCutoff = Date.now() - 10 * 60 * 1000;
  const smsQuery = await adminDb
    .collection("payment_sms")
    .where("extractedAmountPiasters", "==", Number(data.expectedPaymentAmountMinor))
    .limit(20)
    .get();
  const candidates = smsQuery.docs.filter((sms) => {
    const smsData = sms.data();
    const provider = smsData.classification === "vfcash" ? "vodafone" : smsData.classification;
    return (
      (smsData.createdAt?.toMillis?.() || 0) >= recentCutoff &&
      provider === data.paymentMethodKey &&
      ["pending", "manual_review"].includes(smsData.processingStatus)
    );
  });

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "Verifier unavailable" }, { status: 503 });
  for (const sms of candidates) {
    const response = await fetch(new URL("/api/internal/payment/sms_match", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ smsId: sms.id, retry: true }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (result.status === "matched") {
      return NextResponse.json({ success: true, status: "matched" });
    }
  }
  return NextResponse.json({ success: true, status: "waiting", checked: candidates.length });
}
