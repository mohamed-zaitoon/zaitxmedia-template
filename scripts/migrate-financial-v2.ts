/**
 * Non-destructive Firestore financial migration.
 *
 * Dry-run (default):
 *   npx tsx scripts/migrate-financial-v2.ts
 *
 * Apply:
 *   npx tsx scripts/migrate-financial-v2.ts --apply
 *
 * The migration never deletes documents. Ledger document IDs are deterministic,
 * so rerunning it is safe.
 */
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import "dotenv/config";

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID
  || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  || "eldawlystore-75acf";
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const firebaseApp = getApps()[0] || initializeApp({
  credential:
    clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault(),
  projectId,
});
const adminDb = getFirestore(firebaseApp);

const apply = process.argv.includes("--apply");
const PAGE_SIZE = 250;

async function migrateCollection(
  collectionName: string,
  transform: (
    id: string,
    data: FirebaseFirestore.DocumentData,
  ) => {
    update?: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>;
    ledger?: { id: string; data: FirebaseFirestore.DocumentData }[];
  },
) {
  let lastId: string | null = null;
  let inspected = 0;
  let changed = 0;
  for (;;) {
    let query: FirebaseFirestore.Query = adminDb
      .collection(collectionName)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (lastId) query = query.startAfter(lastId);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = adminDb.batch();
    for (const document of snapshot.docs) {
      inspected += 1;
      const result = transform(document.id, document.data());
      if (result.update) {
        changed += 1;
        if (apply) batch.set(document.ref, result.update, { merge: true });
      }
      for (const entry of result.ledger || []) {
        if (apply) {
          batch.set(
            adminDb.collection("financial_ledger").doc(entry.id),
            entry.data,
            { merge: false },
          );
        }
      }
    }
    if (apply) await batch.commit();
    lastId = snapshot.docs[snapshot.docs.length - 1].id;
    if (snapshot.size < PAGE_SIZE) break;
  }
  process.stdout.write(`${collectionName}: inspected=${inspected}, changed=${changed}\n`);
}

async function main() {
  process.stdout.write(`financial-v2 migration mode=${apply ? "APPLY" : "DRY_RUN"}\n`);

  await migrateCollection("profiles", (_id, data) => {
    if (Number(data.financialSchemaVersion) >= 2) return {};
    return {
      update: {
        "balances.USD": Number(data.balance) || 0,
        "balances.EGP": Number(data.balances?.EGP) || 0,
        "balances.SAR": Number(data.balances?.SAR) || 0,
        financialSchemaVersion: 2,
        financialMigratedAt: FieldValue.serverTimestamp(),
      },
    };
  });

  await migrateCollection("wallet_transactions", (id, data) => {
    if (Number(data.schemaVersion) >= 2) return {};
    const referenceId = data.referenceId || data.orderId || data.rechargeId || null;
    const type =
      data.type === "debit" ? "order_payment"
        : data.type || "adjustment";
    return {
      update: {
        currency: data.currency === "EGP" || data.currency === "SAR" ? data.currency : "USD",
        amount: Number(data.amountUsd ?? data.amount) || 0,
        balanceBefore: Number(data.balanceBeforeUsd ?? data.balanceBefore) || 0,
        balanceAfter: Number(data.balanceAfterUsd ?? data.balanceAfter) || 0,
        type,
        referenceId,
        referenceType: data.orderId ? "order" : data.rechargeId ? "recharge" : null,
        immutable: true,
        schemaVersion: 2,
      },
      ledger: [{
        id: `wallet_${id}`,
        data: {
          type,
          currency: "USD",
          amount: Number(data.amountUsd ?? data.amount) || 0,
          direction: type === "refund" || type === "deposit" ? "credit" : "debit",
          account: "customer_service_wallets",
          userId: data.userId || null,
          referenceId,
          referenceType: data.orderId ? "order" : data.rechargeId ? "recharge" : "wallet_transaction",
          description: data.description || `حركة محفظة تاريخية #${id.slice(0, 8)}`,
          sourceDocumentId: id,
          immutable: true,
          schemaVersion: 2,
          createdAt: data.createdAt || FieldValue.serverTimestamp(),
        },
      }],
    };
  });

  await migrateCollection("orders", (id, data) => {
    if (Number(data.financialSchemaVersion) >= 2) return {};
    const saleUsd = Number(data.saleAmountUsd) || 0;
    const supplierCostUsd = Number(data.supplierCostUsd) || 0;
    const profitUsd = Number(data.netServiceProfitUsd) || saleUsd - supplierCostUsd;
    return {
      update: {
        supplierPriceUsd: Number(data.supplierPriceUsd ?? data.supplierCostUsd) || 0,
        supplierPricingBasis: data.supplierPricingBasis || "per_1000",
        supplierCostUsd,
        profitUsd,
        netServiceProfitUsd: profitUsd,
        financialSchemaVersion: 2,
      },
      ledger: data.status === "completed" && supplierCostUsd > 0 ? [{
        id: `order_cost_${id}`,
        data: {
          type: "supplier_cost",
          currency: "USD",
          amount: supplierCostUsd,
          direction: "debit",
          account: "supplier_costs",
          counterpartyAccount: "orders_receivable",
          userId: data.user_id || null,
          referenceId: id,
          referenceType: "order",
          description: `تكلفة مورد تاريخية للطلب #${id.slice(0, 8)}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: data.completedAt || data.createdAt || FieldValue.serverTimestamp(),
        },
      }] : [],
    };
  });

  await migrateCollection("recharges", (id, data) => {
    if (Number(data.financialSchemaVersion) >= 2) return {};
    const isSar = data.currency === "SAR" || data.method === "barq";
    const gross = Number(data.amount) || 0;
    const feePercent = Number(data.feePercent ?? data.depositFeePercent) || 0;
    const fee = gross * feePercent / 100;
    return {
      update: {
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
      },
    };
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
