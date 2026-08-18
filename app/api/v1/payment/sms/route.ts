import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { normalizeForwarderTimestamp, parsePaymentSms } from "@/lib/payments/sms";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "online",
    endpoint: "sms_webhook",
    accepts: "POST",
    serverTime: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, any> = {};

    const rawText = await request.text();

    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(rawText);
      } catch {
        // Fallback to URL search params if JSON parse fails
        const params = new URLSearchParams(rawText);
        for (const [key, value] of params.entries()) {
          body[key] = value;
        }
      }
    } else {
      const params = new URLSearchParams(rawText);
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
    }

    const sender = String(
      body.from ??
      body.sender ??
      body.address ??
      body.phone ??
      body.number ??
      body.origin ??
      ""
    ).trim();

    const message = String(
      body.text ??
      body.message ??
      body.body ??
      body.sms ??
      body.content ??
      ""
    ).trim();

    if (!sender || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Sender and message body are required",
        },
        { status: 400 }
      );
    }

    const parsed = parsePaymentSms(sender, message);
    const sourceReceivedAtMillis =
      normalizeForwarderTimestamp(body.receivedStamp) ??
      normalizeForwarderTimestamp(body.sentStamp) ??
      normalizeForwarderTimestamp(body.timestamp) ??
      normalizeForwarderTimestamp(body.time);
    const storedAtMillis = Date.now();

    const fingerprintSource = [
      String(sender).normalize("NFKC").trim().toLowerCase(),
      String(message).normalize("NFKC").replace(/\s+/g, " ").trim(),
      sourceReceivedAtMillis === null ? "" : String(sourceReceivedAtMillis),
    ].join("\n");
    const fingerprint = createHash("sha256").update(fingerprintSource).digest("hex");
    const smsRef = adminDb.collection("payment_sms").doc(fingerprint);

    const created = await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(smsRef);
      if (existing.exists) return false;

      transaction.create(smsRef, {
        sender: String(sender).slice(0, 120),
        originalMessage: String(message),
        fingerprint,
        classification: parsed?.provider || "unknown",
        extractedAmountPiasters: parsed?.amountMinor || null,
        extractedPhone: parsed?.payerPhone || null,
        extractedSenderName: parsed?.payerName || null,
        extractedTransactionReference: parsed?.reference || null,
        confidence: parsed?.confidence || 0,
        sourceReceivedAtMillis,
        storedAtMillis,
        processingStatus: "pending",
        matchedOrderId: null,
        failureReason: null,
        createdAt: FieldValue.serverTimestamp(),
        processedAt: null,
      });
      return true;
    });

    if (created && smsRef.id) {
      try {
        const secret = process.env.INTERNAL_API_SECRET;
        if (secret) {
          const matchUrl = new URL("/api/internal/payment/sms_match", request.url);
          await fetch(matchUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": secret,
            },
            body: JSON.stringify({ smsId: smsRef.id }),
            cache: "no-store",
          });
        }
      } catch (matchError) {
        console.error("Immediate SMS match error:", matchError);
      }
    }

    return NextResponse.json({
      success: true,
      duplicate: !created,
      status: created ? "received" : "already_received",
      smsId: smsRef.id,
    });
  } catch (error) {
    console.error("SMS webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
