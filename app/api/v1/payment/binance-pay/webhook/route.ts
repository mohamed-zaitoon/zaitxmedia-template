import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  amountsMatchUsd,
  mapBinanceStatusToInternal,
  verifyBinanceWebhookSignature,
} from "@/lib/payments/binance-pay";

export async function GET() {
  return NextResponse.json(
    { error: "GET method is not allowed for payment operations. Please use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request) {
  const timestamp = request.headers.get("BinancePay-Timestamp") || request.headers.get("x-binance-timestamp");
  const nonce = request.headers.get("BinancePay-Nonce") || request.headers.get("x-binance-nonce");
  const signature = request.headers.get("BinancePay-Signature") || request.headers.get("x-binance-signature");

  const rawBody = await request.text();
  const secret = process.env.BINANCE_PAY_SECRET;

  if (secret) {
    const isValid = await verifyBinanceWebhookSignature(secret, timestamp, nonce, rawBody, signature);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Binance Pay signature" },
        { status: 401 }
      );
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const data = payload.data || payload;
  const merchantTradeNo = String(data.merchantTradeNo || payload.merchantTradeNo || "").trim();
  const binanceOrderId = String(data.binanceOrderId || data.bizId || payload.binanceOrderId || "").trim();
  const receivedAmount = Number(data.totalFee ?? data.orderAmount ?? payload.totalFee);
  const receivedCurrency = String(data.currency || payload.currency || "USD").toUpperCase();
  const binanceStatus = String(data.bizStatus || data.status || payload.bizStatus || payload.status || "");

  if (!merchantTradeNo) {
    return NextResponse.json(
      { error: "merchantTradeNo missing from webhook payload" },
      { status: 400 }
    );
  }

  const snapshot = await adminDb
    .collection("recharges")
    .where("merchantTradeNo", "==", merchantTradeNo)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return NextResponse.json(
      { error: "Deposit request not found" },
      { status: 404 }
    );
  }

  const rechargeDoc = snapshot.docs[0];
  const rechargeData = rechargeDoc.data();

  // IDEMPOTENCY: If already confirmed, return success without crediting again
  if (rechargeData.status === "confirmed" || rechargeData.status === "approved" || rechargeData.paymentStatus === "confirmed") {
    return NextResponse.json({
      success: true,
      message: "Duplicate webhook ignored - deposit already confirmed",
      idempotency: true,
    });
  }

  const mappedStatus = mapBinanceStatusToInternal(binanceStatus);

  if (mappedStatus === "confirmed") {
    // 1. Verify Currency === USD
    if (receivedCurrency !== "USD") {
      await rechargeDoc.ref.update({
        status: "manual_review",
        paymentStatus: "manual_review",
        reviewReason: "CURRENCY_MISMATCH",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "manual_review", reason: "CURRENCY_MISMATCH" });
    }

    // 2. Verify Exact USD Amount match in integer cents
    const expectedAmountUsd = Number(rechargeData.amountUsd || rechargeData.amount);
    if (!amountsMatchUsd(expectedAmountUsd, receivedAmount)) {
      await rechargeDoc.ref.update({
        status: "manual_review",
        paymentStatus: "manual_review",
        reviewReason: `AMOUNT_MISMATCH: Expected $${expectedAmountUsd}, received $${receivedAmount}`,
        receivedAmountUsd: receivedAmount,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "manual_review", reason: "AMOUNT_MISMATCH" });
    }

    // 3. Confirm deposit & credit user balance atomically in Firestore
    const userId = rechargeData.userId;
    const profileRef = adminDb.collection("profiles").doc(userId);

    await adminDb.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) throw new Error("USER_NOT_FOUND");

      const currentBalanceUsd = Number(profileDoc.data()?.balance) || 0;
      const newBalanceUsd = currentBalanceUsd + expectedAmountUsd;

      transaction.update(rechargeDoc.ref, {
        status: "confirmed",
        paymentStatus: "confirmed",
        binanceStatus: binanceStatus || "PAID",
        binanceOrderId: binanceOrderId || rechargeData.binanceOrderId,
        binanceTransactionId: data.transactTime ? String(data.transactTime) : binanceOrderId,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(profileRef, {
        balance: Number(newBalanceUsd.toFixed(6)),
        updated_at: FieldValue.serverTimestamp(),
      });

      const ledgerRef = adminDb.collection("wallet_transactions").doc();
      transaction.set(ledgerRef, {
        userId,
        type: "deposit",
        referenceId: rechargeDoc.id,
        referenceType: "recharge",
        rechargeId: rechargeDoc.id,
        amountUsd: expectedAmountUsd,
        currency: "USD",
        paymentMethod: "binance_pay",
        description: `إيداع إلكتروني مؤكد عبر Binance Pay ($${expectedAmountUsd} USD)`,
        previousBalanceUsd: currentBalanceUsd,
        newBalanceUsd,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, status: "confirmed", amountUsd: expectedAmountUsd });
  } else if (mappedStatus === "failed" || mappedStatus === "expired") {
    await rechargeDoc.ref.update({
      status: mappedStatus,
      paymentStatus: mappedStatus,
      binanceStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, status: mappedStatus });
  }

  return NextResponse.json({ success: true, status: rechargeData.status });
}
