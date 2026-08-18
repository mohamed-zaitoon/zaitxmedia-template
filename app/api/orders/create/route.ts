import { auth } from "@clerk/nextjs/server";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendEmail, adminEmail } from "../../../lib/mailer";
import { calculateServerOrderPrice } from "@/lib/orders/server-pricing";
import { enforceUserLimit } from "@/lib/data-retention";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { serviceId, quantity, link, options } = body;
    const numQuantity = Number(quantity);
    if (!serviceId || !Number.isInteger(numQuantity) || numQuantity <= 0) {
      return NextResponse.json({ error: "بيانات الطلب غير صحيحة" }, { status: 400 });
    }

    const [pricingSnap, siteSettings] = await Promise.all([
      adminDb.collection("settings").doc("pricing").get(),
      adminDb.collection("settings").doc("site").get(),
    ]);
    if (siteSettings.data()?.site_enabled === false) {
      return NextResponse.json({ error: "الموقع متوقف مؤقتًا للصيانة" }, { status: 503 });
    }
    const serverPrice = await calculateServerOrderPrice(String(serviceId), numQuantity);
    const numPrice = serverPrice.amountEgp;
    const serviceName = serverPrice.serviceName;
    const usdRate = Number(
      pricingSnap.data()?.usd_rate || pricingSnap.data()?.tiktok_usd_rate || 50,
    );
    const priceUsd = Number((numPrice / usdRate).toFixed(6));
    const safeOptions =
      options && typeof options === "object"
        ? {
            ...(["link", "qr", "userpass"].includes(options.tiktokChoice)
              ? { tiktokChoice: options.tiktokChoice }
              : {}),
            ...(typeof options.username === "string"
              ? { username: options.username.trim().slice(0, 200) }
              : {}),
            ...(typeof options.password === "string"
              ? { password: options.password.slice(0, 300) }
              : {}),
            ...(typeof options.whatsapp === "string"
              ? { whatsapp: options.whatsapp.trim().slice(0, 40) }
              : {}),
          }
        : null;
    const choice = safeOptions?.tiktokChoice;
    const requiresAdminDelivery = choice === "link" || choice === "qr";
    const fulfillmentType =
      choice === "link" ? "auth_link" :
      choice === "qr" ? "qr" :
      choice === "userpass" || (safeOptions?.username && safeOptions?.password)
        ? "credentials" : link ? "customer_target" : "manual";

    const profileRef = adminDb.collection("profiles").doc(userId);
    const orderRef = adminDb.collection("orders").doc();
    const transactionRef = adminDb.collection("wallet_transactions").doc();
    let userData: Record<string, any> = {};
    let balanceAfterUsd = 0;

    await adminDb.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      if (!profile.exists) throw new Error("PROFILE_NOT_FOUND");
      userData = profile.data()!;
      const balanceBeforeUsd = Number(userData.balance) || 0;
      if (balanceBeforeUsd + 1e-9 < priceUsd) throw new Error("INSUFFICIENT_BALANCE");
      balanceAfterUsd = Number((balanceBeforeUsd - priceUsd).toFixed(6));

      transaction.update(profileRef, {
        balance: balanceAfterUsd,
        "balances.USD": balanceAfterUsd,
        financialSchemaVersion: 2,
      });
      transaction.create(orderRef, {
        user_id: userId,
        user_email: userData.email || "",
        whatsapp: safeOptions?.whatsapp || userData.whatsapp || "",
        service_id: String(serviceId),
        service_name: String(serviceName || ""),
        supplierPricingBasis: serverPrice.supplierPricingBasis,
        quantity: numQuantity,
        price: numPrice,
        currency: "EGP",
        lockedExchangeRateEgp: usdRate,
        saleAmountUsd: priceUsd,
        link: String(link || "").slice(0, 1000),
        options: safeOptions,
        fulfillmentType,
        paymentMode: "wallet_balance",
        paymentMethodKey: "balance",
        paymentStatus: "paid",
        paymentConfirmationSource: "wallet_balance",
        paidAt: FieldValue.serverTimestamp(),
        status: requiresAdminDelivery ? "pending_action" : "pending",
        fulfillmentStatus: requiresAdminDelivery ? "pending_action" : "pending",
        balance_deducted: true,
        balance_refunded: false,
        created_at: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(transactionRef, {
        userId,
        orderId: orderRef.id,
        currency: "USD",
        amount: priceUsd,
        balanceBefore: balanceBeforeUsd,
        balanceAfter: balanceAfterUsd,
        type: "order_payment",
        referenceId: orderRef.id,
        referenceType: "order",
        amountUsd: priceUsd,
        amountEgp: numPrice,
        exchangeRateEgp: usdRate,
        balanceBeforeUsd,
        balanceAfterUsd,
        description: `دفع الطلب #${orderRef.id.slice(0, 8)}`,
        immutable: true,
        schemaVersion: 2,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(adminDb.collection("financial_ledger").doc(), {
        type: "purchase",
        currency: "USD",
        amount: priceUsd,
        direction: "credit",
        account: "customer_service_wallets",
        counterpartyAccount: "orders_receivable",
        userId,
        referenceId: orderRef.id,
        referenceType: "order",
        description: `دفع طلب #${orderRef.id.slice(0, 8)}`,
        immutable: true,
        schemaVersion: 2,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (userData.email) {
      void sendEmail({
        to: userData.email,
        subject: "تم دفع طلبك من الرصيد - ZAITX MEDIA",
        html: `<div dir="rtl">تم خصم $${priceUsd.toFixed(2)} من رصيدك واستلام طلب <strong>${serviceName || serviceId}</strong>.</div>`,
      });
    }
    void sendEmail({
      to: adminEmail,
      subject: "طلب مدفوع جديد",
      html: `<div dir="rtl">طلب مدفوع من الرصيد.<br>الخدمة: <strong>${serviceName || serviceId}</strong><br>النوع: ${fulfillmentType}<br>${link ? `الرابط/الآيدي: ${link}` : ""}</div>`,
    });

    try {
      const { sendOneSignalPush } = await import("@/app/utils/onesignal");
      await sendOneSignalPush(
        "admin",
        "طلب جديد مدفوع! 🛍️",
        `خدمة: ${serviceName || serviceId}\nالكمية: ${numQuantity}`,
        {
          url: "https://admin.zaitxmedia.com/orders",
          data: { type: "new_order", orderId: orderRef.id },
        },
      );
    } catch (pushErr) {
      console.error("Failed to send push:", pushErr);
    }

    // Enforce max 30 orders limit per user
    void enforceUserLimit("orders", userId).catch(console.error);

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      paymentMode: "wallet_balance",
      balanceAfterUsd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Order creation error details:", error);
    if (message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "رصيدك غير كافٍ. اشحن المحفظة أولاً." },
        { status: 409 },
      );
    }
    if (message === "SERVICE_QUANTITY_OUT_OF_RANGE") {
      return NextResponse.json(
        { error: "الكمية المطلوبة خارج الحدود المتاحة لهذه الخدمة." },
        { status: 400 },
      );
    }
    if (message === "SERVICE_NOT_FOUND") {
      return NextResponse.json(
        { error: "الخدمة غير متوفرة حالياً." },
        { status: 404 },
      );
    }
    if (message === "SERVICE_PRICE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "سعر هذه الخدمة غير متاح حالياً." },
        { status: 400 },
      );
    }
    if (message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "ملف المستخدم غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ error: message || "تعذر إنشاء الطلب" }, { status: 500 });
  }
}
