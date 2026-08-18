import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const snapshot = await adminDb.collection("recharges").doc(id).get();
  if (!snapshot.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = snapshot.data()!;
  const isOwner = data.userId === userId || data.user_id === userId;
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    success: true,
    recharge: {
      id: snapshot.id,
      status: data.status,
      paymentStatus: data.paymentStatus,
      estimatedCreditUsd: data.estimatedCreditUsd,
      creditedUsd: data.creditedUsd,
      feePercent: data.feePercent,
      verificationDeadline: data.verificationDeadline,
      verificationStartedAt:
        data.verificationStartedAt?.toDate?.()?.toISOString?.() || null,
    },
  });
}
