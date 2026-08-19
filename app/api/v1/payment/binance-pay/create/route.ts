import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const DEFAULT_RECIPIENT_BINANCE_ID = "405960486";

export async function GET() {
  return NextResponse.json(
    { error: "GET method is not allowed for payment operations. Please use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const requestedCurrency = String(body.currency || "USD").toUpperCase().trim();
    if (requestedCurrency !== "USD") {
      return NextResponse.json(
        { error: "Binance Pay operates exclusively in USD currency" },
        { status: 400 }
      );
    }

    const amountUsd = Number(body.amountUsd ?? body.amount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive USD number" },
        { status: 400 }
      );
    }

    if (amountUsd < 1.0) {
      return NextResponse.json(
        { error: "الحد الأدنى للإيداع عبر Binance Pay هو $1.00 USD" },
        { status: 400 }
      );
    }
    if (amountUsd > 10000.0) {
      return NextResponse.json(
        { error: "الحد الأقصى للإيداع عبر Binance Pay هو $10,000.00 USD" },
        { status: 400 }
      );
    }

    const profile = await adminDb.collection("profiles").doc(userId).get();
    if (!profile.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const userBinanceOrderId = String(body.userBinanceOrderId || body.reference || body.binanceOrderId || "").trim();

    const merchantTradeNo = `BP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const recipientBinanceId = process.env.BINANCE_PAY_RECIPIENT_ID || DEFAULT_RECIPIENT_BINANCE_ID;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const rechargeRef = adminDb.collection("recharges").doc();
    const rechargeData = {
      id: rechargeRef.id,
      userId,
      userEmail: profile.data()?.email || "",
      amount: amountUsd,
      amountUsd,
      currency: "USD",
      method: "binance_pay",
      paymentMethod: "binance_pay",
      paymentMethodKey: "binance_pay",
      merchantTradeNo,
      binanceOrderId: merchantTradeNo,
      userBinanceOrderId: userBinanceOrderId || merchantTradeNo,
      recipientBinanceId,
      originalReference: userBinanceOrderId || merchantTradeNo,
      referenceNumber: userBinanceOrderId || merchantTradeNo,
      paymentStatus: "pending",
      status: "pending",
      binanceStatus: "INITIAL",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    };

    await rechargeRef.set(rechargeData);

    return NextResponse.json({
      success: true,
      depositId: rechargeRef.id,
      merchantTradeNo,
      binanceOrderId: merchantTradeNo,
      recipientBinanceId,
      amountUsd,
      currency: "USD",
      status: "pending",
      createdAt,
      expiresAt,
    });
  } catch (error) {
    console.error("Failed to create Binance Pay order:", error);
    return NextResponse.json(
      { error: "تعذر إنشاء طلب الإيداع عبر Binance Pay" },
      { status: 500 }
    );
  }
}
