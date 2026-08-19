import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function GET() {
  return NextResponse.json(
    { error: "GET method is not allowed for payment operations. Please use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const merchantTradeNo = String(body.merchantTradeNo || body.tradeNo || "").trim();
    const binanceOrderId = String(body.binanceOrderId || body.orderId || "").trim();

    if (!merchantTradeNo && !binanceOrderId) {
      return NextResponse.json(
        { error: "merchantTradeNo or binanceOrderId is required" },
        { status: 400 }
      );
    }

    let snapshot = await adminDb
      .collection("recharges")
      .where("merchantTradeNo", "==", merchantTradeNo || binanceOrderId)
      .limit(1)
      .get();

    if (snapshot.empty && merchantTradeNo) {
      snapshot = await adminDb
        .collection("recharges")
        .where("referenceNumber", "==", merchantTradeNo)
        .limit(1)
        .get();
    }

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Binance Pay deposit request not found" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      success: true,
      data: {
        depositId: doc.id,
        merchantTradeNo: data.merchantTradeNo || data.referenceNumber,
        binanceOrderId: data.binanceOrderId || data.merchantTradeNo,
        status: data.status || data.paymentStatus,
        amountUsd: data.amountUsd || data.amount,
        currency: "USD",
        createdAt: data.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to query Binance Pay deposit:", error);
    return NextResponse.json(
      { error: "Unable to query Binance Pay status" },
      { status: 500 }
    );
  }
}
