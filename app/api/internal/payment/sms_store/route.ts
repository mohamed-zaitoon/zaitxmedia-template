import { createHash, timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { normalizeForwarderTimestamp, parsePaymentSms } from "@/lib/payments/sms";

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
    const body = await request.json();
    const sender = body.from ?? body.sender ?? "";
    const message = body.text ?? body.message ?? "";
    const parsed = parsePaymentSms(sender, message);
    const sourceReceivedAtMillis =
      normalizeForwarderTimestamp(body.receivedStamp) ??
      normalizeForwarderTimestamp(body.sentStamp);
    const storedAtMillis = Date.now();

    if (!parsed || !parsed.amountMinor) {
      return NextResponse.json(
        { success: false, error: "Unsupported or unparseable payment SMS" },
        { status: 400 },
      );
    }

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
        classification: parsed.provider,
        extractedAmountPiasters: parsed.amountMinor,
        extractedPhone: parsed.payerPhone,
        extractedSenderName: parsed.payerName,
        extractedTransactionReference: parsed.reference,
        confidence: parsed.confidence,
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

    return NextResponse.json({
      success: true,
      duplicate: !created,
      status: created ? "received" : "already_received",
      smsId: smsRef.id,
    });
  } catch (error) {
    console.error("SMS store error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
