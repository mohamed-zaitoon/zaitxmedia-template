import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await adminDb.collection("orders").doc(id).get();
  if (!order.exists) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const data = order.data()!;
  if (data.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (data.paymentStatus !== "verifying") {
    return NextResponse.json({ success: true, status: data.paymentStatus });
  }

  const startedAt = data.verificationStartedAt?.toMillis?.() || Date.now();
  if (Date.now() - startedAt > 5 * 60 * 1000) {
    return NextResponse.json({ success: true, status: "window_expired" });
  }

  const amount = Number(data.expectedPaymentAmountMinor);
  const recentCutoff = Date.now() - 10 * 60 * 1000;
  const smsQuery = await adminDb
    .collection("payment_sms")
    .where("extractedAmountPiasters", "==", amount)
    .limit(20)
    .get();

  const candidates = smsQuery.docs.filter((sms) => {
    const smsData = sms.data();
    const createdAt = smsData.createdAt?.toMillis?.() || 0;
    const provider =
      smsData.classification === "vfcash"
        ? "vodafone"
        : smsData.classification;
    return (
      createdAt >= recentCutoff &&
      provider === data.paymentMethodKey &&
      ["pending", "manual_review"].includes(smsData.processingStatus)
    );
  });

  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.error("Payment recheck failed: INTERNAL_API_SECRET is missing");
    return NextResponse.json({ error: "Payment verifier is unavailable" }, { status: 503 });
  }

  const results = [];
  for (const sms of candidates) {
    const response = await fetch(
      new URL("/api/internal/payment/sms_match", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ smsId: sms.id, retry: true }),
        cache: "no-store",
      },
    );
    results.push(await response.json().catch(() => ({ success: false })));
    if (results.at(-1)?.status === "matched") break;
  }

  return NextResponse.json({
    success: true,
    status: results.find((result) => result.status === "matched")
      ? "matched"
      : "waiting",
    checked: candidates.length,
  });
}
