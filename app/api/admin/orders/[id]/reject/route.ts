import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { ledgerRecord } from "@/lib/financial/model";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const body = await _request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    if (!reason) {
      return NextResponse.json({ error: "يجب إدخال سبب رفض الطلب" }, { status: 400 });
    }
    const { id } = await context.params;
    const orderRef = adminDb.collection("orders").doc(id);
    let refundedUsd = 0;
    await adminDb.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) {
        console.error("Order not found:", id);
        throw new Error("ORDER_NOT_FOUND");
      }
      const data = order.data()!;

      if (data.balance_refunded === true) {
        transaction.update(orderRef, { status: "rejected" });
        return;
      }

      const isWalletPayment = data.balance_deducted === true || data.paymentMode === "wallet_balance";

      if (isWalletPayment) {
        if (!data.user_id) throw new Error("الطلب لا يحتوي على معرف مستخدم صالح لإرجاع الرصيد.");
        const profileRef = adminDb.collection("profiles").doc(data.user_id);
        const profile = await transaction.get(profileRef);
        if (!profile.exists) {
          console.error("Profile not found:", data.user_id);
          throw new Error("PROFILE_NOT_FOUND");
        }

        let calculatedRefund = Number(data.saleAmountUsd);
        if (isNaN(calculatedRefund) || calculatedRefund === 0) {
          calculatedRefund = (Number(data.price) || 0) / (Number(data.lockedExchangeRateEgp) || 50);
        }
        refundedUsd = isNaN(calculatedRefund) ? 0 : calculatedRefund;

        const balanceBeforeUsd = Number(profile.data()?.balance) || 0;
        const balanceAfterUsd = Number((balanceBeforeUsd + refundedUsd).toFixed(6));
        const walletTransactionRef = adminDb.collection("wallet_transactions").doc();

        transaction.update(profileRef, {
          balance: balanceAfterUsd,
          "balances.USD": balanceAfterUsd,
          financialSchemaVersion: 2,
        });
        transaction.create(walletTransactionRef, {
          userId: data.user_id,
          orderId: id,
          currency: "USD",
          amount: refundedUsd,
          balanceBefore: balanceBeforeUsd,
          balanceAfter: balanceAfterUsd,
          type: "refund",
          referenceId: id,
          referenceType: "order",
          amountUsd: refundedUsd,
          amountEgp: Number(data.price) || 0,
          exchangeRateEgp: Number(data.lockedExchangeRateEgp) || 50,
          balanceBeforeUsd,
          balanceAfterUsd,
          description: `استرداد الطلب المرفوض #${id.slice(0, 8)}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.create(
          adminDb.collection("financial_ledger").doc(),
          ledgerRecord({
            type: "refund",
            currency: "USD",
            amount: refundedUsd,
            direction: "debit",
            account: "orders_receivable",
            counterpartyAccount: "customer_service_wallets",
            userId: data.user_id,
            referenceId: id,
            referenceType: "order",
            description: `رد قيمة الطلب #${id.slice(0, 8)} إلى رصيد الخدمات`,
            createdBy: admin.userId,
          }),
        );
      }

      transaction.update(orderRef, {
        status: "rejected",
        fulfillmentStatus: "rejected",
        rejection_reason: reason,
        balance_refunded: isWalletPayment,
        refundedUsd,
        refundedAt: FieldValue.serverTimestamp(),
        rejectedBy: admin.userId,
      });
    });

    return NextResponse.json({ success: true, refundedUsd });
  } catch (error: any) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Reject order error:", error);
    // Safely extract string message from any error type
    let message = "تعذر رفض الطلب";
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else if (error?.message && typeof error.message === "string") {
      message = error.message;
    } else if (error?.code && typeof error.code === "string") {
      message = `خطأ: ${error.code}`;
    }
    const status = message.endsWith("_NOT_FOUND") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
