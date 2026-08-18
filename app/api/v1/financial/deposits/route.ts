import { AggregateField } from "firebase-admin/firestore";
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
    const statusFilter = searchParams.get("status") || "";
    const methodFilter = searchParams.get("paymentMethod") || "";
    const userIdFilter = searchParams.get("userId") || "";

    let baseQuery: FirebaseFirestore.Query = adminDb.collection("recharges");
    if (userIdFilter) baseQuery = baseQuery.where("userId", "==", userIdFilter);
    if (statusFilter) baseQuery = baseQuery.where("status", "==", statusFilter);
    if (methodFilter) baseQuery = baseQuery.where("method", "==", methodFilter);
    const [snap, countSnapshot] = await Promise.all([
      baseQuery.orderBy("createdAt", "desc").offset((page - 1) * limitNum).limit(limitNum).get(),
      baseQuery.aggregate({ count: AggregateField.count() }).get(),
    ]);
    let deposits: any[] = [];

    snap.forEach((doc: any) => {
      const d = doc.data();
      const method = d.method || d.paymentMethod || "vodafone_cash";
      const grossEgp = n(d.grossDepositEgp || d.amount);
      const netEgp = n(d.netDepositEgp);
      const fee = n(d.depositFeeEgp) || Math.max(0, grossEgp - netEgp);
      const creditedUsd = n(d.creditedUsd || d.estimatedCreditUsd);

      const currency = d.currency === "SAR" || method === "barq" ? "SAR" : "EGP";
      const paidAmount = currency === "SAR" ? n(d.grossDepositSar || d.amount) : grossEgp;
      const feeAmount = currency === "SAR" ? n(d.depositFeeSar) : fee;
      const processorCost = currency === "SAR" ? n(d.processingCostSar) : n(d.processingCostEgp);
      const depositProfit = currency === "SAR"
        ? n(d.depositProfitSar) || Math.max(0, feeAmount - processorCost)
        : n(d.depositProfitEgp) || Math.max(0, feeAmount - processorCost);

      deposits.push({
        id: doc.id,
        userId: d.userId || d.user_id || "",
        userEmail: d.userEmail || d.email || "",
        paymentMethod: method,
        currency,
        customerPaidAmount: paidAmount,
        walletCreditedAmount: netEgp || grossEgp,
        creditedUsd,
        chargedFeeAmount: feeAmount,
        processorCostAmount: processorCost,
        grossDepositProfit: feeAmount,
        netDepositProfit: depositProfit,
        externalReference: d.reference || d.smsReference || "",
        status: d.status || "pending",
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: d.approvedAt?.toDate?.()?.toISOString() || null,
      });
    });

    const total = countSnapshot.data().count;

    return NextResponse.json({
      success: true,
      data: deposits,
      pagination: { page, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });

  } catch (err: any) {
    console.error("Financial deposits error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
