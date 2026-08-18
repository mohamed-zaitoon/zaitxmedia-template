import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/admin";
import {
  auditRecord,
  isAssetType,
  isFinancialCurrency,
  ledgerRecord,
  money,
} from "@/lib/financial/model";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const assetRef = adminDb.collection("financial_assets").doc(id);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(assetRef);
      if (!snapshot.exists) throw new Error("ASSET_NOT_FOUND");
      const before = snapshot.data()!;
      const name = body.name === undefined ? String(before.name) : String(body.name).trim().slice(0, 120);
      const type = body.type === undefined ? String(before.type) : String(body.type);
      const currency = body.currency === undefined ? String(before.currency) : String(body.currency);
      const balance = body.balance === undefined ? Number(before.balance) : Number(body.balance);
      if (
        !name
        || !isAssetType(type)
        || !isFinancialCurrency(currency)
        || !Number.isFinite(balance)
        || balance < 0
      ) {
        throw new Error("INVALID_ASSET");
      }
      if (currency !== before.currency && money(before.balance) !== 0) {
        throw new Error("CURRENCY_CHANGE_REQUIRES_ZERO_BALANCE");
      }
      const after = {
        name,
        type,
        currency,
        balance: money(balance),
        notes: body.notes === undefined
          ? String(before.notes || "")
          : String(body.notes || "").trim().slice(0, 2000),
      };
      const difference = money(after.balance - Number(before.balance));
      transaction.update(assetRef, {
        ...after,
        lastUpdated: FieldValue.serverTimestamp(),
        updatedBy: admin.userId,
      });
      if (difference !== 0) {
        transaction.create(
          adminDb.collection("financial_ledger").doc(),
          ledgerRecord({
            type: "asset_adjustment",
            currency,
            amount: Math.abs(difference),
            direction: difference > 0 ? "credit" : "debit",
            account: `asset:${id}`,
            referenceId: id,
            referenceType: "financial_asset",
            description: `تعديل رصيد الأصل ${name}`,
            createdBy: admin.userId,
            metadata: { balanceBefore: money(before.balance), balanceAfter: after.balance },
          }),
        );
      }
      transaction.create(
        adminDb.collection("financial_audit_logs").doc(),
        auditRecord({
          action: "asset_updated",
          entityType: "financial_asset",
          entityId: id,
          before: {
            name: before.name,
            type: before.type,
            currency: before.currency,
            balance: money(before.balance),
            notes: before.notes || "",
          },
          after,
          adminId: admin.userId,
          adminEmail: admin.email,
          description: String(body.reason || "تعديل يدوي من لوحة الإدارة").slice(0, 500),
        }),
      );
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "ASSET_NOT_FOUND" ? 404 : message.startsWith("INVALID_") || message.startsWith("CURRENCY_") ? 400 : 500;
    return NextResponse.json({ success: false, error: message || "تعذر تعديل الأصل" }, { status });
  }
}
