import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

const COLLECTIONS = ["profiles", "wallet_transactions", "orders", "recharges"] as const;

export async function GET() {
  try {
    await requireAdmin();
    const snapshots = await Promise.all(
      COLLECTIONS.map((name) => adminDb.collection(name).count().get()),
    );
    return NextResponse.json({
      success: true,
      dryRun: true,
      counts: Object.fromEntries(
        COLLECTIONS.map((name, index) => [name, snapshots[index].data().count]),
      ),
      message: "المعاينة لا تعدل أي بيانات",
    });
  } catch (error) {
    const auth = adminAuthErrorResponse(error);
    if (auth) return auth;
    return NextResponse.json({ success: false, error: "تعذر معاينة الترحيل" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "MIGRATE_FINANCIAL_V2") {
      return NextResponse.json({ success: false, error: "Migration confirmation required" }, { status: 400 });
    }
    const stats: Record<string, number> = {};

    for (const collectionName of COLLECTIONS) {
      let changed = 0;
      let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      for (;;) {
        let query: FirebaseFirestore.Query = adminDb
          .collection(collectionName)
          .orderBy(FieldPath.documentId())
          .limit(250);
        if (cursor) query = query.startAfter(cursor);
        const snapshot = await query.get();
        if (snapshot.empty) break;
        const batch = adminDb.batch();
        for (const document of snapshot.docs) {
          const data = document.data();
          if (
            collectionName === "profiles"
            && Number(data.financialSchemaVersion) < 2
          ) {
            batch.set(document.ref, {
              "balances.USD": Number(data.balance) || 0,
              "balances.EGP": Number(data.balances?.EGP) || 0,
              "balances.SAR": Number(data.balances?.SAR) || 0,
              financialSchemaVersion: 2,
              financialMigratedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            changed += 1;
          } else if (
            collectionName === "wallet_transactions"
            && Number(data.schemaVersion) < 2
          ) {
            const type = data.type === "debit" ? "order_payment" : data.type || "adjustment";
            const referenceId = data.referenceId || data.orderId || data.rechargeId || null;
            batch.set(document.ref, {
              currency: "USD",
              amount: Number(data.amountUsd ?? data.amount) || 0,
              balanceBefore: Number(data.balanceBeforeUsd ?? data.balanceBefore) || 0,
              balanceAfter: Number(data.balanceAfterUsd ?? data.balanceAfter) || 0,
              type,
              referenceId,
              referenceType: data.orderId ? "order" : data.rechargeId ? "recharge" : null,
              immutable: true,
              schemaVersion: 2,
            }, { merge: true });
            batch.create(adminDb.collection("financial_ledger").doc(`wallet_${document.id}`), {
              type,
              currency: "USD",
              amount: Number(data.amountUsd ?? data.amount) || 0,
              direction: type === "deposit" || type === "refund" ? "credit" : "debit",
              account: "customer_service_wallets",
              userId: data.userId || null,
              referenceId,
              referenceType: data.orderId ? "order" : data.rechargeId ? "recharge" : "wallet_transaction",
              description: data.description || `حركة تاريخية #${document.id.slice(0, 8)}`,
              immutable: true,
              schemaVersion: 2,
              migratedBy: admin.userId,
              createdAt: data.createdAt || FieldValue.serverTimestamp(),
            });
            changed += 1;
          } else if (
            collectionName === "orders"
            && Number(data.financialSchemaVersion) < 2
          ) {
            const saleUsd = Number(data.saleAmountUsd) || 0;
            const supplierCostUsd = Number(data.supplierCostUsd) || 0;
            batch.set(document.ref, {
              supplierPriceUsd: Number(data.supplierPriceUsd ?? data.supplierCostUsd) || 0,
              supplierPricingBasis: data.supplierPricingBasis || "per_1000",
              supplierCostUsd,
              profitUsd: Number(data.netServiceProfitUsd) || saleUsd - supplierCostUsd,
              financialSchemaVersion: 2,
            }, { merge: true });
            changed += 1;
          } else if (
            collectionName === "recharges"
            && Number(data.financialSchemaVersion) < 2
          ) {
            const isSar = data.currency === "SAR" || data.method === "barq";
            const gross = Number(data.amount) || 0;
            const feePercent = Number(data.feePercent ?? data.depositFeePercent) || 0;
            const fee = gross * feePercent / 100;
            batch.set(document.ref, {
              ...(isSar
                ? { grossDepositSar: gross, depositFeeSar: fee, processingCostSar: 0, depositProfitSar: fee }
                : {
                    grossDepositEgp: Number(data.grossDepositEgp ?? gross) || 0,
                    depositFeeEgp: Number(data.depositFeeEgp ?? fee) || 0,
                    processingCostEgp: Number(data.processingCostEgp) || 0,
                    depositProfitEgp:
                      Number(data.depositProfitEgp)
                      || Math.max(0, Number(data.depositFeeEgp ?? fee) - Number(data.processingCostEgp || 0)),
                  }),
              financialSchemaVersion: 2,
            }, { merge: true });
            changed += 1;
          }
        }
        await batch.commit();
        cursor = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < 250) break;
      }
      stats[collectionName] = changed;
    }
    await adminDb.collection("financial_audit_logs").add({
      action: "financial_v2_migration",
      entityType: "system",
      entityId: "financial_v2",
      before: null,
      after: stats,
      adminId: admin.userId,
      adminEmail: admin.email,
      immutable: true,
      schemaVersion: 2,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, migrated: stats });
  } catch (error) {
    const auth = adminAuthErrorResponse(error);
    if (auth) return auth;
    console.error("Financial migration error", error);
    return NextResponse.json({ success: false, error: "تعذر تشغيل الترحيل" }, { status: 500 });
  }
}
