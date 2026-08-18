import { timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { calculateDepositCredit, getMaxWalletBalanceUsd } from "@/lib/money/wallet";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import {
  paymentSmsIsNewer,
  paymentSmsMatchesOrder,
  type ParsedPaymentSms,
} from "@/lib/payments/sms";

function authorized(request: Request): boolean {
  const configured = process.env.INTERNAL_API_SECRET;
  const supplied = request.headers.get("x-internal-secret");
  if (!configured || !supplied) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { smsId, retry = false } = await request.json();
    if (!smsId || typeof smsId !== "string") {
      return NextResponse.json({ success: false, error: "Missing smsId" }, { status: 400 });
    }

    const smsRef = adminDb.collection("payment_sms").doc(smsId);
    const smsSnap = await smsRef.get();
    if (!smsSnap.exists) {
      return NextResponse.json({ success: false, error: "SMS not found" }, { status: 404 });
    }
    const smsData = smsSnap.data()!;
    const retryable =
      retry === true && smsData.processingStatus === "manual_review";
    if (smsData.processingStatus !== "pending" && !retryable) {
      return NextResponse.json({ success: true, status: smsData.processingStatus });
    }

    const parsed: ParsedPaymentSms = {
      provider:
        smsData.classification === "vfcash"
          ? "vodafone"
          : smsData.classification,
      amountMinor: smsData.extractedAmountPiasters,
      payerPhone: smsData.extractedPhone ?? null,
      payerName: smsData.extractedSenderName ?? null,
      reference: smsData.extractedTransactionReference ?? null,
      confidence: smsData.confidence ?? 0,
    };

    const samePayerQuery = parsed.payerPhone
      ? adminDb.collection("payment_sms").where("extractedPhone", "==", parsed.payerPhone)
      : null;
    if (samePayerQuery) {
      const samePayerMessages = await samePayerQuery.get();
      const newerMessage = samePayerMessages.docs.find((candidate) =>
        candidate.id !== smsId && paymentSmsIsNewer(candidate.data(), smsData),
      );
      if (newerMessage) {
        await smsRef.update({
          processingStatus: "ignored_stale",
          failureReason: "A newer SMS exists for the same payer phone",
          supersededBySmsId: newerMessage.id,
          processedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({
          success: true,
          status: "ignored_stale",
          reason: "newer_sms_for_same_payer",
        });
      }
    }

    const orderQuery = await adminDb
      .collection("orders")
      .where("paymentStatus", "==", "verifying")
      .where("expectedPaymentAmountMinor", "==", parsed.amountMinor)
      .limit(25)
      .get();

    const orderCandidates = orderQuery.docs.filter((candidate) =>
      paymentSmsMatchesOrder(parsed, candidate.data()),
    );
    const rechargeQuery = await adminDb
      .collection("recharges")
      .where("paymentStatus", "==", "verifying")
      .where("expectedPaymentAmountMinor", "==", parsed.amountMinor)
      .limit(25)
      .get();
    const rechargeCandidates = rechargeQuery.docs.filter((candidate) =>
      paymentSmsMatchesOrder(parsed, candidate.data()),
    );
    const candidates = [
      ...orderCandidates.map((doc) => ({ doc, kind: "order" as const })),
      ...rechargeCandidates.map((doc) => ({ doc, kind: "recharge" as const })),
    ];

    if (candidates.length !== 1) {
      await smsRef.update({
        processingStatus: "manual_review",
        failureReason:
          candidates.length === 0
            ? "No exact order match"
            : "Multiple exact order matches",
        processedAt: FieldValue.serverTimestamp(),
      });

      // Send Instant Push Notification to Admin for Manual Review
      try {
        const { sendOneSignalPush } = await import("@/app/utils/onesignal");
        const amountDisplay = (((parsed.amountMinor ?? smsData.extractedAmountPiasters ?? 0) / 100)).toFixed(2);
        const phoneDisplay = smsData.senderPhone || parsed.payerPhone || "رقم مجهول";
        void sendOneSignalPush(
          "admin",
          "⚠️ إيداع يحتاج مراجعة يدويّة",
          `وصلت رسالة بمبلغ ${amountDisplay} ج.م من ${phoneDisplay} ولم تُطابق تلقائياً.`,
          { url: "https://admin.zaitxmedia.com" }
        ).catch(() => {});
      } catch (err) {}

      return NextResponse.json({
        success: true,
        status: candidates.length === 0 ? "no_match" : "multiple_matches",
      });
    }

    const matched = candidates[0];
    const targetRef = matched.doc.ref;
    const targetId = matched.doc.id;

    const pricingRef = adminDb.collection("settings").doc("pricing");
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const [freshSms, freshTarget, samePayerMessages, pricingSnap] = await Promise.all([
        transaction.get(smsRef),
        transaction.get(targetRef),
        samePayerQuery ? transaction.get(samePayerQuery) : Promise.resolve(null),
        transaction.get(pricingRef),
      ]);
      const freshSmsStatus = freshSms.data()?.processingStatus;
      if (
        freshSmsStatus !== "pending" &&
        !(retry === true && freshSmsStatus === "manual_review")
      ) {
        throw new Error("SMS_ALREADY_PROCESSED");
      }
      if (!freshTarget.exists || !paymentSmsMatchesOrder(parsed, freshTarget.data()!)) {
        throw new Error("TARGET_NO_LONGER_MATCHES");
      }
      const freshSmsData = freshSms.data()!;
      const newerMessage = samePayerMessages?.docs.find((candidate) =>
        candidate.id !== smsId && paymentSmsIsNewer(candidate.data(), freshSmsData),
      );
      if (newerMessage) {
        transaction.update(smsRef, {
          processingStatus: "ignored_stale",
          failureReason: "A newer SMS exists for the same payer phone",
          supersededBySmsId: newerMessage.id,
          processedAt: FieldValue.serverTimestamp(),
        });
        return "ignored_stale" as const;
      }
      const targetData = freshTarget.data()!;

      let profileRef: FirebaseFirestore.DocumentReference | null = null;
      let walletTransactionRef: FirebaseFirestore.DocumentReference | null = null;
      let balanceBeforeUsd = 0;
      let balanceAfterUsd = 0;
      let creditUsd = 0;
      if (matched.kind === "recharge") {
        profileRef = adminDb.collection("profiles").doc(targetData.userId);
        walletTransactionRef = adminDb.collection("wallet_transactions").doc();
        const profile = await transaction.get(profileRef);
        if (!profile.exists) throw new Error("PROFILE_NOT_FOUND");
        balanceBeforeUsd = Number(profile.data()?.balance) || 0;
        creditUsd = Number(targetData.estimatedCreditUsd) || 0;
        balanceAfterUsd = Number((balanceBeforeUsd + creditUsd).toFixed(6));
        const lockedUsdRate = Number(targetData.lockedUsdEgpRate) || 50;
        const maxWalletBalanceUsd = getMaxWalletBalanceUsd(pricingSnap.data());
        if (balanceAfterUsd > maxWalletBalanceUsd + 0.01) {
          throw new Error("MAX_WALLET_BALANCE_EXCEEDED");
        }
      }

      transaction.update(smsRef, {
        processingStatus: "matched",
        matchedOrderId: targetId,
        matchedType: matched.kind,
        processedAt: FieldValue.serverTimestamp(),
      });
      if (matched.kind === "recharge") {
        transaction.update(targetRef, {
          paymentStatus: "paid",
          status: "verified",
          creditedUsd: creditUsd,
          verifiedAt: FieldValue.serverTimestamp(),
          smsId,
        });
        transaction.update(profileRef!, {
          balance: balanceAfterUsd,
          "balances.USD": balanceAfterUsd,
          financialSchemaVersion: 2,
        });
        transaction.create(walletTransactionRef!, {
          userId: targetData.userId,
          rechargeId: targetId,
          currency: "USD",
          amount: creditUsd,
          balanceBefore: balanceBeforeUsd,
          balanceAfter: balanceAfterUsd,
          type: "deposit",
          referenceId: targetId,
          referenceType: "recharge",
          amountUsd: creditUsd,
          grossAmount: targetData.amount,
          grossCurrency: targetData.currency,
          feePercent: targetData.feePercent,
          balanceBeforeUsd,
          balanceAfterUsd,
          description: `إيداع عبر ${targetData.method}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
        });
        const sourceCurrency = targetData.currency === "SAR" ? "SAR" : "EGP";
        const sourceAmount = Number(targetData.amount) || 0;
        const sourceFee = sourceAmount * (Number(targetData.feePercent) || 0) / 100;
        transaction.update(targetRef, {
          financialSchemaVersion: 2,
          ...(sourceCurrency === "SAR"
            ? {
                grossDepositSar: Number(sourceAmount.toFixed(2)),
                depositFeeSar: Number(sourceFee.toFixed(2)),
                processingCostSar: 0,
                depositProfitSar: Number(sourceFee.toFixed(2)),
              }
            : {
                grossDepositEgp: Number(sourceAmount.toFixed(2)),
                depositFeeEgp: Number(sourceFee.toFixed(2)),
                processingCostEgp: 0,
                depositProfitEgp: Number(sourceFee.toFixed(2)),
              }),
        });
        transaction.create(adminDb.collection("financial_ledger").doc(), {
          type: "deposit",
          currency: sourceCurrency,
          amount: sourceAmount,
          direction: "credit",
          account: `payment_method:${targetData.method || "unknown"}`,
          counterpartyAccount: "customer_service_wallets",
          userId: targetData.userId,
          referenceId: targetId,
          referenceType: "recharge",
          description: `إيداع تلقائي عبر ${targetData.method}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        const fulfillmentChoice = targetData.options?.tiktokChoice;
        const requiresAdminDelivery =
          fulfillmentChoice === "link" || fulfillmentChoice === "qr";
        transaction.update(targetRef, {
          paymentStatus: "paid",
          status: requiresAdminDelivery ? "pending_action" : "pending",
          fulfillmentStatus: requiresAdminDelivery ? "pending_action" : "pending",
          paidAt: FieldValue.serverTimestamp(),
          paymentConfirmationSource: "sms_webhook",
          providerTransactionReference: parsed.reference || smsId,
          smsId,
        });
      }

      const notification = adminDb.collection("notifications").doc();
      transaction.create(notification, {
        id: notification.id,
        user_id: matched.kind === "recharge" ? targetData.userId : targetData.user_id,
        title: matched.kind === "recharge" ? "تم شحن المحفظة" : "تم استلام الدفع",
        body: matched.kind === "recharge"
          ? `تمت إضافة $${creditUsd.toFixed(2)} إلى رصيدك.`
          : `تم تأكيد دفع الطلب #${targetId.slice(0, 8)} بنجاح وجارٍ تنفيذه.`,
        type: "order_status",
        created_at: new Date().toISOString(),
      });
      return "matched" as const;
    });

    if (transactionResult === "ignored_stale") {
      return NextResponse.json({
        success: true,
        status: "ignored_stale",
        reason: "newer_sms_for_same_payer",
      });
    }

    try {
      const { sendOneSignalPush } = await import("@/app/utils/onesignal");
      const targetData = matched.doc.data();
      if (matched.kind === "recharge") {
        await sendOneSignalPush(
          targetData.userId,
          "تم شحن محفظتك ✅",
          `تمت إضافة $${Number(targetData.estimatedCreditUsd || 0).toFixed(2)} إلى رصيدك.`,
          {
            url: "https://zaitxmedia.com/account",
            data: { type: "recharge_verified", rechargeId: targetId },
          },
        );
      } else {
        await sendOneSignalPush(
          "admin",
          "تم تأكيد دفع طلب جديد 💳",
          `${targetData.service_name || "طلب"} — #${targetId.slice(0, 8)}`,
          {
            url: "https://admin.zaitxmedia.com/orders",
            data: { type: "order_paid", orderId: targetId },
          },
        );
        await sendOneSignalPush(
          targetData.user_id,
          "تم استلام الدفع ✅",
          `تم تأكيد دفع طلبك #${targetId.slice(0, 8)} وجارٍ تنفيذه.`,
          {
            url: "https://zaitxmedia.com/orders",
            data: { type: "order_paid", orderId: targetId },
          },
        );
      }
    } catch (pushError) {
      console.error("Failed to send payment push", pushError);
    }

    return NextResponse.json({
      success: true,
      status: "matched",
      matchedType: matched.kind,
      targetId,
    });
  } catch (error) {
    console.error("SMS match error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
