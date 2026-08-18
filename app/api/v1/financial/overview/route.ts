import { AggregateField } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/admin";
import { FINANCIAL_CURRENCIES, money } from "@/lib/financial/model";

async function currencyAssetTotals() {
  const snapshots = await Promise.all(
    FINANCIAL_CURRENCIES.map((currency) =>
      adminDb
        .collection("financial_assets")
        .where("currency", "==", currency)
        .aggregate({ total: AggregateField.sum("balance") })
        .get(),
    ),
  );
  return Object.fromEntries(
    FINANCIAL_CURRENCIES.map((currency, index) => [
      currency,
      money(snapshots[index].data().total),
    ]),
  ) as Record<(typeof FINANCIAL_CURRENCIES)[number], number>;
}

async function getPeriodProfits(dateFrom: Date, dateTo: Date) {
  const [ordersAgg, depositsAgg] = await Promise.all([
    adminDb.collection("orders")
      .where("status", "==", "completed")
      .where("createdAt", ">=", dateFrom)
      .where("createdAt", "<", dateTo)
      .aggregate({
        count: AggregateField.count(),
        salesUsd: AggregateField.sum("saleAmountUsd"),
        costsUsd: AggregateField.sum("supplierCostUsd"),
        profitUsd: AggregateField.sum("netServiceProfitUsd"),
      }).get(),
    adminDb.collection("recharges")
      .where("status", "in", ["approved", "verified"])
      .where("createdAt", ">=", dateFrom)
      .where("createdAt", "<", dateTo)
      .aggregate({
        count: AggregateField.count(),
        feesEgp: AggregateField.sum("depositFeeEgp"),
        feesSar: AggregateField.sum("depositFeeSar"),
        profitEgp: AggregateField.sum("depositProfitEgp"),
        profitSar: AggregateField.sum("depositProfitSar"),
        creditedUsd: AggregateField.sum("creditedUsd"),
        paidEgp: AggregateField.sum("grossDepositEgp"),
        paidSar: AggregateField.sum("grossDepositSar"),
      }).get(),
  ]);
  const od = ordersAgg.data();
  const dd = depositsAgg.data();
  return {
    orders: {
      count: od.count,
      salesUsd: money(od.salesUsd),
      costsUsd: money(od.costsUsd),
      profitUsd: money(od.profitUsd),
    },
    deposits: {
      count: dd.count,
      feesEgp: money(dd.feesEgp),
      feesSar: money(dd.feesSar),
      profitEgp: money(dd.profitEgp),
      profitSar: money(dd.profitSar),
      creditedUsd: money(dd.creditedUsd),
      paidEgp: money(dd.paidEgp),
      paidSar: money(dd.paidSar),
    },
  };
}

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin();

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const completedOrders = adminDb.collection("orders").where("status", "==", "completed");
    const approvedDeposits = adminDb.collection("recharges").where("status", "in", ["approved", "verified"]);
    const [
      assets,
      profilesAggregate,
      ordersCount,
      completedOrdersAggregate,
      pendingOrdersCount,
      depositsAggregate,
      pricingSnapshot,
      thisMonth,
      lastMonth,
    ] = await Promise.all([
      currencyAssetTotals(),
      adminDb.collection("profiles").aggregate({
        count: AggregateField.count(),
        USD: AggregateField.sum("balance"),
        EGP: AggregateField.sum("balances.EGP"),
        SAR: AggregateField.sum("balances.SAR"),
      }).get(),
      adminDb.collection("orders").count().get(),
      completedOrders.aggregate({
        count: AggregateField.count(),
        salesUsd: AggregateField.sum("saleAmountUsd"),
        supplierCostsUsd: AggregateField.sum("supplierCostUsd"),
        ordersProfitUsd: AggregateField.sum("netServiceProfitUsd"),
      }).get(),
      adminDb.collection("orders").where("status", "in", ["pending", "pending_action", "processing"]).count().get(),
      approvedDeposits.aggregate({
        count: AggregateField.count(),
        paidEgp: AggregateField.sum("grossDepositEgp"),
        paidSar: AggregateField.sum("grossDepositSar"),
        creditedUsd: AggregateField.sum("creditedUsd"),
        feesEgp: AggregateField.sum("depositFeeEgp"),
        feesSar: AggregateField.sum("depositFeeSar"),
        processingCostEgp: AggregateField.sum("processingCostEgp"),
        processingCostSar: AggregateField.sum("processingCostSar"),
        depositProfitEgp: AggregateField.sum("depositProfitEgp"),
        depositProfitSar: AggregateField.sum("depositProfitSar"),
      }).get(),
      adminDb.collection("settings").doc("pricing").get(),
      getPeriodProfits(thisMonthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
      getPeriodProfits(lastMonthStart, thisMonthStart),
    ]);

    const [
      testProfileSnap,
      profileData,
      orderData,
      depositData,
    ] = await Promise.all([
      adminDb.collection("profiles").where("email", "==", "mohamedzaitoon242@gmail.com").limit(1).get(),
      Promise.resolve(profilesAggregate.data()),
      Promise.resolve(completedOrdersAggregate.data()),
      Promise.resolve(depositsAggregate.data()),
    ]);

    let testUsd = 0;
    if (!testProfileSnap.empty) {
      const testData = testProfileSnap.docs[0].data();
      testUsd = money(testData.balance || testData.balances?.USD || 0);
    }

    const customerBalances = {
      USD: Math.max(0, money(profileData.USD - testUsd)),
      EGP: Math.max(0, money(profileData.EGP - (testUsd * money(pricingSnapshot.data()?.usd_rate || 50)))),
      SAR: money(profileData.SAR),
    };
    const companyFunds = {
      USD: money(assets.USD - customerBalances.USD),
      EGP: money(assets.EGP - customerBalances.EGP),
      SAR: money(assets.SAR - customerBalances.SAR),
    };
    const ordersProfit = { USD: money(orderData.ordersProfitUsd), EGP: 0, SAR: 0 };
    const depositProfit = {
      USD: 0,
      EGP: money(depositData.depositProfitEgp),
      SAR: money(depositData.depositProfitSar),
    };
    const netProfit = {
      USD: ordersProfit.USD,
      EGP: depositProfit.EGP,
      SAR: depositProfit.SAR,
    };
    const pricing = pricingSnapshot.data() || {};

    // Calculate month-over-month change %
    const pctChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      currencies: FINANCIAL_CURRENCIES,
      exchangeRates: {
        usdToEgp: money(pricing.usd_rate || pricing.tiktok_usd_rate),
        sarToEgp: money(pricing.sar_to_egp_rate || pricing.sarEgpRate),
      },
      totalAssets: assets,
      customerBalances,
      companyFunds,
      orders: {
        totalCount: ordersCount.data().count,
        completedCount: orderData.count,
        pendingCount: pendingOrdersCount.data().count,
        sales: { USD: money(orderData.salesUsd), EGP: 0, SAR: 0 },
        supplierCosts: { USD: money(orderData.supplierCostsUsd), EGP: 0, SAR: 0 },
        profits: ordersProfit,
      },
      deposits: {
        totalCount: depositData.count,
        totalPaid: { USD: 0, EGP: money(depositData.paidEgp), SAR: money(depositData.paidSar) },
        totalCredited: { USD: money(depositData.creditedUsd), EGP: 0, SAR: 0 },
        feesCollected: { USD: 0, EGP: money(depositData.feesEgp), SAR: money(depositData.feesSar) },
        processingCosts: { USD: 0, EGP: money(depositData.processingCostEgp), SAR: money(depositData.processingCostSar) },
        netProfit: depositProfit,
      },
      ordersProfit,
      depositProfit,
      netProfit,
      customersCount: profileData.count,
      // Monthly comparison
      thisMonth,
      lastMonth,
      monthlyChange: {
        ordersCount: pctChange(thisMonth.orders.count, lastMonth.orders.count),
        ordersProfitUsd: pctChange(thisMonth.orders.profitUsd, lastMonth.orders.profitUsd),
        depositsCount: pctChange(thisMonth.deposits.count, lastMonth.deposits.count),
        depositsProfitEgp: pctChange(thisMonth.deposits.profitEgp, lastMonth.deposits.profitEgp),
        depositsCreditedUsd: pctChange(thisMonth.deposits.creditedUsd, lastMonth.deposits.creditedUsd),
      },
      accountingEquation: "companyFunds = totalAssets - customerBalances",
    });
  } catch (error) {
    console.error("Financial overview error", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل لوحة المالية" }, { status: 500 });
  }
}

export const POST = GET;

