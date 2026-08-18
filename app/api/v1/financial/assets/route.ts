import { AggregateField, FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/admin";
import {
  ASSET_TYPES,
  FINANCIAL_CURRENCIES,
  isAssetType,
  isFinancialCurrency,
  ledgerRecord,
  money,
} from "@/lib/financial/model";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1), 100);
    const cursor = request.nextUrl.searchParams.get("cursor");
    let query: FirebaseFirestore.Query = adminDb
      .collection("financial_assets")
      .orderBy("name")
      .limit(limit);
    if (cursor) {
      const cursorDocument = await adminDb.collection("financial_assets").doc(cursor).get();
      if (cursorDocument.exists) query = query.startAfter(cursorDocument);
    }
    const [snapshot, ...totalsSnapshots] = await Promise.all([
      query.get(),
      ...FINANCIAL_CURRENCIES.map((currency) =>
        adminDb
          .collection("financial_assets")
          .where("currency", "==", currency)
          .aggregate({ balance: AggregateField.sum("balance") })
          .get(),
      ),
    ]);
    const totals = Object.fromEntries(
      FINANCIAL_CURRENCIES.map((currency, index) => [
        currency,
        money(totalsSnapshots[index].data().balance),
      ]),
    );
    return NextResponse.json({
      success: true,
      data: snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
        lastUpdated: document.data().lastUpdated?.toDate?.()?.toISOString() || null,
      })),
      totals,
      types: ASSET_TYPES,
      currencies: FINANCIAL_CURRENCIES,
      nextCursor:
        snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1]?.id || null : null,
    });
  } catch (error) {
    console.error("Financial assets GET error", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل الأصول" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 120);
    const type = String(body.type || "");
    const currency = String(body.currency || "");
    const balance = Number(body.balance);
    if (
      !name
      || !isAssetType(type)
      || !isFinancialCurrency(currency)
      || !Number.isFinite(balance)
      || balance < 0
    ) {
      return NextResponse.json({ success: false, error: "بيانات الأصل غير صحيحة" }, { status: 400 });
    }
    const assetRef = adminDb.collection("financial_assets").doc();
    const ledgerRef = adminDb.collection("financial_ledger").doc();
    const asset = {
      name,
      type,
      currency,
      balance: money(balance),
      notes: String(body.notes || "").trim().slice(0, 2000),
      schemaVersion: 2,
      createdAt: FieldValue.serverTimestamp(),
      lastUpdated: FieldValue.serverTimestamp(),
      createdBy: admin.userId,
    };
    await adminDb.runTransaction(async (transaction) => {
      transaction.create(assetRef, asset);
      if (balance > 0) {
        transaction.create(ledgerRef, ledgerRecord({
          type: "opening_balance",
          currency,
          amount: balance,
          direction: "credit",
          account: `asset:${assetRef.id}`,
          referenceId: assetRef.id,
          referenceType: "financial_asset",
          description: `رصيد افتتاحي للأصل ${name}`,
          createdBy: admin.userId,
        }));
      }
      transaction.create(
        adminDb.collection("financial_audit_logs").doc(),
        {
          action: "asset_created",
          entityType: "financial_asset",
          entityId: assetRef.id,
          before: null,
          after: { name, type, currency, balance: money(balance), notes: asset.notes },
          adminId: admin.userId,
          adminEmail: admin.email,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
        },
      );
    });
    return NextResponse.json({ success: true, id: assetRef.id }, { status: 201 });
  } catch (error) {
    console.error("Financial assets POST error", error);
    return NextResponse.json({ success: false, error: "تعذر إنشاء الأصل" }, { status: 500 });
  }
}
