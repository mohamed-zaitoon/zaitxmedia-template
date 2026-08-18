import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { verifyAdminToken, parseQueryInt } from "@/lib/financial/auth";
import { profileBalances } from "@/lib/financial/model";
import { getSarToEgpCustomerRate } from "@/lib/money/exchange-rates";

export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = parseQueryInt(searchParams.get("page"), 1);
    const limit = Math.min(parseQueryInt(searchParams.get("limit"), 50), 200);
    const search = searchParams.get("search") || "";
    const currency = searchParams.get("currency") || "";
    const offset = (page - 1) * limit;
    const queryLimit = search ? Math.min(limit * 5, 200) : limit;
    const profilesQuery = adminDb
      .collection("profiles")
      .orderBy("balance", "desc")
      .offset(search ? 0 : offset)
      .limit(queryLimit);
    const [profilesSnap, countSnapshot, pricingSnapshot, sarToEgp] = await Promise.all([
      profilesQuery.get(),
      adminDb.collection("profiles").count().get(),
      adminDb.collection("settings").doc("pricing").get(),
      getSarToEgpCustomerRate(),
    ]);
    const pricing = pricingSnapshot.data() || {};
    const usdToEgp = Number(pricing.usd_rate || pricing.tiktok_usd_rate || 50);

    let customers: any[] = [];

    profilesSnap.forEach(doc => {
      const d = doc.data();
      if (d.role === "admin" || d.email === "mohamedzaitoon242@gmail.com") return;
      const country = d.country_code || "EG";
      const customerCurrency = country === "SA" ? "SAR" : "EGP";
      const separated = profileBalances(d);
      const balanceUsd = separated.USD;
      const balanceEgpEquivalent = balanceUsd * usdToEgp;
      const balanceSarEquivalent = balanceEgpEquivalent / sarToEgp;

      customers.push({
        id: doc.id,
        name: d.name || "مستخدم",
        email: d.email || "",
        phone: d.phone || "",
        country,
        currency: customerCurrency,
        balances: {
          USD: { available: balanceUsd, pending: 0, total: balanceUsd },
          EGP: { available: balanceEgpEquivalent, pending: 0, total: balanceEgpEquivalent },
          SAR: { available: balanceSarEquivalent, pending: 0, total: balanceSarEquivalent },
        },
        totalDeposits: d.financialTotals?.deposits || { USD: 0, EGP: 0, SAR: 0 },
        totalPurchases: d.financialTotals?.purchases || { USD: 0, EGP: 0, SAR: 0 },
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        lastActivity: d.lastActivity?.toDate?.()?.toISOString() || null,
      });
    });

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }

    // Filter by currency
    if (currency) {
      customers = customers.filter(c => c.currency === currency);
    }

    const totalCount = search ? customers.length : countSnapshot.data().count;
    const paginated = search ? customers.slice(offset, offset + limit) : customers;

    return NextResponse.json({
      success: true,
      data: paginated,
      balanceMode: "converted_equivalent",
      exchangeRates: { usdToEgp, sarToEgp },
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });

  } catch (err: any) {
    console.error("Financial customers error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
