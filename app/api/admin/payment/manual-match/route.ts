import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { calculateBoundedDepositFee } from "@/lib/deposit-fees";
import { ledgerRecord } from "@/lib/financial/model";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { smsId, action, rechargeId, adminNote } = await request.json();
    if (!smsId || !action) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }
    const smsRef = adminDb.collection("payment_sms").doc(String(smsId));
    if (action === "reject") {
      await smsRef.update({
        processingStatus: "rejected",
        adminNote: String(adminNote || "").slice(0, 500),
        processedAt: FieldValue.serverTimestamp(),
        processedBy: admin.userId,
      });
      return NextResponse.json({ success: true, status: "rejected" });
    }
    if (action !== "confirm" || !rechargeId) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
    const rechargeRef = adminDb.collection("recharges").doc(String(rechargeId));
    await adminDb.runTransaction(async (transaction) => {
      const [sms, recharge, pricing] = await Promise.all([
        transaction.get(smsRef),
        transaction.get(rechargeRef),
        transaction.get(adminDb.collection("settings").doc("pricing")),
      ]);
      if (!sms.exists || sms.data()?.processingStatus === "matched") throw new Error("SMS_ALREADY_MATCHED");
      if (!recharge.exists) throw new Error("RECHARGE_NOT_FOUND");
      const data = recharge.data()!;
      if (["verified", "approved"].includes(data.status)) throw new Error("RECHARGE_ALREADY_VERIFIED");
      const userRef = adminDb.collection("profiles").doc(data.userId);
      const user = await transaction.get(userRef);
      if (!user.exists) throw new Error("PROFILE_NOT_FOUND");
      const usdRate = Number(
        data.lockedUsdEgpRate
        || pricing.data()?.usd_rate
        || pricing.data()?.tiktok_usd_rate
        || 50,
      );
      const sourceCurrency = data.currency === "SAR" ? "SAR" : "EGP";
      const pricingData = pricing.data() || {};
      const feePercent = Number(
        data.feePercent
        ?? pricingData.deposit_fee_percent
        ?? 0.1,
      );
      const feeMinEgp = Number(pricingData.deposit_fee_min_egp ?? 0.5);
      const feeMaxEgp = Number(pricingData.deposit_fee_max_egp ?? 20);

      const sourceAmount = Number(data.amount) || 0;
      const grossEgp = sourceCurrency === "SAR"
        ? sourceAmount * Number(data.lockedSarEgpRate || 12.75)
        : sourceAmount;

      const feeCalc = calculateBoundedDepositFee(grossEgp, {
        feePercent,
        minEgp: feeMinEgp,
        maxEgp: feeMaxEgp,
      });

      const netEgp = feeCalc.netEgp;
      const creditedUsd = Number((netEgp / usdRate).toFixed(6));
      const balanceBefore = Number(user.data()?.balance) || 0;
      const balanceAfter = Number((balanceBefore + creditedUsd).toFixed(6));
      const feeSource = feeCalc.boundedFeeEgp;

      transaction.update(smsRef, {
        processingStatus: "matched",
        matchedOrderId: rechargeId,
        adminNote: String(adminNote || "Manual Confirm").slice(0, 500),
        processedAt: FieldValue.serverTimestamp(),
        processedBy: admin.userId,
      });
      transaction.update(rechargeRef, {
        status: "verified",
        paymentStatus: "verified",
        smsId,
        verifiedAt: FieldValue.serverTimestamp(),
        creditedUsd,
        grossDepositEgp: Number(grossEgp.toFixed(2)),
        depositFeeEgp: Number((grossEgp - netEgp).toFixed(2)),
        netDepositEgp: Number(netEgp.toFixed(2)),
        ...(sourceCurrency === "SAR"
          ? { grossDepositSar: sourceAmount, depositFeeSar: feeSource, processingCostSar: 0, depositProfitSar: feeSource }
          : { processingCostEgp: 0, depositProfitEgp: feeSource }),
        financialSchemaVersion: 2,
      });
      transaction.update(userRef, {
        balance: balanceAfter,
        "balances.USD": balanceAfter,
        financialSchemaVersion: 2,
      });
      transaction.create(adminDb.collection("wallet_transactions").doc(), {
        userId: data.userId,
        currency: "USD",
        amount: creditedUsd,
        balanceBefore,
        balanceAfter,
        type: "deposit",
        referenceId: rechargeId,
        referenceType: "recharge",
        rechargeId,
        description: `إيداع مؤكد يدويًا عبر ${data.method || "محفظة"}`,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: admin.userId,
        immutable: true,
        schemaVersion: 2,
      });
      transaction.create(
        adminDb.collection("financial_ledger").doc(),
        ledgerRecord({
          type: "deposit",
          currency: sourceCurrency,
          amount: sourceAmount,
          direction: "credit",
          account: `payment_method:${data.method || "unknown"}`,
          counterpartyAccount: "customer_service_wallets",
          userId: data.userId,
          referenceId: rechargeId,
          referenceType: "recharge",
          description: `تأكيد يدوي لإيداع #${String(rechargeId).slice(0, 8)}`,
          createdBy: admin.userId,
          metadata: { creditedUsd, usdRate, fee: feeSource, smsId },
        }),
      );
    });
    return NextResponse.json({ success: true, status: "matched_manually" });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Manual match error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
