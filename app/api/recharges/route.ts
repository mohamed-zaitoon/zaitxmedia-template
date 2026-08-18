import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 100);
  const resultLimit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 100);
  const snapshot = await adminDb
    .collection("recharges")
    .where("userId", "==", userId)
    .limit(resultLimit)
    .get();

  const recharges = snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        amount: data.amount,
        currency: data.currency || (data.method === "barq" ? "SAR" : "EGP"),
        method: data.method,
        status: data.status,
        paymentStatus: data.paymentStatus,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.()
          || (typeof data.createdAt === "string" ? data.createdAt : null),
      };
    })
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));

  return NextResponse.json(
    { success: true, recharges },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
