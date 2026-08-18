import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { calculateBoundedDepositFee } from "@/lib/deposit-fees";
import { FieldValue } from "firebase-admin/firestore";
import { getMaxWalletBalanceUsd } from "@/lib/money/wallet";
import { ledgerRecord } from "@/lib/financial/model";

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await adminDb
      .collection("recharges")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const recharges = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));

    return NextResponse.json({ success: true, recharges });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load admin recharges", error);
    return NextResponse.json(
      { success: false, error: "Unable to load recharges" },
      { status: 500 },
    );
  }
}

const REVIEWABLE_STATUSES = new Set([
  "pending",
  "manual_review",
  "awaiting_payment",
  "matching",
  "expired",
]);

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const rechargeId = String(body.id || "").trim();
    const action = body.action === "approve" || body.action === "reject"
      ? body.action
      : null;
    if (!rechargeId || !action) {
      return NextResponse.json(
        { success: false, error: "بيانات الإجراء غير مكتملة" },
        { status: 400 },
      );
    }

    const rechargeRef = adminDb.collection("recharges").doc(rechargeId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const rechargeSnapshot = await transaction.get(rechargeRef);
      if (!rechargeSnapshot.exists) {
        throw new Error("RECHARGE_NOT_FOUND");
      }
      const recharge = rechargeSnapshot.data()!;
      const currentStatus = String(recharge.status || "");

      if (action === "reject") {
        if (currentStatus === "rejected") {
          return { status: "rejected", alreadyProcessed: true };
        }
        if (currentStatus === "approved" || currentStatus === "verified") {
          throw new Error("RECHARGE_ALREADY_CREDITED");
        }
        if (!REVIEWABLE_STATUSES.has(currentStatus)) {
          throw new Error("RECHARGE_NOT_REVIEWABLE");
        }
        transaction.update(rechargeRef, {
          status: "rejected",
          paymentStatus: "rejected",
          rejectedAt: FieldValue.serverTimestamp(),
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: admin.email,
        });
        return { status: "rejected", alreadyProcessed: false };
      }

      if (currentStatus === "approved" || currentStatus === "verified") {
        return { status: currentStatus, alreadyProcessed: true };
      }
      if (!REVIEWABLE_STATUSES.has(currentStatus)) {
        throw new Error("RECHARGE_NOT_REVIEWABLE");
      }

      const userId = String(recharge.userId || "");
      if (!userId) throw new Error("PROFILE_NOT_FOUND");
      const profileRef = adminDb.collection("profiles").doc(userId);
      const pricingRef = adminDb.collection("settings").doc("pricing");
      const [profileSnapshot, pricingSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(pricingRef),
      ]);
      if (!profileSnapshot.exists) throw new Error("PROFILE_NOT_FOUND");

      const usdRate = Number(
        recharge.lockedUsdEgpRate
        || recharge.lockedCustomerExchangeRateEgp
        || pricingSnapshot.data()?.usd_rate
        || pricingSnapshot.data()?.tiktok_usd_rate
        || 50,
      );
      const grossDepositEgp = Number(
        recharge.grossDepositEgp
        ?? (recharge.currency === "SAR"
          ? Number(recharge.amount) * Number(recharge.lockedSarEgpRate || 12.75)
          : recharge.amount),
      );
      const pricingData = pricingSnapshot.data() || {};
      const feePercent = Number(
        recharge.feePercent
        ?? recharge.depositFeePercent
        ?? pricingData.deposit_fee_percent
        ?? 0.1,
      );
      const feeMinEgp = Number(pricingData.deposit_fee_min_egp ?? 0.5);
      const feeMaxEgp = Number(pricingData.deposit_fee_max_egp ?? 20);

      const feeCalc = calculateBoundedDepositFee(grossDepositEgp, {
        feePercent,
        minEgp: feeMinEgp,
        maxEgp: feeMaxEgp,
      });

      const netDepositEgp = Number(recharge.netDepositEgp ?? feeCalc.netEgp);
      const feeDepositEgp = grossDepositEgp - netDepositEgp;
      const creditedUsd = Number(
        recharge.estimatedCreditUsd
        ?? recharge.creditedUsd
        ?? netDepositEgp / usdRate,
      );
      if (
        !Number.isFinite(creditedUsd)
        || creditedUsd <= 0
        || !Number.isFinite(usdRate)
        || usdRate <= 0
      ) {
        throw new Error("INVALID_RECHARGE_AMOUNT");
      }

      const currentBalance = Number(profileSnapshot.data()?.balance) || 0;
      const balanceAfter = Number((currentBalance + creditedUsd).toFixed(6));
      const maxWalletBalanceUsd = getMaxWalletBalanceUsd(pricingData);
      if (balanceAfter > maxWalletBalanceUsd + 0.01) {
        throw new Error("WALLET_LIMIT_EXCEEDED");
      }

      transaction.update(profileRef, {
        balance: balanceAfter,
        "balances.USD": balanceAfter,
        financialSchemaVersion: 2,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const sourceCurrency = recharge.currency === "SAR" ? "SAR" : "EGP";
      const sourceGross = sourceCurrency === "SAR"
        ? Number(recharge.amount)
        : grossDepositEgp;
      const sourceFee = sourceGross * feePercent / 100;
      transaction.update(rechargeRef, {
        status: "approved",
        paymentStatus: "verified",
        approvedAt: FieldValue.serverTimestamp(),
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: admin.email,
        grossDepositEgp: Number(grossDepositEgp.toFixed(2)),
        depositFeePercent: feePercent,
        depositFeeEgp: Number((grossDepositEgp - netDepositEgp).toFixed(2)),
        ...(sourceCurrency === "SAR"
          ? {
              grossDepositSar: Number(sourceGross.toFixed(2)),
              depositFeeSar: Number(sourceFee.toFixed(2)),
              processingCostSar: 0,
              depositProfitSar: Number(sourceFee.toFixed(2)),
            }
          : {
              processingCostEgp: 0,
              depositProfitEgp: Number((grossDepositEgp - netDepositEgp).toFixed(2)),
            }),
        netDepositEgp: Number(netDepositEgp.toFixed(2)),
        lockedCustomerExchangeRateEgp: usdRate,
        creditedUsd: Number(creditedUsd.toFixed(6)),
        financialSchemaVersion: 2,
      });
      transaction.create(adminDb.collection("wallet_transactions").doc(), {
        userId,
        currency: "USD",
        amount: Number(creditedUsd.toFixed(6)),
        balanceBefore: currentBalance,
        balanceAfter,
        type: "deposit",
        referenceId: rechargeId,
        referenceType: "recharge",
        rechargeId,
        description: `إيداع معتمد عبر ${recharge.method || "محفظة"}`,
        immutable: true,
        schemaVersion: 2,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: admin.userId,
      });
      transaction.create(
        adminDb.collection("financial_ledger").doc(),
        ledgerRecord({
          type: "deposit",
          currency: sourceCurrency,
          amount: sourceGross,
          direction: "credit",
          account: `payment_method:${recharge.method || "unknown"}`,
          counterpartyAccount: "customer_service_wallets",
          userId,
          referenceId: rechargeId,
          referenceType: "recharge",
          description: `إيداع العميل عبر ${recharge.method || "محفظة"}`,
          createdBy: admin.userId,
          metadata: {
            fee: Number(sourceFee.toFixed(2)),
            creditedUsd: Number(creditedUsd.toFixed(6)),
            lockedUsdRate: usdRate,
          },
        }),
      );
      if (sourceFee > 0) {
        transaction.create(
          adminDb.collection("financial_ledger").doc(),
          ledgerRecord({
            type: "fee",
            currency: sourceCurrency,
            amount: sourceFee,
            direction: "credit",
            account: "deposit_fee_income",
            counterpartyAccount: `payment_method:${recharge.method || "unknown"}`,
            userId,
            referenceId: rechargeId,
            referenceType: "recharge",
            description: `رسوم الإيداع #${rechargeId.slice(0, 8)}`,
            createdBy: admin.userId,
          }),
        );
      }
      const methodKey = String(recharge.method || "unknown")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 100);
      transaction.set(
        adminDb.collection("financial_profit_dimensions").doc(`method_${methodKey}_${sourceCurrency}`),
        {
          dimension: "payment_method",
          key: String(recharge.method || "unknown"),
          label: String(recharge.method || "وسيلة غير معروفة"),
          currency: sourceCurrency,
          profit: FieldValue.increment(sourceFee),
          depositCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        status: "approved",
        alreadyProcessed: false,
        userId,
        creditedUsd,
        amount: recharge.amount,
        currency: recharge.currency || "EGP",
      };
    });

    if (action === "approve" && !result.alreadyProcessed && "userId" in result) {
      await adminDb.collection("notifications").add({
        user_id: result.userId,
        title: "إيداع ناجح",
        body: `تمت إضافة إيداعك بقيمة ${result.amount} ${result.currency} إلى رصيدك بنجاح.`,
        type: "recharge_completed",
        created_at: new Date().toISOString(),
      }).catch((error) => {
        console.error("Failed to create recharge notification", error);
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    const message = error instanceof Error ? error.message : "";
    const knownErrors: Record<string, [number, string]> = {
      RECHARGE_NOT_FOUND: [404, "طلب الإيداع غير موجود"],
      RECHARGE_ALREADY_CREDITED: [409, "تمت إضافة هذا الإيداع بالفعل"],
      RECHARGE_NOT_REVIEWABLE: [409, "لا يمكن تعديل حالة هذا الإيداع"],
      PROFILE_NOT_FOUND: [404, "حساب المستخدم غير موجود"],
      INVALID_RECHARGE_AMOUNT: [400, "قيمة الإيداع غير صحيحة"],
      WALLET_LIMIT_EXCEEDED: [400, "رصيد العميل سيتجاوز الحد الأقصى وهو مليون جنيه"],
    };
    const known = knownErrors[message];
    if (known) {
      return NextResponse.json(
        { success: false, error: known[1] },
        { status: known[0] },
      );
    }
    console.error("Failed to review recharge", error);
    return NextResponse.json(
      { success: false, error: "تعذر تنفيذ الإجراء على طلب الإيداع" },
      { status: 500 },
    );
  }
}
