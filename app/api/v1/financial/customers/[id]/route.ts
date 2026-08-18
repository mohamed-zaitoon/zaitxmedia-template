import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { verifyAdminToken } from "@/lib/financial/auth";
import { profileBalances } from "@/lib/financial/model";
import { getSarToEgpCustomerRate } from "@/lib/money/exchange-rates";

const n = (v: any) => Number(v) || 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const [profileSnap, pricingSnapshot, sarToEgp] = await Promise.all([
      adminDb.collection("profiles").doc(id).get(),
      adminDb.collection("settings").doc("pricing").get(),
      getSarToEgpCustomerRate(),
    ]);

    if (!profileSnap.exists) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const profile = profileSnap.data()!;
    const separated = profileBalances(profile);
    const pricing = pricingSnapshot.data() || {};
    const usdToEgp = Number(pricing.usd_rate || pricing.tiktok_usd_rate || 50);
    const balanceUsd = separated.USD;
    const balanceEgpEquivalent = balanceUsd * usdToEgp;
    const balanceSarEquivalent = balanceEgpEquivalent / sarToEgp;

    // Fetch wallet transactions
    const txSnap = await adminDb
      .collection("wallet_transactions")
      .where("userId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const transactions: any[] = [];
    let totalDepositsUsd = 0, totalSpentUsd = 0, totalRefundsUsd = 0;

    txSnap.forEach(doc => {
      const d = doc.data();
      transactions.push({
        id: doc.id,
        type: d.type,
        currency: d.currency || "USD",
        amount: n(d.amountUsd || d.amount),
        amountEgp: n(d.amountEgp),
        balanceBefore: n(d.balanceBeforeUsd || d.balanceBefore),
        balanceAfter: n(d.balanceAfterUsd || d.balanceAfter),
        description: d.description || "",
        referenceId: d.orderId || d.depositId || d.referenceId || null,
        referenceType: d.referenceType || (d.orderId ? "order" : d.rechargeId ? "recharge" : null),
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      });
      if (d.type === "deposit") totalDepositsUsd += n(d.amountUsd || d.amount);
      if (d.type === "order_payment") totalSpentUsd += n(d.amountUsd || d.amount);
      if (d.type === "refund") totalRefundsUsd += n(d.amountUsd || d.amount);
    });

    // Fetch orders
    const ordSnap = await adminDb
      .collection("orders")
      .where("user_id", "==", id)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const orders: any[] = [];
    ordSnap.forEach(doc => {
      const d = doc.data();
      orders.push({
        id: doc.id,
        serviceName: d.service_name || "",
        status: d.status,
        saleAmountUsd: n(d.saleAmountUsd),
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return NextResponse.json({
      success: true,
      customer: {
        id,
        name: profile.name || "مستخدم",
        email: profile.email || "",
        phone: profile.phone || "",
        country: profile.country_code || "EG",
        balances: {
          USD: { available: balanceUsd, pending: 0, total: balanceUsd },
          EGP: { available: balanceEgpEquivalent, pending: 0, total: balanceEgpEquivalent },
          SAR: { available: balanceSarEquivalent, pending: 0, total: balanceSarEquivalent },
        },
        stats: { totalDepositsUsd, totalSpentUsd, totalRefundsUsd },
        createdAt: profile.createdAt?.toDate?.()?.toISOString() || null,
      },
      transactions,
      orders,
      balanceMode: "converted_equivalent",
      exchangeRates: { usdToEgp, sarToEgp },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
