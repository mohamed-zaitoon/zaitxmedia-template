import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { calculateOrderProfit } from "@/lib/financial/order-profit";
import { ledgerRecord } from "@/lib/financial/model";

const allowedStatuses = new Set(["completed", "cancelled", "processing"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status || "");
    const orderRef = adminDb.collection("orders").doc(id);

    if (status === "provide_link") {
      const delivery = body.delivery && typeof body.delivery === "object"
        ? body.delivery as Record<string, unknown>
        : {};
      const update: Record<string, unknown> = {
        fulfillmentStatus: "delivered",
        deliveredAt: FieldValue.serverTimestamp(),
        deliveredBy: admin.userId,
      };
      if (typeof delivery.delivered_link === "string" && delivery.delivered_link.trim()) {
        update.delivered_link = delivery.delivered_link.trim().slice(0, 4000);
        update.authLink = update.delivered_link;
      }
      if (typeof delivery.qr_image === "string" && delivery.qr_image.startsWith("data:image/")) {
        if (delivery.qr_image.length > 2_500_000) {
          return NextResponse.json({ success: false, error: "صورة QR كبيرة جدًا" }, { status: 413 });
        }
        update.qr_image = delivery.qr_image;
        update.qr_expires_at = Date.now() + 30_000;
      }
      if (!update.authLink && !update.qr_image) {
        return NextResponse.json({ success: false, error: "أدخل رابطًا أو صورة QR" }, { status: 400 });
      }
      await orderRef.update(update);
      return NextResponse.json({ success: true, update });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ success: false, error: "حالة الطلب غير صالحة" }, { status: 400 });
    }

    let responseUpdate: Record<string, unknown> = { status };
    await adminDb.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) throw new Error("ORDER_NOT_FOUND");
      const data = order.data()!;

      if (status !== "completed") {
        responseUpdate = {
          status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.userId,
        };
        transaction.update(orderRef, responseUpdate);
        return;
      }

      const supplierPriceUsd = Number(body.supplierPriceUsd);
      if (!Number.isFinite(supplierPriceUsd) || supplierPriceUsd < 0) {
        throw new Error("INVALID_SUPPLIER_PRICE");
      }
      let saleAmountUsd = Number(data.saleAmountUsd) || 0;
      let lockedExchangeRateEgp = Number(data.lockedExchangeRateEgp) || 0;
      const needsDeduction = data.status === "pending_action" && data.balance_deducted !== true;
      const supplierPricingBasis =
        data.supplierPricingBasis === "per_unit" ? "per_unit" : "per_1000";
      if (lockedExchangeRateEgp <= 0) {
        const pricing = await transaction.get(
          adminDb.collection("settings").doc("pricing"),
        );
        lockedExchangeRateEgp = Number(
          pricing.data()?.usd_rate || pricing.data()?.tiktok_usd_rate || 50,
        );
      }

      if (needsDeduction) {
        saleAmountUsd = Number(data.price) / lockedExchangeRateEgp;
        if (!data.user_id) throw new Error("PROFILE_NOT_FOUND");
        const profileRef = adminDb.collection("profiles").doc(data.user_id);
        const profile = await transaction.get(profileRef);
        if (!profile.exists) throw new Error("PROFILE_NOT_FOUND");
        const balanceBeforeUsd = Number(profile.data()?.balance) || 0;
        if (balanceBeforeUsd + 1e-9 < saleAmountUsd) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        const balanceAfterUsd = Number((balanceBeforeUsd - saleAmountUsd).toFixed(6));
        transaction.update(profileRef, {
          balance: balanceAfterUsd,
          "balances.USD": balanceAfterUsd,
          financialSchemaVersion: 2,
        });
        transaction.create(adminDb.collection("wallet_transactions").doc(), {
          userId: data.user_id,
          orderId: id,
          currency: "USD",
          amount: saleAmountUsd,
          balanceBefore: balanceBeforeUsd,
          balanceAfter: balanceAfterUsd,
          type: "order_payment",
          referenceId: id,
          referenceType: "order",
          amountUsd: saleAmountUsd,
          amountEgp: Number(data.price) || 0,
          exchangeRateEgp: lockedExchangeRateEgp,
          balanceBeforeUsd,
          balanceAfterUsd,
          description: `خصم إداري للطلب #${id.slice(0, 8)}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: admin.userId,
        });
        transaction.create(
          adminDb.collection("financial_ledger").doc(),
          ledgerRecord({
            type: "purchase",
            currency: "USD",
            amount: saleAmountUsd,
            direction: "credit",
            account: "customer_service_wallets",
            counterpartyAccount: "orders_receivable",
            userId: data.user_id,
            referenceId: id,
            referenceType: "order",
            description: `خصم طلب #${id.slice(0, 8)}`,
            createdBy: admin.userId,
          }),
        );
      }

      const {
        supplierCostUsd,
        profitUsd,
        supplierCostLocal: costLocal,
        profitLocal,
      } = calculateOrderProfit({
        saleAmountUsd,
        supplierPriceUsd,
        quantity: Number(data.quantity) || 1,
        basis: supplierPricingBasis,
        lockedExchangeRateEgp,
      });
      responseUpdate = {
        status: "completed",
        fulfillmentStatus: "completed",
        supplierPriceUsd,
        supplierPricingBasis,
        supplierCostUsd,
        supplierCostLocal: costLocal,
        supplierCostCurrency: "EGP",
        saleAmountUsd,
        lockedExchangeRateEgp: lockedExchangeRateEgp || null,
        grossServiceProfitUsd: profitUsd,
        netServiceProfitUsd: profitUsd,
        profitUsd,
        profitLocal,
        profitCurrency: "EGP",
        financialSchemaVersion: 2,
        balance_deducted: data.balance_deducted === true || needsDeduction,
        completedAt: FieldValue.serverTimestamp(),
        completedBy: admin.userId,
      };
      transaction.update(orderRef, responseUpdate);
      transaction.create(
        adminDb.collection("financial_ledger").doc(),
        ledgerRecord({
          type: "supplier_cost",
          currency: "USD",
          amount: supplierCostUsd,
          direction: "debit",
          account: "supplier_costs",
          counterpartyAccount: "orders_receivable",
          userId: data.user_id || null,
          referenceId: id,
          referenceType: "order",
          description: `تكلفة مورد الطلب #${id.slice(0, 8)}`,
          createdBy: admin.userId,
          metadata: { supplierPriceUsd, supplierPricingBasis, quantity: Number(data.quantity) || 1 },
        }),
      );
      transaction.create(
        adminDb.collection("financial_audit_logs").doc(),
        {
          action: "order_completed",
          entityType: "order",
          entityId: id,
          before: { status: data.status },
          after: {
            status: "completed",
            supplierPriceUsd,
            supplierCostUsd,
            profitUsd,
            lockedExchangeRateEgp,
          },
          adminId: admin.userId,
          adminEmail: admin.email,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
        },
      );
      const serviceKey = String(data.service_id || data.service_name || "unknown")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 120);
      transaction.set(
        adminDb.collection("financial_profit_dimensions").doc(`service_${serviceKey}`),
        {
          dimension: "service",
          key: String(data.service_id || data.service_name || "unknown"),
          label: String(data.service_name || data.service_id || "خدمة"),
          profitUsd: FieldValue.increment(profitUsd),
          revenueUsd: FieldValue.increment(saleAmountUsd),
          supplierCostUsd: FieldValue.increment(supplierCostUsd),
          orderCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (data.user_id) {
        transaction.set(
          adminDb.collection("financial_profit_dimensions").doc(`customer_${data.user_id}`),
          {
            dimension: "customer",
            key: data.user_id,
            label: String(data.user_email || data.user_name || data.user_id),
            profitUsd: FieldValue.increment(profitUsd),
            revenueUsd: FieldValue.increment(saleAmountUsd),
            orderCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    });

    const clientUpdate = { ...responseUpdate };
    delete clientUpdate.completedAt;
    delete clientUpdate.updatedAt;
    return NextResponse.json({ success: true, update: clientUpdate });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    const message = error instanceof Error ? error.message : "تعذر تحديث الطلب";
    const status =
      message === "ORDER_NOT_FOUND" || message === "PROFILE_NOT_FOUND" ? 404
        : message === "INSUFFICIENT_BALANCE" ? 409
          : message === "INVALID_SUPPLIER_PRICE" ? 400
          : 500;
    console.error("Update order status error", error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
