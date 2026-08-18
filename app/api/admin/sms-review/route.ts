import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getMaxWalletBalanceUsd } from "@/lib/money/wallet";

// GET: Fetch SMS messages that need manual review
export async function GET() {
  try {
    await requireAdmin();

    const [smsSnapshot, pendingRechargesSnapshot] = await Promise.all([
      adminDb
        .collection("payment_sms")
        .where("processingStatus", "in", ["manual_review", "pending"])
        .orderBy("createdAt", "desc")
        .limit(100)
        .get(),
      adminDb
        .collection("recharges")
        .where("paymentStatus", "in", ["verifying", "manual_review", "expired"])
        .orderBy("createdAt", "desc")
        .limit(100)
        .get(),
    ]);

    const smsList = smsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() ?? doc.data().createdAt,
      processedAt: doc.data().processedAt?.toDate?.()?.toISOString?.() ?? doc.data().processedAt,
    }));

    const pendingRecharges = pendingRechargesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() ?? doc.data().createdAt,
    }));

    return NextResponse.json({ success: true, smsList, pendingRecharges });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load SMS manual review list", error);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل بيانات الرسائل" },
      { status: 500 },
    );
  }
}

// POST: Manually link an SMS to a recharge and approve it
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const smsId = String(body.smsId || "").trim();
    const rechargeId = String(body.rechargeId || "").trim();
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "بيانات الإجراء غير مكتملة" },
        { status: 400 },
      );
    }

    if (action !== "approve_direct" && action !== "reject_direct" && !smsId) {
      return NextResponse.json(
        { success: false, error: "بيانات الرسالة غير مكتملة" },
        { status: 400 },
      );
    }

    // Action: ignore - mark SMS as ignored
    if (action === "ignore") {
      const smsRef = adminDb.collection("payment_sms").doc(smsId);
      await smsRef.update({
        processingStatus: "ignored_admin",
        failureReason: "تم تجاهله يدوياً من قبل الأدمن",
        reviewedBy: admin.email,
        reviewedAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "ignored" });
    }

    // Action: link_and_approve - link SMS to a recharge and credit user
    if (action === "link_and_approve") {
      if (!rechargeId) {
        return NextResponse.json(
          { success: false, error: "يجب اختيار طلب شحن لربط الرسالة به" },
          { status: 400 },
        );
      }

      const smsRef = adminDb.collection("payment_sms").doc(smsId);
      const rechargeRef = adminDb.collection("recharges").doc(rechargeId);

      const result = await adminDb.runTransaction(async (transaction) => {
        const [smsSnap, rechargeSnap] = await Promise.all([
          transaction.get(smsRef),
          transaction.get(rechargeRef),
        ]);

        if (!smsSnap.exists) throw new Error("SMS_NOT_FOUND");
        if (!rechargeSnap.exists) throw new Error("RECHARGE_NOT_FOUND");

        const smsData = smsSnap.data()!;
        const recharge = rechargeSnap.data()!;

        const currentSmsStatus = smsData.processingStatus;
        if (currentSmsStatus === "matched" || currentSmsStatus === "ignored_admin") {
          throw new Error("SMS_ALREADY_PROCESSED");
        }

        const currentRechargeStatus = String(recharge.status || "");
        if (currentRechargeStatus === "approved" || currentRechargeStatus === "verified") {
          throw new Error("RECHARGE_ALREADY_CREDITED");
        }

        const userId = String(recharge.userId || "");
        if (!userId) throw new Error("PROFILE_NOT_FOUND");

        const profileRef = adminDb.collection("profiles").doc(userId);
        const pricingRef = adminDb.collection("settings").doc("pricing");
        const [profileSnap, pricingSnap] = await Promise.all([
          transaction.get(profileRef),
          transaction.get(pricingRef),
        ]);
        if (!profileSnap.exists) throw new Error("PROFILE_NOT_FOUND");

        const usdRate = Number(
          recharge.lockedUsdEgpRate ||
          recharge.lockedCustomerExchangeRateEgp ||
          pricingSnap.data()?.usd_rate ||
          50,
        );
        const grossDepositEgp = Number(
          recharge.grossDepositEgp ??
          (recharge.currency === "SAR"
            ? Number(recharge.amount) * Number(recharge.lockedSarEgpRate || 12.75)
            : recharge.amount),
        );
        const feePercent = Number(
          recharge.feePercent ??
          recharge.depositFeePercent ??
          (recharge.method === "instapay" ? 0.75 : 0.5),
        );
        const netDepositEgp = Number(
          recharge.netDepositEgp ?? grossDepositEgp * (1 - feePercent / 100),
        );
        const creditedUsd = Number(
          recharge.estimatedCreditUsd ?? recharge.creditedUsd ?? netDepositEgp / usdRate,
        );

        if (!Number.isFinite(creditedUsd) || creditedUsd <= 0) {
          throw new Error("INVALID_RECHARGE_AMOUNT");
        }

        const currentBalance = Number(profileSnap.data()?.balance) || 0;
        const balanceAfter = Number((currentBalance + creditedUsd).toFixed(6));

        const maxWalletBalanceUsd = getMaxWalletBalanceUsd(pricingSnap.data());
        if (balanceAfter > maxWalletBalanceUsd + 0.01) {
          throw new Error("WALLET_LIMIT_EXCEEDED");
        }

        // Update SMS status
        transaction.update(smsRef, {
          processingStatus: "matched",
          matchedOrderId: rechargeId,
          matchedType: "recharge",
          matchedManually: true,
          reviewedBy: admin.email,
          reviewedAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
        });

        // Update recharge status
        transaction.update(rechargeRef, {
          status: "approved",
          paymentStatus: "verified",
          approvedAt: FieldValue.serverTimestamp(),
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: admin.email,
          smsMatchedManually: true,
          smsId,
          grossDepositEgp: Number(grossDepositEgp.toFixed(2)),
          depositFeePercent: feePercent,
          depositFeeEgp: Number((grossDepositEgp - netDepositEgp).toFixed(2)),
          netDepositEgp: Number(netDepositEgp.toFixed(2)),
          creditedUsd: Number(creditedUsd.toFixed(6)),
          financialSchemaVersion: 2,
        });

        // Update profile balance
        transaction.update(profileRef, {
          balance: balanceAfter,
          "balances.USD": balanceAfter,
          financialSchemaVersion: 2,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Create wallet transaction record
        const walletTxRef = adminDb.collection("wallet_transactions").doc();
        transaction.create(walletTxRef, {
          userId,
          currency: "USD",
          amount: Number(creditedUsd.toFixed(6)),
          balanceBefore: currentBalance,
          balanceAfter,
          type: "deposit",
          referenceId: rechargeId,
          referenceType: "recharge",
          rechargeId,
          smsId,
          description: `إيداع يدوي (SMS) عبر ${recharge.method || "محفظة"}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: admin.userId,
        });

        return { userId, creditedUsd, amount: recharge.amount, currency: recharge.currency || "EGP" };
      });

      // Send notification to user
      try {
        await adminDb.collection("notifications").add({
          user_id: result.userId,
          title: "تم تأكيد الإيداع ✅",
          body: `تم تأكيد إيداعك بقيمة ${result.amount} ${result.currency} يدوياً من قِبل الإدارة وإضافته لرصيدك.`,
          type: "recharge_completed",
          created_at: new Date().toISOString(),
        });
      } catch (notifyError) {
        console.error("Failed to send notification", notifyError);
      }

      return NextResponse.json({ success: true, status: "approved", ...result });
    }

    // Action: approve_direct - Approve a pending recharge directly without SMS (for bank transfers and receipt proofs)
    if (action === "approve_direct") {
      if (!rechargeId) {
        return NextResponse.json({ success: false, error: "يجب اختيار طلب شحن للموافقة عليه" }, { status: 400 });
      }

      const rechargeRef = adminDb.collection("recharges").doc(rechargeId);

      const result = await adminDb.runTransaction(async (transaction) => {
        const rechargeSnap = await transaction.get(rechargeRef);
        if (!rechargeSnap.exists) throw new Error("RECHARGE_NOT_FOUND");
        const recharge = rechargeSnap.data()!;

        const currentRechargeStatus = String(recharge.status || "");
        if (currentRechargeStatus === "approved" || currentRechargeStatus === "verified") {
          throw new Error("RECHARGE_ALREADY_CREDITED");
        }

        const userId = String(recharge.userId || "");
        if (!userId) throw new Error("PROFILE_NOT_FOUND");

        const profileRef = adminDb.collection("profiles").doc(userId);
        const pricingRef = adminDb.collection("settings").doc("pricing");
        const [profileSnap, pricingSnap] = await Promise.all([
          transaction.get(profileRef),
          transaction.get(pricingRef),
        ]);
        if (!profileSnap.exists) throw new Error("PROFILE_NOT_FOUND");

        const usdRate = Number(
          recharge.lockedUsdEgpRate || pricingSnap.data()?.usd_rate || pricingSnap.data()?.tiktok_usd_rate || 50,
        );

        const customConfirmedAmount = Number(body.confirmedAmountEgp);
        const grossDepositEgp = Number.isFinite(customConfirmedAmount) && customConfirmedAmount > 0
          ? customConfirmedAmount
          : Number(
            recharge.grossDepositEgp ??
            (recharge.currency === "SAR"
              ? Number(recharge.amount) * Number(recharge.lockedSarEgpRate || 12.75)
              : recharge.amount),
          );

        const feePercent = Number(
          pricingSnap.data()?.deposit_fee_percent ??
          pricingSnap.data()?.depositFeePercent ??
          recharge.feePercent ??
          0.57,
        );

        const depositFeeEgp = Math.ceil(((grossDepositEgp * (feePercent / 100)) - 1e-9) * 100) / 100;
        const netDepositEgp = Math.max(0, grossDepositEgp - depositFeeEgp);
        const creditedUsd = Number((netDepositEgp / usdRate).toFixed(6));

        if (!Number.isFinite(creditedUsd) || creditedUsd <= 0) {
          throw new Error("INVALID_RECHARGE_AMOUNT");
        }

        const currentBalance = Number(profileSnap.data()?.balance) || 0;
        const balanceAfter = Number((currentBalance + creditedUsd).toFixed(6));

        const maxWalletBalanceUsd = getMaxWalletBalanceUsd(pricingSnap.data());
        if (balanceAfter > maxWalletBalanceUsd + 0.01) {
          throw new Error("WALLET_LIMIT_EXCEEDED");
        }

        const approvedAtIso = new Date().toISOString();
        const receiptDeleteAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // Update recharge status
        transaction.update(rechargeRef, {
          status: "approved",
          paymentStatus: "verified",
          approvedAt: FieldValue.serverTimestamp(),
          approved_at: approvedAtIso,
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: admin.email,
          grossDepositEgp: Number(grossDepositEgp.toFixed(2)),
          depositFeePercent: feePercent,
          depositFeeEgp: Number(depositFeeEgp.toFixed(2)),
          netDepositEgp: Number(netDepositEgp.toFixed(2)),
          creditedUsd: Number(creditedUsd.toFixed(6)),
          financialSchemaVersion: 2,
          receipt_delete_at: receiptDeleteAtIso,
          receipt_status: "active",
        });

        // Update profile balance
        transaction.update(profileRef, {
          balance: balanceAfter,
          "balances.USD": balanceAfter,
          financialSchemaVersion: 2,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Create wallet transaction record
        const walletTxRef = adminDb.collection("wallet_transactions").doc();
        transaction.create(walletTxRef, {
          userId,
          currency: "USD",
          amount: Number(creditedUsd.toFixed(6)),
          balanceBefore: currentBalance,
          balanceAfter,
          type: "deposit",
          referenceId: rechargeId,
          referenceType: "recharge",
          rechargeId,
          description: `إيداع يدوي عبر ${recharge.method === "bank" ? "تحويل بنكي" : recharge.method || "محفظة"}`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: admin.userId,
        });

        return { userId, creditedUsd, amount: grossDepositEgp, currency: "EGP" };
      });

      // Send notification to user
      try {
        await adminDb.collection("notifications").add({
          user_id: result.userId,
          title: "تم تأكيد الإيداع ✅",
          body: `تم تأكيد إيداعك بقيمة ${result.amount} ج.م يدوياً من قِبل الإدارة وإضافته لرصيدك.`,
          type: "recharge_completed",
          created_at: new Date().toISOString(),
        });
      } catch (notifyError) {
        console.error("Failed to send notification", notifyError);
      }

      return NextResponse.json({ success: true, status: "approved", ...result });
    }

    // Action: reject_direct - Reject a pending recharge directly
    if (action === "reject_direct") {
      if (!rechargeId) {
        return NextResponse.json({ success: false, error: "يجب اختيار طلب شحن لرفضه" }, { status: 400 });
      }

      const rechargeRef = adminDb.collection("recharges").doc(rechargeId);
      const rechargeSnap = await rechargeRef.get();
      if (!rechargeSnap.exists) {
        return NextResponse.json({ success: false, error: "طلب الشحن غير موجود" }, { status: 404 });
      }

      const recharge = rechargeSnap.data()!;
      const rejectedAtIso = new Date().toISOString();
      const receiptDeleteAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await rechargeRef.update({
        status: "rejected",
        paymentStatus: "rejected",
        rejectionReason: String(body.reason || "تم رفض طلب الإيداع من قِبل الإدارة"),
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: admin.email,
        rejected_at: rejectedAtIso,
        receipt_delete_at: receiptDeleteAtIso,
        receipt_status: "active",
      });

      try {
        await adminDb.collection("notifications").add({
          user_id: recharge.userId,
          title: "تم رفض طلب الإيداع ❌",
          body: `عذراً، تعذر تأكيد طلب الإيداع الخاص بك. يرجى التواصل مع الدعم الفني.`,
          type: "recharge_rejected",
          created_at: new Date().toISOString(),
        });
      } catch (notifyError) {
        console.error("Failed to send rejection notification", notifyError);
      }

      return NextResponse.json({ success: true, status: "rejected" });
    }

    return NextResponse.json({ success: false, error: "إجراء غير معروف" }, { status: 400 });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    const message = error instanceof Error ? error.message : "";
    const knownErrors: Record<string, [number, string]> = {
      SMS_NOT_FOUND: [404, "الرسالة غير موجودة"],
      RECHARGE_NOT_FOUND: [404, "طلب الشحن غير موجود"],
      SMS_ALREADY_PROCESSED: [409, "هذه الرسالة تمت معالجتها مسبقاً"],
      RECHARGE_ALREADY_CREDITED: [409, "تمت إضافة هذا الإيداع بالفعل"],
      PROFILE_NOT_FOUND: [404, "حساب المستخدم غير موجود"],
      INVALID_RECHARGE_AMOUNT: [400, "قيمة الإيداع غير صحيحة"],
      WALLET_LIMIT_EXCEEDED: [400, "رصيد العميل سيتجاوز الحد الأقصى"],
    };
    const known = knownErrors[message];
    if (known) {
      return NextResponse.json({ success: false, error: known[1] }, { status: known[0] });
    }
    console.error("Failed to manually link SMS", error);
    return NextResponse.json(
      { success: false, error: "تعذر تنفيذ الإجراء" },
      { status: 500 },
    );
  }
}
