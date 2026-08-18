import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/admin";
import { isFinancialCurrency } from "@/lib/financial/model";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1), 100);
    const cursor = request.nextUrl.searchParams.get("cursor");
    const currency = request.nextUrl.searchParams.get("currency");
    const type = request.nextUrl.searchParams.get("type");
    const dateFromValue = request.nextUrl.searchParams.get("dateFrom");
    const dateToValue = request.nextUrl.searchParams.get("dateTo");
    let query: FirebaseFirestore.Query = adminDb
      .collection("financial_ledger")
      .orderBy("createdAt", "desc");
    if (currency && isFinancialCurrency(currency)) query = query.where("currency", "==", currency);
    if (type) query = query.where("type", "==", type.slice(0, 80));
    if (dateFromValue) {
      const dateFrom = new Date(dateFromValue);
      if (Number.isFinite(dateFrom.getTime())) query = query.where("createdAt", ">=", dateFrom);
    }
    if (dateToValue) {
      const dateTo = new Date(dateToValue);
      if (Number.isFinite(dateTo.getTime())) query = query.where("createdAt", "<=", dateTo);
    }
    if (cursor) {
      const cursorDocument = await adminDb.collection("financial_ledger").doc(cursor).get();
      if (cursorDocument.exists) query = query.startAfter(cursorDocument);
    }
    const snapshot = await query.limit(limit).get();
    return NextResponse.json({
      success: true,
      data: snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
        createdAt: document.data().createdAt?.toDate?.()?.toISOString() || null,
      })),
      nextCursor:
        snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1]?.id || null : null,
    });
  } catch (error) {
    console.error("Financial ledger error", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل دفتر الأستاذ" }, { status: 500 });
  }
}
