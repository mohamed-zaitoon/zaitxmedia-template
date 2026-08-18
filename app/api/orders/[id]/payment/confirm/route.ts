import { auth } from "@clerk/nextjs/server";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import {
  normalizeSubmittedReference,
  type SmsProvider,
} from "@/lib/payments/sms";

const PROVIDERS = new Set<SmsProvider>(["vodafone", "instapay", "barq", "bank"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const provider = body.paymentMethodKey as SmsProvider;
  const rawReference = String(body.reference ?? "").trim();

  if (!PROVIDERS.has(provider) || !rawReference) {
    return NextResponse.json({ error: "بيانات التحويل غير مكتملة" }, { status: 400 });
  }

  const normalized = normalizeSubmittedReference(provider, rawReference);
  if (!normalized) {
    return NextResponse.json({ error: "بيانات المحوّل غير صحيحة" }, { status: 400 });
  }

  const orderRef = adminDb.collection("orders").doc(id);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) throw new Error("NOT_FOUND");
      const data = order.data()!;
      const isOwner = data.user_id === userId || data.userId === userId;
      if (!isOwner) throw new Error("FORBIDDEN");
      if (data.paymentStatus !== "awaiting_payment") throw new Error("INVALID_STATE");

      const paymentData: Record<string, unknown> = {
        paymentMethodKey: provider,
        originalReference: rawReference,
        paymentStatus: "verifying",
        verificationStartedAt: FieldValue.serverTimestamp(),
        verificationDeadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      if (provider === "vodafone") paymentData.payerPhoneNormalized = normalized;
      if (provider === "barq") paymentData.payerNameNormalized = normalized;
      if (provider === "instapay") paymentData.originalReference = normalized;

      transaction.update(orderRef, paymentData);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Payment confirmation failed:", error);
    const status = message === "NOT_FOUND" ? 404 : message === "FORBIDDEN" ? 403 : 409;
    return NextResponse.json({ error: "تعذر بدء التحقق من هذا الطلب" }, { status });
  }
}
