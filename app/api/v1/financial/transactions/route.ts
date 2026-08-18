import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { verifyAdminToken, parseQueryInt } from "@/lib/financial/auth";

const n = (v: any) => Number(v) || 0;

export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = parseQueryInt(searchParams.get("page"), 1);
    const limitNum = Math.min(parseQueryInt(searchParams.get("limit"), 50), 200);
    const typeFilter = searchParams.get("type") || "";
    const userIdFilter = searchParams.get("userId") || "";
    const currencyFilter = searchParams.get("currency") || "";

    let query: FirebaseFirestore.Query = adminDb.collection("wallet_transactions");

    if (userIdFilter) query = query.where("userId", "==", userIdFilter);
    if (typeFilter) query = query.where("type", "==", typeFilter);
    if (currencyFilter) query = query.where("currency", "==", currencyFilter);

    const [snap, countSnapshot] = await Promise.all([
      query.orderBy("createdAt", "desc").offset((page - 1) * limitNum).limit(limitNum).get(),
      query.count().get(),
    ]);
    let txs: any[] = [];

    snap.forEach((doc: any) => {
      const d = doc.data();
      const currency = d.currency || "USD";
      txs.push({
        id: doc.id,
        userId: d.userId || "",
        type: d.type || "unknown",
        currency,
        amount: n(d.amountUsd || d.amount),
        amountEgp: n(d.amountEgp),
        balanceBefore: n(d.balanceBeforeUsd || d.balanceBefore),
        balanceAfter: n(d.balanceAfterUsd || d.balanceAfter),
        status: d.status || "completed",
        referenceType: d.referenceType || null,
        referenceId: d.orderId || d.depositId || d.referenceId || null,
        description: d.description || "",
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        createdBy: d.createdBy || "system",
      });
    });

    const total = countSnapshot.data().count;

    return NextResponse.json({
      success: true,
      data: txs,
      pagination: { page, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });

  } catch (err: any) {
    console.error("Financial transactions error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
