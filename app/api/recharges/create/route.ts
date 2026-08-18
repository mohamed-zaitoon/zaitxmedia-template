import { auth } from "@clerk/nextjs/server";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { enforceUserLimit } from "@/lib/data-retention";
import { calculateBoundedDepositFee } from "@/lib/deposit-fees";
import { getSarToEgpCustomerRate } from "@/lib/money/exchange-rates";
import { calculateDepositCredit, getMaxWalletBalanceUsd, getMethodFeePercent } from "@/lib/money/wallet";
import { normalizeSubmittedReference, type SmsProvider } from "@/lib/payments/sms";

const METHODS = new Set<SmsProvider>(["vodafone", "instapay", "barq", "bank"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const method = body.method as SmsProvider;
    // The amount is sent in EGP/SAR from the frontend
    const amount = Number(body.amount);
    const reference = String(body.reference || "").trim();
    if (!METHODS.has(method) || !Number.isFinite(amount) || amount <= 0 || !reference) {
      return NextResponse.json({ error: "بيانات الإيداع غير مكتملة" }, { status: 400 });
    }
    const currency = method === "barq" ? "SAR" : "EGP";
    const walletIdentifier = String(body.walletIdentifier || "").trim();
    const normalized = normalizeSubmittedReference(method, reference);
    if (!normalized) {
      return NextResponse.json({ error: "بيانات المحوّل غير صحيحة" }, { status: 400 });
    }

    const [profile, pricing, siteSettings, sarRate] = await Promise.all([
      adminDb.collection("profiles").doc(userId).get(),
      adminDb.collection("settings").doc("pricing").get(),
      adminDb.collection("settings").doc("site").get(),
      getSarToEgpCustomerRate(),
    ]);
    if (!profile.exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (siteSettings.data()?.site_enabled === false) {
      return NextResponse.json({ error: "الموقع متوقف مؤقتًا للصيانة" }, { status: 503 });
    }

    const wallets = Array.isArray(siteSettings.data()?.wallets)
      ? siteSettings.data()!.wallets
      : [];
    const paymentWallet = wallets.find((wallet: any) => {
      let walletType = wallet.type === "fazer" ? "vodafone" : wallet.type;
      
      if (method === "barq" && walletType === "vodafone") {
         walletType = "barq";
      }

      let walletNumber = wallet.number || "";
      const walletLink = wallet.link || "";

      if (walletType === "barq" && walletNumber) {
        if (!walletNumber.startsWith("+20") && walletNumber.startsWith("0")) walletNumber = "+20" + walletNumber.substring(1);
        else if (!walletNumber.startsWith("+20")) walletNumber = "+20" + walletNumber;
      }

      const identifierMatches = !walletIdentifier
        || walletNumber === walletIdentifier
        || walletLink === walletIdentifier
        || wallet.number === walletIdentifier;

      return walletType === method && wallet.isActive !== false && identifierMatches;
    });
    if (!paymentWallet) {
      return NextResponse.json({ error: "وسيلة الإيداع غير متاحة حاليًا" }, { status: 400 });
    }

    const receiptUrl = String(body.receiptUrl || "").trim();

    // Base currency for deposit limits is ALWAYS EGP
    const siteMinEgp = Number(pricing.data()?.deposit_min_egp ?? 80);
    const siteMaxEgp = Number(pricing.data()?.deposit_max_egp ?? 1000000);
    const minimumEgp = Number.isFinite(Number(paymentWallet.min))
      ? Math.max(0, Number(paymentWallet.min))
      : siteMinEgp;
    const maximumEgp = Number.isFinite(Number(paymentWallet.max)) && Number(paymentWallet.max) > 0
      ? Number(paymentWallet.max)
      : siteMaxEgp;

    const grossEgp = currency === "SAR" ? amount * sarRate : amount;

    if (grossEgp < minimumEgp - 0.01) {
      return NextResponse.json(
        { error: `الحد الأدنى للإيداع ${minimumEgp} ج.م` },
        { status: 400 },
      );
    }
    if (grossEgp > maximumEgp + 0.01) {
      return NextResponse.json(
        { error: `الحد الأقصى للإيداع ${maximumEgp.toLocaleString()} ج.م` },
        { status: 400 },
      );
    }

    const usdEgpRate = Number(
      pricing.data()?.usd_rate || pricing.data()?.tiktok_usd_rate || 50,
    );
    const feePercent = getMethodFeePercent(method, pricing.data());
    const feeMinEgp = Number(pricing.data()?.deposit_fee_min_egp ?? 0.5);
    const feeMaxEgp = Number(pricing.data()?.deposit_fee_max_egp ?? 20);

    const feeCalc = calculateBoundedDepositFee(grossEgp, {
      feePercent,
      minEgp: feeMinEgp,
      maxEgp: feeMaxEgp,
    });
    const netEgp = feeCalc.netEgp;
    const estimatedCreditUsd = Number((netEgp / usdEgpRate).toFixed(6));

    const maxWalletBalanceUsd = getMaxWalletBalanceUsd(pricing.data());
    const currentBalanceUsd = Number(profile.data()?.balance) || 0;
    const projectedBalanceUsd = currentBalanceUsd + estimatedCreditUsd;
    if (projectedBalanceUsd > maxWalletBalanceUsd + 0.01) {
      const remainingCapacityUsd = Math.max(
        0,
        maxWalletBalanceUsd - currentBalanceUsd,
      );
      return NextResponse.json(
        {
          error: `الحد الأقصى لرصيد المحفظة ${maxWalletBalanceUsd.toLocaleString()}$. المتاح لإضافته حالياً ${remainingCapacityUsd.toFixed(2)}$`,
        },
        { status: 400 },
      );
    }

    const clientIp = (
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      ""
    ).trim();

    if (clientIp) {
      await adminDb.collection("profiles").doc(userId).set(
        { last_ip: clientIp, last_seen_at: new Date().toISOString() },
        { merge: true },
      );
    }

    const isManualReviewRequired = method === "bank" || Boolean(receiptUrl);

    const rechargeRef = adminDb.collection("recharges").doc();
    const data: Record<string, unknown> = {
      userId,
      userEmail: profile.data()?.email || "",
      client_ip: clientIp || null,
      amount,
      currency,
      method,
      paymentMethodKey: method,
      paymentWalletIdentifier: paymentWallet.number || paymentWallet.link || "",
      originalReference: reference,
      receiptUrl: receiptUrl || null,
      expectedPaymentAmountMinor: Math.round(amount * 100),
      paymentStatus: isManualReviewRequired ? "manual_review" : "verifying",
      status: isManualReviewRequired ? "pending" : "matching",
      feePercent,
      grossDepositEgp: Number(grossEgp.toFixed(2)),
      netDepositEgp: Number(netEgp.toFixed(2)),
      estimatedCreditUsd: Number(estimatedCreditUsd.toFixed(6)),
      lockedUsdEgpRate: usdEgpRate,
      lockedSarEgpRate: sarRate,
      verificationStartedAt: FieldValue.serverTimestamp(),
      verificationDeadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    };
    if (method === "vodafone") data.payerPhoneNormalized = normalized;
    if (method === "barq") data.payerNameNormalized = normalized;
    if (method === "instapay") data.originalReference = normalized;
    await rechargeRef.set(data);

    // Enforce max 30 recharges limit per user
    void enforceUserLimit("recharges", userId).catch(console.error);

    try {
      const { sendOneSignalPush } = await import("@/app/utils/onesignal");
      await sendOneSignalPush(
        "admin",
        "طلب شحن رصيد جديد 💰",
        `${profile.data()?.email || "مستخدم"} — ${amount} ${currency}`,
        {
          url: "https://admin.zaitxmedia.com/recharges",
          data: { type: "new_recharge", rechargeId: rechargeRef.id },
        },
      );
    } catch (pushError) {
      console.error("Failed to notify admin about recharge", pushError);
    }

    return NextResponse.json({
      success: true,
      rechargeId: rechargeRef.id,
      estimatedCreditUsd,
      feePercent,
      usdEgpRate,
      sarEgpRate: sarRate,
    });
  } catch (error) {
    console.error("Recharge creation error:", error);
    return NextResponse.json({ error: "تعذر إنشاء طلب الإيداع" }, { status: 500 });
  }
}
